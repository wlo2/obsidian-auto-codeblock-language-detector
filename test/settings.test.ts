import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_SETTINGS, isLanguageEnabled, setLanguageEnabled } from "../src/settings.ts";

test("language toggles map to the disabled list", () => {
  const defaults = [...DEFAULT_SETTINGS.disabledLanguageIds];
  // Go is off by default, Python is on.
  assert.equal(isLanguageEnabled(DEFAULT_SETTINGS.disabledLanguageIds, "go"), false);
  assert.equal(isLanguageEnabled(DEFAULT_SETTINGS.disabledLanguageIds, "py"), true);

  const pythonOff = setLanguageEnabled(DEFAULT_SETTINGS.disabledLanguageIds, "py", false);
  assert.equal(isLanguageEnabled(pythonOff, "py"), false);
  // Turning a language off twice lists it once.
  assert.deepEqual(setLanguageEnabled(pythonOff, "py", false), pythonOff);
  assert.equal(isLanguageEnabled(setLanguageEnabled(pythonOff, "py", true), "py"), true);
  assert.equal(isLanguageEnabled(setLanguageEnabled(DEFAULT_SETTINGS.disabledLanguageIds, "go", true), "go"), true);

  // The defaults never change, so "Reset to defaults" restores them.
  assert.deepEqual(DEFAULT_SETTINGS.disabledLanguageIds, defaults);
});
