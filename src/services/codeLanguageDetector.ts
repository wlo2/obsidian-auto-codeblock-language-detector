import { LANGUAGE_ALIASES, MAGIKA_LABELS } from "../languageAliases";
import { ALL_LANGUAGES, type PluginSettings } from "../settings";
import type { MagikaModel } from "./magikaModel";
import { looksLikeNaturalLanguage } from "./proseFilter";

// Shorter snippets rarely hold enough code to tell languages apart.
const MIN_CONTENT_SIZE = 20;

const LANGUAGE_IDS = new Set(ALL_LANGUAGES.map((language) => language.id));

export class CodeLanguageDetector {
  private modelPromise?: Promise<MagikaModel>;

  /** Reads settings on every call, so changes apply without a sync step. */
  constructor(private readonly getSettings: () => PluginSettings) {}

  async preload(): Promise<void> {
    await this.getModel();
  }

  /** Frees the model: TensorFlow keeps it in a global engine that outlives the plugin. */
  async dispose(): Promise<void> {
    const modelPromise = this.modelPromise;
    this.modelPromise = undefined;
    (await modelPromise?.catch(() => undefined))?.dispose();
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

    const model = await this.getModel();
    const prediction = await model.predict(normalizedCode);
    if (!prediction) {
      return null;
    }

    const { confidenceThreshold, disabledLanguageIds } = this.getSettings();
    const id = MAGIKA_LABELS[prediction.label] ?? prediction.label;

    // Plain text, binary formats and Magika types without a setting (diff, vue, ...) stay unlabeled.
    if (!LANGUAGE_IDS.has(id) || disabledLanguageIds.includes(id) || prediction.score < confidenceThreshold) {
      return null;
    }

    return LANGUAGE_ALIASES[id] ?? id;
  }

  private getModel(): Promise<MagikaModel> {
    // The first prediction compiles the model for the GPU, so warm it up here, once.
    this.modelPromise ??= (async () => {
      // Imported here, not at the top: running TensorFlow.js and the 3 MB model would slow down plugin load.
      const { MagikaModel } = await import("./magikaModel");
      const model = await MagikaModel.load();
      await model.predict("x".repeat(MIN_CONTENT_SIZE));
      return model;
    })().catch((error) => {
      this.modelPromise = undefined; // let the next call retry
      throw error;
    });

    return this.modelPromise;
  }
}
