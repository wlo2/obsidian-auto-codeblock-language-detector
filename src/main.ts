import { Editor, EditorChange, Notice, Plugin } from "obsidian";

import { annotateMarkdownCodeFences, hasCodeFence, padFences, parseUnlabeledCodeFences, shouldHandlePaste } from "./markdown/codeFenceProcessor";
import { CodeLanguageDetector } from "./services/codeLanguageDetector";
import { AutoCodeblockSettingTab } from "./settingsTab";
import { DEFAULT_SETTINGS, PluginSettings } from "./settings";

export default class AutoCodeblockLanguageDetectorPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_SETTINGS };

  private readonly detector = new CodeLanguageDetector(() => this.settings);

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new AutoCodeblockSettingTab(this.app, this));

    this.addCommand({
      id: "detect-language",
      name: "Detect languages in current note",
      editorCallback: (editor) => {
        this.detectLanguagesInEditor(editor).catch((error) => {
          console.error("[AutoCodeblock] language detection failed", error);
          new Notice("Language detection failed.");
        });
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-paste", (evt, editor) => {
        // Another plugin already handled this paste.
        if (evt.defaultPrevented) {
          return;
        }

        // Windows clipboards use \r\n; the fence parser splits on \n only.
        const clipboardText = (evt.clipboardData?.getData("text/plain") ?? "").replace(/\r\n?/g, "\n");
        const html = evt.clipboardData?.getData("text/html") ?? "";
        const textBeforeCursor = editor.getRange({ line: 0, ch: 0 }, editor.getCursor("from"));
        if (!shouldHandlePaste(clipboardText, html, textBeforeCursor)) {
          return;
        }

        // Intercept paste event synchronously so we can perform offline detection
        evt.preventDefault();
        void this.handlePasteInterception(editor, clipboardText);
      })
    );

    this.app.workspace.onLayoutReady(() => {
      const warmupTimer = window.setTimeout(() => {
        void this.detector.preload().catch(() => undefined);
      }, 1500);

      this.register(() => window.clearTimeout(warmupTimer));
    });
  }

  onunload(): void {
    void this.detector.dispose();
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<PluginSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...saved };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async handlePasteInterception(
    editor: Editor,
    clipboardText: string
  ): Promise<void> {
    try {
      // Drop blank edge lines only; trim() would also eat the first line's indentation.
      const trimmedClip = clipboardText.replace(/^(?:[ \t]*\n)+/, "").trimEnd();
      let replacement: string | null = null;

      // shouldHandlePaste only lets fenced text through when it has an unlabeled fence.
      if (hasCodeFence(trimmedClip)) {
        const result = await annotateMarkdownCodeFences(trimmedClip, this.detector);
        if (result.updatedCount > 0) {
          replacement = result.markdown;
        }
      } else {
        const language = await this.detector.detect(trimmedClip);
        if (language) {
          replacement = `\`\`\`${language}\n${trimmedClip}\n\`\`\``;
        }
      }

      if (replacement === null) {
        editor.replaceSelection(clipboardText);
        return;
      }

      const from = editor.getCursor("from");
      const to = editor.getCursor("to");
      editor.replaceSelection(
        padFences(replacement, editor.getLine(from.line).slice(0, from.ch), editor.getLine(to.line).slice(to.ch))
      );
    } catch (error) {
      console.error("[AutoCodeblock] paste interception failed", error);
      editor.replaceSelection(clipboardText);
    }
  }

  private async detectLanguagesInEditor(editor: Editor): Promise<void> {
    const codeFenceBlocks = parseUnlabeledCodeFences(editor.getValue());
    if (codeFenceBlocks.length === 0) {
      new Notice("No unlabeled code blocks were found.");
      return;
    }

    // Run async detections first
    const detections: { startLine: number; code: string; language: string }[] = [];
    for (const block of codeFenceBlocks) {
      const language = await this.detector.detect(block.code);
      if (language) {
        detections.push({ startLine: block.startLine, code: block.code, language });
      }
    }

    if (detections.length === 0) {
      new Notice("No unlabeled code blocks were updated.");
      return;
    }

    // The note may have changed while detection ran: only label blocks that are
    // still unlabeled, on the same line, with the same code.
    const liveBlocks = parseUnlabeledCodeFences(editor.getValue());
    const changes: EditorChange[] = [];

    for (const { startLine, code, language } of detections) {
      const liveBlock = liveBlocks.find((block) => block.startLine === startLine && block.code === code);
      if (liveBlock) {
        changes.push({
          from: { line: startLine, ch: 0 },
          to: { line: startLine, ch: editor.getLine(startLine).length },
          text: `${liveBlock.fenceToken}${language}`,
        });
      }
    }

    if (changes.length === 0) {
      new Notice("No unlabeled code blocks were updated (contents changed during detection).");
      return;
    }

    // One transaction, so a single undo reverts the whole run.
    editor.transaction({ changes });

    const blockLabel = changes.length === 1 ? "code block" : "code blocks";
    new Notice(`Detected languages for ${changes.length} ${blockLabel}.`);
  }
}
