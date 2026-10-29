import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
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

    const python = "import os\n\ndef list_files(path):\n    for name in os.listdir(path):\n" +
      "        print(os.path.join(path, name))\n\nlist_files('.')";
    const detector = new CodeLanguageDetector(() => DEFAULT_SETTINGS);
    try {
      assert.equal(await detector.detect(python), "python");
      assert.equal(await detector.detect('{\n  "name": "demo",\n  "version": "1.0.0",\n  "private": true\n}'), "json");
      assert.equal(await detector.detect("- buy milk\n- call the dentist\n- fix the bike\n- book flights to Rome"), null);
      // Prose is plain text to Magika, with no filter of our own in front of it.
      const prose = "I went to the market this morning because the bakery on the corner was closed for the holiday.\n" +
        "It was busy, but the bread was still warm.\n\nThen I walked home along the river, which I should do more often.";
      assert.equal(await detector.detect(prose), null);
      // A Magika format beyond guesslang's languages, with its own fence name.
      assert.equal(await detector.detect("node_modules/\ndist/\n.env\n*.log\n.DS_Store\ncoverage/"), "gitignore");
    } finally {
      await detector.dispose();
    }

    // Turning the plugin off and on, or updating it, loads a second copy into the same window.
    // TensorFlow.js's registries are global, so dispose() must empty them or every kernel warns.
    const warnings: string[] = [];
    const warn = console.warn;
    console.warn = (message: unknown) => warnings.push(String(message));
    try {
      const reloadedFile = join(dir, "reloaded.cjs");
      copyFileSync(outfile, reloadedFile);
      const reloaded = new (createRequire(import.meta.url)(reloadedFile) as DetectorModule).CodeLanguageDetector(() => DEFAULT_SETTINGS);
      assert.equal(await reloaded.detect(python), "python");
      await reloaded.dispose();
    } finally {
      console.warn = warn;
    }
    assert.deepEqual(warnings.filter((message) => message.includes("already registered")), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
