import { LANGUAGE_ALIASES } from "../languageAliases";

interface GuessLangOptions {
  maxContentSize?: number;
  minContentSize?: number;
}

interface ModelResult {
  confidence: number;
  languageId: string;
}

interface GuessLangInstance {
  runModel(content: string): Promise<ModelResult[]>;
}

interface GuessLangConstructor {
  new (options?: GuessLangOptions): GuessLangInstance;
}

const { GuessLang } = require("../vendor/guesslang.cjs") as {
  GuessLang: GuessLangConstructor;
};

export interface DetectedLanguage {
  confidence: number;
  fenceLanguage: string;
  sourceLanguageId: string;
}

const MIN_CONTENT_SIZE = 20;
const MAX_CONTENT_SIZE = 100000;

export interface DetectorOptions {
  confidenceThreshold?: number;
  disabledLanguageIds?: string[];
}

export class CodeLanguageDetector {
  private detectorPromise?: Promise<GuessLangInstance>;
  private options: Required<DetectorOptions>;

  constructor(options: DetectorOptions = {}) {
    this.options = {
      confidenceThreshold: options.confidenceThreshold ?? 0.15,
      disabledLanguageIds: options.disabledLanguageIds ?? [],
    };
  }

  /** Update options at runtime (called when the user changes settings). */
  updateOptions(options: DetectorOptions): void {
    if (options.confidenceThreshold !== undefined) {
      this.options.confidenceThreshold = options.confidenceThreshold;
    }
    if (options.disabledLanguageIds !== undefined) {
      this.options.disabledLanguageIds = options.disabledLanguageIds;
    }
  }

  async preload(): Promise<void> {
    await this.getDetector();
  }

  async detect(code: string): Promise<DetectedLanguage | null> {
    const normalizedCode = code.trim();
    if (normalizedCode.length < MIN_CONTENT_SIZE) {
      return null;
    }

    const detector = await this.getDetector();
    const results = await detector.runModel(normalizedCode);

    const disabledSet = new Set(this.options.disabledLanguageIds);

    // Find the best match that is not disabled
    const bestMatch = results.find(
      (r) => !disabledSet.has(r.languageId)
    );

    if (!bestMatch || bestMatch.confidence < this.options.confidenceThreshold) {
      return null;
    }

    return {
      confidence: bestMatch.confidence,
      fenceLanguage: LANGUAGE_ALIASES[bestMatch.languageId] ?? bestMatch.languageId,
      sourceLanguageId: bestMatch.languageId,
    };
  }

  private async getDetector(): Promise<GuessLangInstance> {
    if (!this.detectorPromise) {
      this.detectorPromise = Promise.resolve(
        new GuessLang({
          maxContentSize: MAX_CONTENT_SIZE,
          minContentSize: MIN_CONTENT_SIZE,
        })
      );
    }

    return this.detectorPromise;
  }
}
