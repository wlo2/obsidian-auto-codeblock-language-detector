import { LANGUAGE_ALIASES } from "../languageAliases";
import type { PluginSettings } from "../settings";
import { looksLikeNaturalLanguage } from "./proseFilter";

interface ModelResult {
  confidence: number;
  languageId: string;
}

interface GuessLangInstance {
  runModel(content: string): Promise<ModelResult[]>;
  dispose(): void;
}

interface GuessLangConstructor {
  new (): GuessLangInstance;
}

// Same as GuessLang's own minimum; shorter input returns no results.
const MIN_CONTENT_SIZE = 20;

export class CodeLanguageDetector {
  private detectorPromise?: Promise<GuessLangInstance>;

  /** Reads settings on every call, so changes apply without a sync step. */
  constructor(private readonly getSettings: () => PluginSettings) {}

  async preload(): Promise<void> {
    await this.getDetector();
  }

  /** Frees the model: TensorFlow keeps it in a global engine that outlives the plugin. */
  async dispose(): Promise<void> {
    const detectorPromise = this.detectorPromise;
    this.detectorPromise = undefined;
    (await detectorPromise?.catch(() => undefined))?.dispose();
  }

  /** Returns the fence language for `code`, or null when unsure. */
  async detect(code: string): Promise<string | null> {
    const normalizedCode = code.trim();
    if (normalizedCode.length < MIN_CONTENT_SIZE) {
      return null;
    }

    if (looksLikeNaturalLanguage(normalizedCode)) {
      return null;
    }

    const detector = await this.getDetector();
    const results = await detector.runModel(normalizedCode);

    const { confidenceThreshold, disabledLanguageIds } = this.getSettings();
    const disabledSet = new Set(disabledLanguageIds);

    // Find the best match that is not disabled
    const bestMatch = results.find(
      (r) => !disabledSet.has(r.languageId)
    );

    if (!bestMatch || bestMatch.confidence < confidenceThreshold) {
      return null;
    }

    return LANGUAGE_ALIASES[bestMatch.languageId] ?? bestMatch.languageId;
  }

  private getDetector(): Promise<GuessLangInstance> {
    // GuessLang loads its model on the first runModel call, so warm it up here, once.
    this.detectorPromise ??= (async () => {
      // Required here, not at the top: running the 1.7 MB library would slow down plugin load.
      const { GuessLang } = require("../vendor/guesslang.cjs") as { GuessLang: GuessLangConstructor };
      const guessLang = new GuessLang();
      await guessLang.runModel("x".repeat(MIN_CONTENT_SIZE));
      return guessLang;
    })().catch((error) => {
      this.detectorPromise = undefined; // let the next call retry
      throw error;
    });

    return this.detectorPromise;
  }
}
