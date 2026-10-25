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
});

test("shouldHandlePaste", () => {
  const code = "x = 1\ny = 2";
  assert.equal(shouldHandlePaste(code, "", ""), true);
  assert.equal(shouldHandlePaste("one line", "", ""), false);
  // Rich text goes to Obsidian's HTML conversion; HTML that marks code does not.
  assert.equal(shouldHandlePaste(code, "<p>x = 1</p><p>y = 2</p>", ""), false);
  assert.equal(shouldHandlePaste(code, "<pre>x = 1\ny = 2</pre>", ""), true);
  // Cursor inside an existing code block.
  assert.equal(shouldHandlePaste(code, "", "```python\n"), false);
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
});

test("parseUnlabeledCodeFences", () => {
  assert.deepEqual(parseUnlabeledCodeFences("```\nx = 1\n```"), [{ code: "x = 1", fenceToken: "```", startLine: 0 }]);
  // Labeled blocks are skipped whole, so their closing fence is not read as a new opener.
  assert.deepEqual(parseUnlabeledCodeFences("```py\na = 1\n```\ntext\n```\nb = 2\n```"), [{ code: "b = 2", fenceToken: "```", startLine: 4 }]);
  // A longer fence holds shorter ones as content.
  assert.deepEqual(parseUnlabeledCodeFences("````\n```\ninner\n```\n````"), [{ code: "```\ninner\n```", fenceToken: "````", startLine: 0 }]);
  // Inline ```js``` is not a fence, so the block after it is still found.
  assert.deepEqual(parseUnlabeledCodeFences("```js``` x\n```\nb = 2\n```"), [{ code: "b = 2", fenceToken: "```", startLine: 1 }]);
  // Fences nested in a list keep their indentation.
  assert.deepEqual(parseUnlabeledCodeFences("- a\n    ```\n    ls\n    ```"), [{ code: "    ls", fenceToken: "    ```", startLine: 1 }]);
  // Unclosed fences are not blocks.
  assert.deepEqual(parseUnlabeledCodeFences("```\nno end"), []);
});
