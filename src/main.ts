import { Editor, Notice, Plugin } from "obsidian";

import { annotateMarkdownCodeFences, containsUnlabeledCodeFence } from "./markdown/codeFenceProcessor";
import { CodeLanguageDetector } from "./services/codeLanguageDetector";
import { AutoCodeblockSettingTab } from "./settingsTab";
import { DEFAULT_SETTINGS, PluginSettings } from "./settings";

const LOG = (...args: unknown[]) =>
  console.log("[AutoCodeblock]", ...args);

export default class AutoCodeblockLanguageDetectorPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_SETTINGS };

  private readonly detector = new CodeLanguageDetector({
    confidenceThreshold: DEFAULT_SETTINGS.confidenceThreshold,
    disabledLanguageIds: DEFAULT_SETTINGS.disabledLanguageIds,
  });

  async onload(): Promise<void> {
    await this.loadSettings();
    LOG("Loaded. threshold=", this.settings.confidenceThreshold,
        "disabled=", this.settings.disabledLanguageIds);

    this.addSettingTab(new AutoCodeblockSettingTab(this.app, this));

    this.addCommand({
      id: "detect-language",
      name: "/detect_language",
      editorCallback: (editor) => {
        void this.detectLanguagesInEditor(editor);
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-paste", (evt, editor) => {
        const clipboardText = evt.clipboardData?.getData("text/plain");
        LOG("editor-paste fired, defaultPrevented=", evt.defaultPrevented,
            "clipLen=", clipboardText?.length ?? 0);

        if (!clipboardText || clipboardText.trim().split("\n").length < 2) {
          return;
        }

        // editor-paste fires AFTER paste is already in the document.
        // Cursor is at the END of the just-pasted content.
        const docNow = editor.getValue();
        const cursorNow = editor.getCursor();

        void this.handlePastedRegion(editor, docNow, cursorNow, clipboardText);
      })
    );

    this.app.workspace.onLayoutReady(() => {
      const warmupTimer = window.setTimeout(() => {
        void this.detector.preload().catch(() => undefined);
      }, 1500);

      this.register(() => window.clearTimeout(warmupTimer));
    });
  }

  async loadSettings(): Promise<void> {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    this.detector.updateOptions({
      confidenceThreshold: this.settings.confidenceThreshold,
      disabledLanguageIds: this.settings.disabledLanguageIds,
    });
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.detector.updateOptions({
      confidenceThreshold: this.settings.confidenceThreshold,
      disabledLanguageIds: this.settings.disabledLanguageIds,
    });
  }

  private async handlePastedRegion(
    editor: Editor,
    doc: string,
    cursor: { line: number; ch: number },
    clipboardText: string
  ): Promise<void> {
    try {
      // Cursor is at the END of the pasted content.
      // Convert cursor to a char offset so we can search backwards for the clipboard text.
      const lines = doc.split("\n");
      let cursorCharOffset = cursor.ch;
      for (let i = 0; i < cursor.line; i++) {
        cursorCharOffset += lines[i].length + 1; // +1 for \n
      }

      // Search backward from cursor for the trimmed clipboard text
      const trimmedClip = clipboardText.trim();
      const searchStart = Math.max(0, cursorCharOffset - trimmedClip.length - 5);
      const posInDoc = doc.lastIndexOf(trimmedClip, cursorCharOffset);

      LOG("handlePastedRegion: cursorOffset=", cursorCharOffset,
          "searchStart=", searchStart, "found@", posInDoc);

      if (posInDoc === -1 || posInDoc < searchStart) {
        LOG("handlePastedRegion: clipboard text not found near cursor");
        return;
      }

      const insertStart = posInDoc;
      const insertEnd   = posInDoc + trimmedClip.length;

      // Detect language / annotate fences
      let replacement: string | null = null;

      if (containsUnlabeledCodeFence(trimmedClip)) {
        const result = await annotateMarkdownCodeFences(trimmedClip, this.detector);
        if (result.updatedCount > 0) {
          replacement = result.markdown;
          LOG("annotated", result.updatedCount, "fences");
        }
      } else {
        const detection = await this.detector.detect(trimmedClip);
        LOG("plain detect result=", detection);
        if (detection) {
          replacement = `\`\`\`${detection.fenceLanguage}\n${trimmedClip}\n\`\`\``;
        }
      }

      if (replacement !== null) {
        const charToPos = (charIdx: number) => {
          const before = doc.slice(0, charIdx);
          const ls = before.split("\n");
          return { line: ls.length - 1, ch: ls[ls.length - 1].length };
        };
        const startPos = charToPos(insertStart);
        const endPos   = charToPos(insertEnd);

        // Re-read document after the async await — it may have changed
        const liveDoc   = editor.getValue();
        const liveLines = liveDoc.split("\n");

        // Abort if positions are now out of bounds
        if (
          startPos.line >= liveLines.length ||
          endPos.line   >= liveLines.length ||
          startPos.ch   >  (liveLines[startPos.line]?.length ?? 0) ||
          endPos.ch     >  (liveLines[endPos.line]?.length ?? 0)
        ) {
          LOG("replaceRange aborted: positions out of bounds after async wait");
          return;
        }

        // Abort if the text we're replacing no longer matches (user edited meanwhile)
        const liveSlice = liveDoc.slice(insertStart, insertEnd);
        if (liveSlice !== trimmedClip) {
          LOG("replaceRange aborted: document changed since paste");
          return;
        }

        LOG("replaceRange", startPos, "->", endPos);
        editor.replaceRange(replacement, startPos, endPos);
      }
    } catch (error) {
      console.error("[AutoCodeblock] post-paste handling failed", error);
    }
  }

  private async detectLanguagesInEditor(editor: Editor): Promise<void> {
    const originalMarkdown = editor.getValue();
    LOG("detectLanguagesInEditor: markdown length=", originalMarkdown.length);

    // Log every fence-like line so we can see labels (or lack thereof)
    const fenceLines = originalMarkdown.split("\n")
      .map((l, i) => ({ i, l }))
      .filter(({ l }) => /^[ \t]{0,3}(`{3,}|~{3,})/.test(l));
    LOG("detectLanguagesInEditor: fence lines=", fenceLines.map(({ i, l }) => `L${i}: ${JSON.stringify(l)}`));

    const result = await annotateMarkdownCodeFences(originalMarkdown, this.detector);
    LOG("detectLanguagesInEditor: updatedCount=", result.updatedCount);

    if (result.updatedCount === 0) {
      new Notice("No unlabeled code blocks were updated.");
      return;
    }

    const cursor = editor.getCursor();
    editor.setValue(result.markdown);
    editor.setCursor(cursor);

    const blockLabel = result.updatedCount === 1 ? "code block" : "code blocks";
    new Notice(`Detected languages for ${result.updatedCount} ${blockLabel}.`);
  }
}
