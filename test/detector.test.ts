import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { build } from "esbuild";

type DetectorModule = typeof import("../src/services/codeLanguageDetector") & typeof import("../src/settings") &
  typeof import("../src/services/magikaModel");

// Bundles the real detector and the vendored model with esbuild, as the plugin build does,
// so a broken lazy import of the model library fails here instead of silently in Obsidian.
test("detects code and leaves non-code alone", async () => {
  const dir = mkdtempSync(join(tmpdir(), "acld-test-"));
  try {
    const outfile = join(dir, "detector.cjs");
    await build({
      stdin: {
        contents: 'export { CodeLanguageDetector } from "./src/services/codeLanguageDetector";\n' +
          'export { DEFAULT_SETTINGS } from "./src/settings";\n' +
          'export { extractFeatures } from "./src/services/magikaModel";',
        resolveDir: join(import.meta.dirname, ".."),
        loader: "ts",
      },
      bundle: true,
      format: "cjs",
      platform: "node",
      // The plugin build's files: Node's default "main" ones drop the TensorFlow backends as side-effect free.
      mainFields: ["module", "main"],
      loader: { ".bin": "binary" },
      outfile,
      logLevel: "silent",
    });
    const { CodeLanguageDetector, DEFAULT_SETTINGS, extractFeatures } = createRequire(import.meta.url)(outfile) as DetectorModule;

    // Magika's layout: short text at the very start and again at the very end, padding (256) between.
    const short = extractFeatures("abc");
    assert.deepEqual([short.length, ...short.slice(0, 4), ...short.slice(-4)], [2048, 97, 98, 99, 256, 256, 97, 98, 99]);
    // Long text: its first 1024 bytes, then its last 1024 bytes.
    const long = extractFeatures("b" + "x".repeat(3000) + "e");
    assert.deepEqual([long[0], long[1023], long[1024], long[2047]], [98, 120, 120, 101]);

    const detector = new CodeLanguageDetector(() => DEFAULT_SETTINGS);
    try {
      const python = "import os\n\ndef list_files(path):\n    for name in os.listdir(path):\n" +
        "        print(os.path.join(path, name))\n\nlist_files('.')";
      assert.equal(await detector.detect(python), "python");
      assert.equal(await detector.detect('{\n  "name": "demo",\n  "version": "1.0.0",\n  "private": true\n}'), "json");
      assert.equal(await detector.detect("- buy milk\n- call the dentist\n- fix the bike\n- book flights to Rome"), null);
    } finally {
      await detector.dispose();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
