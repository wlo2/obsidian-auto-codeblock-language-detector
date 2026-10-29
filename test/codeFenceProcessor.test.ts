import assert from "node:assert/strict";
import { test } from "node:test";

import { isInsideCodeFence, padFences, parseUnlabeledCodeFences, shouldHandlePaste } from "../src/markdown/codeFenceProcessor.ts";

test("isInsideCodeFence", () => {
  assert.equal(isInsideCodeFence("plain text\n"), false);
  assert.equal(isInsideCodeFence("```python\nx = 1\n"), true);
  assert.equal(isInsideCodeFence("```python\nx = 1\n```\nafter\n"), false);
  // A closing fence must not carry an info string.
  assert.equal(isInsideCodeFence("```\na\n```js\n"), true);
  // A shorter or different fence does not close a longer one.
  assert.equal(isInsideCodeFence("````md\n```\ninner\n```\n"), true);
  assert.equal(isInsideCodeFence("~~~\n```\n"), true);
  // Inline code with three backticks is not a fence.
  assert.equal(isInsideCodeFence("```js``` is inline\n"), false);
  // Fences nested in list items, indented with spaces or tabs.
  assert.equal(isInsideCodeFence("1. Step\n    ```bash\n    ls\n"), true);
  assert.equal(isInsideCodeFence("1. Step\n\t```bash\n\tls\n\t```\n"), false);
  // Fences in callouts and quotes.
  assert.equal(isInsideCodeFence("> [!note]\n> ```python\n> x = 1\n> "), true);
  assert.equal(isInsideCodeFence("> ```python\n> x = 1\n> ```\n> "), false);
});

test("shouldHandlePaste", () => {
  const code = "x = 1\ny = 2";
  assert.equal(shouldHandlePaste(code, "", ""), true);
  assert.equal(shouldHandlePaste("one line", "", ""), false);
  // Rich text goes to Obsidian's HTML conversion; HTML that is only code does not.
  assert.equal(shouldHandlePaste(code, "<p>x = 1</p><p>y = 2</p>", ""), false);
  assert.equal(shouldHandlePaste(code, "<pre>x = 1\ny = 2</pre>", ""), true);
  // Code block on a web page (Chrome adds <meta>), and a JetBrains IDE selection.
  assert.equal(shouldHandlePaste(code, "<meta charset='utf-8'><div class=\"highlight\"><pre><code>x = 1\ny = 2</code></pre></div>", ""), true);
  assert.equal(shouldHandlePaste(code, "<pre style=\"font-family:'JetBrains Mono',monospace;\">x = 1\ny = 2</pre>", ""), true);
  // VS Code selection: monospace text styled white-space: pre.
  assert.equal(shouldHandlePaste(code, "<div style=\"font-family: Menlo, monospace;white-space: pre;\"><div>x = 1</div><div>y = 2</div></div>", ""), true);
  // Prose with inline <code>, Google Docs text (white-space: pre-wrap), and a page section with a <pre> block.
  assert.equal(shouldHandlePaste(code, "<p>Use <code>fetch()</code> to load data.</p><p>It returns a promise.</p>", ""), false);
  assert.equal(shouldHandlePaste(code, "<p><span style=\"font-family:Arial;white-space:pre;white-space:pre-wrap;\">Meeting notes</span></p>", ""), false);
  assert.equal(shouldHandlePaste(code, "<h2>Install</h2><p>Run:</p><pre><code>npm install</code></pre>", ""), false);
  // Cursor inside an existing code block.
  assert.equal(shouldHandlePaste(code, "", "```python\n"), false);
  assert.equal(shouldHandlePaste(code, "", "> [!note]\n> ```python\n> "), false);
  // Only labeled fences: nothing to add. An unlabeled one: annotate it.
  assert.equal(shouldHandlePaste("```py\nx = 1\n```", "", ""), false);
  assert.equal(shouldHandlePaste("```\nx = 1\n```", "", ""), true);
});

test("padFences", () => {
  const block = "```py\nx = 1\n```";
  assert.equal(padFences(block, "", ""), block);
  assert.equal(padFences(block, "   ", " \t"), block);
  assert.equal(padFences(block, "Here is code: ", ""), `\n${block}`);
  assert.equal(padFences(block, "", "rest of line"), `${block}\n`);
  assert.equal(padFences(block, "before", "after"), `\n${block}\n`);
  // Text that does not start or end with a fence pastes as is.
  assert.equal(padFences("intro\n```\nx\n```\noutro", "before", "after"), "intro\n```\nx\n```\noutro");
  // In a list item the block stays in the item: right after the marker, or on a new indented line.
  assert.equal(padFences(block, "2. ", ""), "```py\n   x = 1\n   ```");
  assert.equal(padFences(block, "- Run this: ", "and more"), "\n  ```py\n  x = 1\n  ```\n  ");
  assert.equal(padFences(block, "\t- ", ""), "```py\n\t  x = 1\n\t  ```");
  // Not a list marker: no space after it.
  assert.equal(padFences(block, "-5 degrees ", ""), `\n${block}`);
  // In a callout every line keeps the "> ", also after the callout's title and in a list inside it.
  assert.equal(padFences(block, "> ", ""), "```py\n> x = 1\n> ```");
  assert.equal(padFences(block, "> [!note] Run: ", "more"), "\n> ```py\n> x = 1\n> ```\n> ");
  assert.equal(padFences(block, "> > - ", ""), "```py\n> >   x = 1\n> >   ```");
});

test("parseUnlabeledCodeFences", () => {
  assert.deepEqual(parseUnlabeledCodeFences("```\nx = 1\n```"), [{ code: "x = 1", fenceToken: "```", startLine: 0 }]);
  // Labeled blocks are skipped whole, so their closing fence is not read as a new opener.
  assert.deepEqual(parseUnlabeledCodeFences("```py\na = 1\n```\ntext\n```\nb = 2\n```"), [{ code: "b = 2", fenceToken: "```", startLine: 4 }]);
  // A longer fence holds shorter ones as content.
  assert.deepEqual(parseUnlabeledCodeFences("````\n```\ninner\n```\n````"), [{ code: "```\ninner\n```", fenceToken: "````", startLine: 0 }]);
  // Inline ```js``` is not a fence, so the block after it is still found.
  assert.deepEqual(parseUnlabeledCodeFences("```js``` x\n```\nb = 2\n```"), [{ code: "b = 2", fenceToken: "```", startLine: 1 }]);
  // Fences nested in a list or callout keep their indent or prefix; the code loses it.
  assert.deepEqual(parseUnlabeledCodeFences("- a\n    ```\n    ls\n    ```"), [{ code: "ls", fenceToken: "    ```", startLine: 1 }]);
  assert.deepEqual(parseUnlabeledCodeFences("- a\n\t```\n\tjobs:\n\t  test: 1\n\t```"), [{ code: "jobs:\n  test: 1", fenceToken: "\t```", startLine: 1 }]);
  assert.deepEqual(parseUnlabeledCodeFences("> [!tip]\n> ```\n> a = 1\n>\n> b = 2\n> ```"), [{ code: "a = 1\n\nb = 2", fenceToken: "> ```", startLine: 1 }]);
  // Unclosed fences are not blocks.
  assert.deepEqual(parseUnlabeledCodeFences("```\nno end"), []);
});
