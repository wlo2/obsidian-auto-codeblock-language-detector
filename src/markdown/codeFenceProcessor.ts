import type { CodeLanguageDetector } from "../services/codeLanguageDetector";

interface CodeFenceBlock {
  code: string;
  fenceToken: string;
  startLine: number;
}

export interface CodeFenceProcessingResult {
  markdown: string;
  updatedCount: number;
}

export function containsUnlabeledCodeFence(markdown: string): boolean {
  return parseUnlabeledCodeFences(markdown).length > 0;
}

export async function annotateMarkdownCodeFences(
  markdown: string,
  detector: CodeLanguageDetector
): Promise<CodeFenceProcessingResult> {
  const lines = markdown.split("\n");
  const codeFenceBlocks = parseUnlabeledCodeFences(markdown);

  if (codeFenceBlocks.length === 0) {
    return { markdown, updatedCount: 0 };
  }

  let updatedCount = 0;

  for (const block of codeFenceBlocks) {
    const detection = await detector.detect(block.code);
    if (!detection) {
      continue;
    }

    lines[block.startLine] = `${block.fenceToken}${detection.fenceLanguage}`;
    updatedCount += 1;
  }

  return {
    markdown: lines.join("\n"),
    updatedCount
  };
}

function parseUnlabeledCodeFences(markdown: string): CodeFenceBlock[] {
  const lines = markdown.split("\n");
  const blocks: CodeFenceBlock[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const openingMatch = lines[lineIndex].match(/^([ \t]{0,3})(`{3,}|~{3,})([^\n]*)$/);
    if (!openingMatch) {
      continue;
    }

    const fenceToken = openingMatch[2];
    const infoString = openingMatch[3].trim();
    if (infoString.length > 0) {
      // Skip the ENTIRE labeled block so its closing ``` isn't mistaken for
      // the opening of a new unlabeled block.
      const closingPattern = new RegExp(
        `^[ \\t]{0,3}${escapeRegExp(fenceToken.charAt(0))}{${fenceToken.length},}[ \\t]*$`
      );
      for (let skip = lineIndex + 1; skip < lines.length; skip++) {
        if (closingPattern.test(lines[skip])) {
          lineIndex = skip;
          break;
        }
      }
      continue;
    }

    const closingFencePattern = new RegExp(
      `^[ \\t]{0,3}${escapeRegExp(fenceToken.charAt(0))}{${fenceToken.length},}[ \\t]*$`
    );

    const contentLines: string[] = [];
    let closingLineIndex = -1;

    for (let contentIndex = lineIndex + 1; contentIndex < lines.length; contentIndex += 1) {
      if (closingFencePattern.test(lines[contentIndex])) {
        closingLineIndex = contentIndex;
        break;
      }

      contentLines.push(lines[contentIndex]);
    }

    if (closingLineIndex === -1) {
      continue;
    }

    blocks.push({
      code: contentLines.join("\n"),
      fenceToken: `${openingMatch[1]}${fenceToken}`,
      startLine: lineIndex
    });

    lineIndex = closingLineIndex;
  }

  return blocks;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
