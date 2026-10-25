import assert from "node:assert/strict";
import { test } from "node:test";

import { looksLikeNaturalLanguage } from "../src/services/proseFilter.ts";

test("rejects ordinary prose", () => {
  const prose = [
    "I went to the market this morning because the bakery on the corner was closed for the holiday.",
    "It was busy, but the bread was still warm and the man at the stall was friendly enough.",
    "",
    "Then I walked home along the river, which is something I should do more often when the weather is good.",
    "There is a bench by the bridge where you can sit and watch the boats go past for a while.",
  ].join("\n");
  assert.equal(looksLikeNaturalLanguage(prose), true);
});

test("lets code with docstrings and comments through", () => {
  const python = [
    "class Cache:",
    '    """A small cache that keeps the most recently used items in memory."""',
    "",
    "    def __init__(self, size: int = 128) -> None:",
    "        # The order of the dict is the order of use, oldest first.",
    "        self.size = size",
    "        self.items = {}",
    "",
    "    def get(self, key):",
    '        """Return the value for key, or None if it is not in the cache."""',
    "        if key not in self.items:",
    "            return None",
    "        value = self.items.pop(key)",
    "        self.items[key] = value",
    "        return value",
  ].join("\n");
  assert.equal(looksLikeNaturalLanguage(python), false);
});

test("short text is never called prose", () => {
  assert.equal(looksLikeNaturalLanguage("This is one short line.\nAnd another one."), false);
});
