import assert from "node:assert/strict";
import { test } from "node:test";

import { LANGUAGE_ALIASES, MAGIKA_LABELS } from "../src/languageAliases.ts";
import { ALL_LANGUAGES, DEFAULT_SETTINGS } from "../src/settings.ts";
import config from "../src/vendor/magika/config.min.json" with { type: "json" };

// A typo here, or a label a new Magika model renames, would silently stop a language from being detected.
test("label tables match the model and the settings", () => {
  const ids = new Set(ALL_LANGUAGES.map((language) => language.id));
  const labels = new Set(config.target_labels_space);
  assert.equal(ids.size, ALL_LANGUAGES.length, "a setting id is listed twice");

  for (const [label, id] of Object.entries(MAGIKA_LABELS)) {
    assert.ok(labels.has(label), `MAGIKA_LABELS: ${label} is not a Magika label`);
    assert.ok(ids.has(id), `MAGIKA_LABELS: ${label} maps to ${id}, which has no setting`);
  }
  for (const id of [...Object.keys(LANGUAGE_ALIASES), ...DEFAULT_SETTINGS.disabledLanguageIds]) {
    assert.ok(ids.has(id), `${id} has no setting`);
  }

  // Every toggle is something Magika can output, directly or through MAGIKA_LABELS.
  const detectable = new Set(config.target_labels_space.map((label) => MAGIKA_LABELS[label] ?? label));
  for (const id of ids) {
    assert.ok(detectable.has(id), `Magika never outputs ${id}`);
  }
});
