# Auto Codeblock Language Detector

An Obsidian community plugin that automatically detects and adds the programming language to your pasted code blocks, powered by a bundled **TensorFlow.js Guesslang model**. 

It runs entirely offline and intelligently filters languages to provide highly accurate detection for over 50 programming languages.

## Features

- **Smart Paste Handling:** Automatically detects the language of plain multi-line code pastes and wraps them in a labeled code block.
- **Fence Annotation:** If you paste code that already has unlabeled fences (e.g., ` ``` `), it instantly adds the correct language tag (e.g., ` ```python `).
- **Manual Detection Command:** Run `/detect_language` to scan the current note and add language labels to any existing unlabeled fenced code blocks.
- **Fully Customizable:** Use the plugin settings to tweak the minimum confidence threshold, or completely disable languages you don't use (e.g., disable `Batch` to prioritize `Bash` on Mac/Linux).
- **Fast and Offline:** Uses a bundled, optimized machine learning model — no API keys required, and your code never leaves your device.

## Installation

You can install this plugin manually:

1. Create a directory named `auto-codeblock-language-detector` inside your vault's plugins folder:
   ```text
   <Vault>/.obsidian/plugins/auto-codeblock-language-detector/
   ```
2. Copy `main.js` and `manifest.json` into the newly created directory.
3. Reload Obsidian and enable **Auto Codeblock Language Detector** in **Settings -> Community plugins**.

## Configuration

In the plugin settings, you can configure:

- **Confidence threshold:** Minimum confidence score (0.05 to 0.95) required to label a code block. Lower values detect more blocks but may be less accurate on very short snippets.
- **Enabled / Disabled Languages:** Click the language chips to move them between the enabled and disabled lists. Languages in the disabled list will never be emitted by the detector. 

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

## Credits
Uses the open-source [Guesslang](https://github.com/yoeo/guesslang) model via [TensorFlow.js](https://www.tensorflow.org/js/).
