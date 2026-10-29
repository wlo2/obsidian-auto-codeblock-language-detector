# Auto Codeblock Language Detector

An Obsidian community plugin that automatically labels pasted code blocks with their programming language. It detects the language with Google's Magika model, which it bundles and runs with TensorFlow.js.

The plugin runs offline and detects over 75 programming languages and code formats, among them Python, SQL, diffs, Terraform and `.gitignore` files.

## Features

- Wraps plain multi-line code you paste in a code block labeled with its language.
- Adds the language to unlabeled fences in pasted code, so ` ``` ` becomes ` ```python `.
- Labels the unlabeled code blocks already in a note when you run **Detect languages in current note** from the command palette.
- Has a settings toggle for every language, so you can turn off the ones you don't use. On Mac or Linux, for example, turning off `Batch` lets shell scripts come out as `Bash`.
- Leaves pasted notes and paragraphs unlabeled, because Magika recognizes plain text and Markdown.
- Works offline with a bundled model, so it needs no API key and your code never leaves your device.

## How detection works

When you paste text or run the **Detect languages in current note** command, the plugin first finds unlabeled code fences or treats a plain multi-line paste as a candidate block.

Some pastes are left to Obsidian on purpose: formatted text copied from a web page or a document (so Obsidian can convert it to Markdown), pastes while the cursor is already inside a code block, and pastes whose code fences all have a language already. Code copied from an editor such as VS Code or a JetBrains IDE, or from a code block on a web page, is still labeled. Code pasted into a list item or a callout stays inside it.

The bundled Magika model then scores the block. Magika also recognizes plain text, Markdown, documents and many other file types, so ordinary paragraphs and notes stay unlabeled. The plugin uses the top language only when its score clears the threshold Google tuned for that language, and only when the language isn't turned off in settings. Close relatives share a language: a Gemfile is labeled `ruby`, a Gradle build `groovy`, and an SVG `xml`.

The model runs on the GPU through WebGL. The plugin compiles it for the GPU in the background as soon as Obsidian has started or the plugin is turned on, so the first paste doesn't wait for it (see [Startup speed](#startup-speed)).

## Model comparison

Versions up to 0.5.5 used Guesslang. Before the plugin switched to Magika, three detectors (Guesslang, Magika and Highlight.js) were tested on the same 137 short pastes, written to look like what people paste into notes:

- 56 code snippets in 35 languages.
- 46 notes that aren't code: paragraphs, emails, lists, Markdown tables, recipes, chat logs, and text in German, Russian, Spanish, Chinese and Japanese.
- 35 more snippets: 32 in formats beyond the original 54 languages (diffs, SCSS, Terraform and `.gitignore` files, among others) and 3 code snippets full of comments or prose.

Each detector ran the way the plugin would use it:

- Guesslang as in release 0.5.5, with its prose filter and a confidence threshold of 0.1.
- Magika with Google's per-language thresholds.
- Highlight.js limited to the plugin's languages, labeling a block only when its relevance score is 10 or more.

With all languages turned on:

| | Guesslang (0.5.5) | **Magika** (now) | Highlight.js 11.11.1 |
|---|---|---|---|
| Code labeled right / wrong, of 56 | 42 / 4 | **51 / 1** | 18 / 5 |
| Notes left unlabeled, of 46 | 36 | **41** | 43 |
| More snippets right / wrong, of 35 | 6 / 10 | **34 / 1** | 11 / 5 |
| Time per detection | ~14 ms, blocks typing | ~21 ms on the GPU, doesn't block | ~1 ms |
| Size in the plugin | 1.7 MB | 5.2 MB | ~0.25 MB for 67 languages |

Code left unlabeled counts as neither right nor wrong. With the default language list, Magika labels 40 code snippets right and none wrong, and leaves 44 notes alone. Guesslang labels 35 right and 2 wrong, and leaves 41 notes alone.

Magika labels five notes. Two are lists it reads as YAML: a list of URLs and a "Name: value" list. The other three have Markdown headings or tables, and they only get a label when the Markdown toggle is on. It is off by default.

Guesslang only knows the original 54 languages. It leaves most of the extra formats unlabeled and gives 10 of them a wrong label.

Highlight.js always names some language, so the plugin would have to judge each answer by its relevance score, and no cut-off works well: at 5 it labels 37 code snippets right but 13 wrong, and leaves only 28 notes alone; at 15 it leaves 45 notes alone but labels only 6 code snippets. It can't detect CSV, Vue, HCL, Solidity, Zig, BibTeX, reStructuredText, `.gitignore`, YARA or PO files at all. Version 11.12.0 is worse: it labels much of the text as Dart, prose included.

Timings come from an Apple M4 Mac, in Chromium, the browser engine Obsidian runs on; Highlight.js was timed in Node.js. Without WebGL, Magika falls back to the CPU and takes about 2.5 s per detection.

## Startup speed

Before the model can run on the GPU, TensorFlow.js has to compile its WebGL shaders, the small GPU programs behind each step of the model. The usual way to compile them is to run a first prediction, which blocks Obsidian's main thread. On the very first start, that froze Obsidian for about 5 seconds.

The plugin avoids the freeze in four steps:

1. Nothing heavy runs when the plugin loads. TensorFlow.js and the model are bundled in `main.js` but don't run until they're first needed, so the plugin loads in about 30 ms.
2. As soon as Obsidian is ready, in `workspace.onLayoutReady()`, the plugin loads the model from memory and starts compiling it in the background. The weights are inlined in `main.js`, so this needs no network or file access.
3. The shaders compile in parallel, off the main thread. `MagikaModel.compileShaders()` turns on TensorFlow.js's `ENGINE_COMPILE_ONLY` flag and runs one full prediction. With the flag on, TensorFlow.js hands each shader to the GPU to compile but doesn't run it. The method then waits with `checkCompileCompletionAsync()`, which uses the browser's `KHR_parallel_shader_compile` extension to check once per frame whether the GPU has finished, and Obsidian stays responsive while it waits. The pass also reads the scores back. Without that, the shaders that fetch results from the GPU were left to compile during the first real paste, which froze Obsidian for 0.7 s.
4. Chromium keeps the compiled shaders in its disk cache, so later starts skip the compile.

These numbers were measured in Chromium on an Apple M4 Mac. For the first-start rows, each shader got a unique branch that never runs, so no cached copy could be reused:

| | First prediction compiles (before) | Background compile (now) |
|---|---|---|
| First start: longest freeze | 5.1 s | ~0.15 s |
| First start: model ready after | 5.2 s | ~0.9 s |
| Later starts: longest freeze | 0.15 s | none |

Once the shaders are compiled, each detection takes about 21 ms and doesn't block typing. Two other TensorFlow.js backends were tried. The WebAssembly backend can't run the model because it lacks the `Einsum` operation, and the CPU backend takes about 2.5 s per detection, so the plugin uses it only on devices without WebGL.

## Installation

You can install this plugin manually:

1. Create a directory named `auto-codeblock-language-detector` inside your vault's plugins folder:
   ```text
   <Vault>/.obsidian/plugins/auto-codeblock-language-detector/
   ```
2. Copy `main.js` and `manifest.json` into that directory.
3. Reload Obsidian (version 1.13.1 or newer) and enable **Auto Codeblock Language Detector** in **Settings -> Community plugins**.

## Configuration

In the plugin settings, turn off any language you never want the detector to emit. To find a language quickly, type in the filter box or use Obsidian's settings search.

## Development

Install dependencies and start the development watcher:

```bash
npm install
npm run dev
```

Build a production bundle with:

```bash
npm run build
```

Run the tests (needs Node 23.6 or newer) with:

```bash
npm test
```

Check the code with Obsidian's recommended ESLint rules (the same rules its automated plugin review runs):

```bash
npm run lint
```

## License

Copyright (C) 2026 wlo2

This plugin is free software, released under the [GNU General Public License v3.0](LICENSE) (GPL-3.0-only). You may use, share and change it. If you distribute it or a work based on it, you must release that work's source code under the same license.

Versions up to 0.4.0 were published under the MIT License. Bundled third-party code keeps its own license; see Credits.

## Credits

Language detection uses Google's [Magika](https://github.com/google/magika) model (Apache License 2.0) via [TensorFlow.js](https://www.tensorflow.org/js/) 4.22.0 (Apache License 2.0).

The files in `src/vendor/magika/` are the `standard_v3_3` model from the Magika repository (`website-ng/public/models/standard_v3_3`), unchanged. `src/services/magikaModel.ts` reimplements Magika's input preparation and confidence thresholds from its JavaScript package, so the plugin can load the model from memory. The full Apache 2.0 license text is kept in `src/vendor/magika/license.ts` and in the released `main.js`.

Versions up to 0.5.5 used the [Guesslang](https://github.com/yoeo/guesslang) model (MIT License) from [`@microsoft/guesslang-js`](https://github.com/hieplpvip/guesslang-js).
