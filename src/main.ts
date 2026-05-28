import { Editor, Notice, Plugin } from "obsidian";

import { annotateMarkdownCodeFences, containsUnlabeledCodeFence, parseUnlabeledCodeFences } from "./markdown/codeFenceProcessor";
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

  private async handlePasteInterception(
    editor: Editor,
    clipboardText: string
  ): Promise<void> {
    try {
      const trimmedClip = clipboardText.trim();
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
        editor.replaceSelection(replacement);
      } else {
        editor.replaceSelection(clipboardText);
      }
    } catch (error) {
      console.error("[AutoCodeblock] paste interception failed", error);
      editor.replaceSelection(clipboardText);
    }
  }

  private async detectLanguagesInEditor(editor: Editor): Promise<void> {
    const originalMarkdown = editor.getValue();
    LOG("detectLanguagesInEditor: markdown length=", originalMarkdown.length);

    const codeFenceBlocks = parseUnlabeledCodeFences(originalMarkdown);
    if (codeFenceBlocks.length === 0) {
      new Notice("No unlabeled code blocks were found.");
      return;
    }

    // Log every fence-like line so we can see labels (or lack thereof)
    const fenceLines = originalMarkdown.split("\n")
      .map((l, i) => ({ i, l }))
      .filter(({ l }) => /^[ \t]{0,3}(`{3,}|~{3,})/.test(l));
    LOG("detectLanguagesInEditor: fence lines=", fenceLines.map(({ i, l }) => `L${i}: ${JSON.stringify(l)}`));

    // Run async detections first
    const detections: { startLine: number; fenceToken: string; language: string }[] = [];
    for (const block of codeFenceBlocks) {
      const detection = await this.detector.detect(block.code);
      if (detection) {
        detections.push({
          startLine: block.startLine,
          fenceToken: block.fenceToken,
          language: detection.fenceLanguage
        });
      }
    }

    if (detections.length === 0) {
      new Notice("No unlabeled code blocks were updated.");
      return;
    }

    // Sort detections descending by startLine to process bottom-up
    detections.sort((a, b) => b.startLine - a.startLine);

    // Apply the updates in-place safely
    const liveDoc = editor.getValue();
    const liveLines = liveDoc.split("\n");
    let updatedCount = 0;

    for (const { startLine, fenceToken, language } of detections) {
      if (startLine >= liveLines.length) {
        continue;
      }

      const liveLineContent = liveLines[startLine];
      // Verify that the line still matches the expected opening fence exactly.
      // This protects against overwriting user changes made during the async detection.
      if (liveLineContent.trim() === fenceToken.trim()) {
        const newLine = `${fenceToken}${language}`;
        editor.setLine(startLine, newLine);
        updatedCount += 1;
      } else {
        LOG("detectLanguagesInEditor: skipped line", startLine, "due to modifications during async wait");
      }
    }

    if (updatedCount === 0) {
      new Notice("No unlabeled code blocks were updated (contents changed during detection).");
      return;
    }

    const blockLabel = updatedCount === 1 ? "code block" : "code blocks";
    new Notice(`Detected languages for ${updatedCount} ${blockLabel}.`);
  }
}
