import type { CodeLanguageDetector } from "../services/codeLanguageDetector";

export interface CodeFenceBlock {
  code: string;
  fenceToken: string;
  startLine: number;
}

export interface CodeFenceProcessingResult {
  markdown: string;
  updatedCount: number;
}

interface FenceLine {
  indent: string;
  token: string;
  info: string;
}

/**
 * Parses a fence line, or returns null. Any indentation is allowed so fences nested in
 * list items count; a backtick fence whose info string has a backtick is inline code.
 */
function matchFence(line: string): FenceLine | null {
  const match = line.match(/^([ \t]*)(`{3,}|~{3,})(.*)$/);
  if (!match || (match[2][0] === "`" && match[3].includes("`"))) {
    return null;
  }

  return { indent: match[1], token: match[2], info: match[3].trim() };
}

function closesFence(line: FenceLine | null, openToken: string): boolean {
  return line !== null && line.info === "" && line.token[0] === openToken[0] && line.token.length >= openToken.length;
}

export function hasCodeFence(markdown: string): boolean {
  return markdown.split("\n").some((line) => matchFence(line) !== null);
}

export function containsUnlabeledCodeFence(markdown: string): boolean {
  return parseUnlabeledCodeFences(markdown).length > 0;
}

/** True when the end of `markdown` (e.g. the text before the cursor) sits inside an open fenced block. */
export function isInsideCodeFence(markdown: string): boolean {
  let openToken: string | null = null;

  for (const line of markdown.split("\n")) {
    const fence = matchFence(line);
    if (openToken === null) {
      openToken = fence?.token ?? null;
    } else if (closesFence(fence, openToken)) {
      openToken = null;
    }
  }

  return openToken !== null;
}

/**
 * Whether copied HTML is only code: all visible text sits in <pre> (IDEs, code blocks on web
 * pages), or it is monospace text with white-space: pre (VS Code). Inline <code> in prose and
 * editors that style all text white-space: pre-wrap (Google Docs) don't count.
 */
function isCodeHtml(html: string): boolean {
  const textOutsidePre = html.replace(/<pre\b[\s\S]*?<\/pre>/gi, "").replace(/<[^>]*>/g, "").trim();
  return (/<pre\b/i.test(html) && textOutsidePre === "") ||
    (/white-space:\s*pre\s*[;"']/i.test(html) && /monospace/i.test(html));
}

/** Whether the plugin should take over a paste instead of letting Obsidian paste it normally. */
export function shouldHandlePaste(text: string, html: string, textBeforeCursor: string): boolean {
  if (text.trim().split("\n").length < 2) {
    return false;
  }

  // Leave rich text to Obsidian's HTML-to-Markdown conversion.
  // shortcut: guesses code from the HTML's markup, widen isCodeHtml if some code source is missed.
  if (html && !isCodeHtml(html)) {
    return false;
  }

  // Fencing a paste inside an existing code block would close that block early.
  if (isInsideCodeFence(textBeforeCursor)) {
    return false;
  }

  // Fences that are all labeled already: nothing to add, paste as is.
  return !hasCodeFence(text) || containsUnlabeledCodeFence(text);
}

/**
 * Adds line breaks so a fence at the start or end of `text` gets its own line when it is
 * pasted between `textBefore` and `textAfter` (the rest of the cursor's line).
 * Otherwise the fence is not a fence, and the rest of the note turns into code.
 * In a list item ("- ", "2. "), every line is indented to the item's text so the block stays in it.
 */
export function padFences(text: string, textBefore: string, textAfter: string): string {
  const lines = text.split("\n");
  const listMarker = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/.exec(textBefore)?.[0] ?? "";
  // Tabs stay tabs and the marker becomes spaces, so the indent lines up with the item's text.
  const newline = "\n" + listMarker.replace(/[^\t]/g, " ");
  const before = hasCodeFence(lines[0]) && textBefore.slice(listMarker.length).trim() ? newline : "";
  const after = hasCodeFence(lines[lines.length - 1]) && textAfter.trim() ? newline : "";
  return before + lines.join(newline) + after;
}

export async function annotateMarkdownCodeFences(
  markdown: string,
  detector: CodeLanguageDetector
): Promise<CodeFenceProcessingResult> {
  const lines = markdown.split("\n");
  let updatedCount = 0;

  for (const block of parseUnlabeledCodeFences(markdown)) {
    const language = await detector.detect(block.code);
    if (!language) {
      continue;
    }

    lines[block.startLine] = `${block.fenceToken}${language}`;
    updatedCount += 1;
  }

  return {
    markdown: lines.join("\n"),
    updatedCount
  };
}

export function parseUnlabeledCodeFences(markdown: string): CodeFenceBlock[] {
  const lines = markdown.split("\n");
  const blocks: CodeFenceBlock[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const opening = matchFence(lines[lineIndex]);
    if (!opening) {
      continue;
    }

    let closingLineIndex = lineIndex + 1;
    while (closingLineIndex < lines.length && !closesFence(matchFence(lines[closingLineIndex]), opening.token)) {
      closingLineIndex += 1;
    }

    if (closingLineIndex === lines.length) {
      continue;
    }

    // Labeled blocks are skipped whole, so their closing fence is not read as a new opener.
    if (opening.info === "") {
      blocks.push({
        code: lines.slice(lineIndex + 1, closingLineIndex).join("\n"),
        fenceToken: `${opening.indent}${opening.token}`,
        startLine: lineIndex
      });
    }

    lineIndex = closingLineIndex;
  }

  return blocks;
}
