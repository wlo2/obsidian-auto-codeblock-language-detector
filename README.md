# Auto Codeblock Language Detector

An Obsidian community plugin that automatically detects and adds the programming language to your pasted code blocks, powered by Google's **Magika** model, bundled and run with TensorFlow.js.

It runs entirely offline and intelligently filters languages to provide highly accurate detection for over 50 programming languages.

## Features

- **Smart Paste Handling:** Automatically detects the language of plain multi-line code pastes and wraps them in a labeled code block.
- **Fence Annotation:** If you paste code that already has unlabeled fences (e.g., ` ``` `), it instantly adds the correct language tag (e.g., ` ```python `).
- **Manual Detection Command:** Run **Detect languages in current note** from the command palette to scan the current note and add language labels to any existing unlabeled fenced code blocks.
- **Customizable:** Use the plugin settings to tweak the minimum confidence threshold, or completely disable languages you don't use (e.g., disable `Batch` to prioritize `Bash` on Mac/Linux).
- **Prose Rejection:** A pre-detection filter skips text that statistically looks like natural language instead of code, reducing false positives on pasted notes and paragraphs.
- **Fast and Offline:** Uses a bundled, optimized machine learning model — no API keys required, and your code never leaves your device.

## How detection works

When you paste text or run the **Detect languages in current note** command, the plugin first finds unlabeled code fences or treats a plain multi-line paste as a candidate block.

Some pastes are left to Obsidian on purpose: formatted text copied from a web page or a document (so Obsidian can convert it to Markdown), pastes while the cursor is already inside a code block, and pastes whose code fences all have a language already. Code copied from an editor such as VS Code or a JetBrains IDE, or from a code block on a web page, is still labeled. Code pasted into a list item stays inside that item.

Before the Magika model runs, the plugin applies a lightweight prose filter. It counts common prose words, sentence-ending lines, punctuation, paragraph breaks, long lines, indented detail-list lines, code keywords, assignments, and code operators. A block is rejected as prose only when it has strong natural-language signals and weak code signals. This keeps ordinary paragraphs, long-form notes, and paragraph-plus-detail-list notes from being labeled as languages while still allowing compact code samples through to the model.

If the prose filter allows the block, the bundled Magika model scores it. Magika also recognizes plain text and many other file types, which stay unlabeled. The plugin applies the top language only when Magika is confident enough for that language, the score is at or above your configured confidence threshold, and the language is not disabled in settings.

The model runs on the GPU through WebGL. The very first detection after installing compiles it for the GPU, which can pause Obsidian for a few seconds; later starts use the cached result.

## Installation

You can install this plugin manually:

1. Create a directory named `auto-codeblock-language-detector` inside your vault's plugins folder:
   ```text
   <Vault>/.obsidian/plugins/auto-codeblock-language-detector/
   ```
2. Copy `main.js` and `manifest.json` into the newly created directory.
3. Reload Obsidian (version 1.13.1 or newer) and enable **Auto Codeblock Language Detector** in **Settings -> Community plugins**.

## Configuration

In the plugin settings, you can configure:

- **Confidence threshold:** Minimum confidence score (0.05 to 0.95) required to label a code block. Lower values detect more blocks but may be less accurate on very short snippets.
- **Languages:** Turn off the toggle for any language you never want the detector to emit. Type in the filter box, or use Obsidian's settings search, to find a language quickly.

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
