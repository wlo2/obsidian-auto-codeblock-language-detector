import { LANGUAGE_ALIASES, MAGIKA_LABELS } from "../languageAliases";
import { ALL_LANGUAGES, type PluginSettings } from "../settings";
import type { MagikaModel } from "./magikaModel";

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

  /** Frees the model and TensorFlow.js, which keeps both in a global engine that outlives the plugin. */
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

    // Magika labels prose as plain text, so it needs no prose filter of its own.
    const model = await this.getModel();
    const label = await model.predict(normalizedCode);
    if (!label) {
      return null;
    }

    const id = MAGIKA_LABELS[label] ?? label;

    // Plain text, documents, binary formats and other Magika types without a setting stay unlabeled.
    if (!LANGUAGE_IDS.has(id) || this.getSettings().disabledLanguageIds.includes(id)) {
      return null;
    }

    return LANGUAGE_ALIASES[id] ?? id;
  }

  private getModel(): Promise<MagikaModel> {
    this.modelPromise ??= (async () => {
      // Imported here, not at the top: running TensorFlow.js and the 3 MB model would slow down plugin load.
      const { MagikaModel } = await import("./magikaModel");
      return MagikaModel.load();
    })().catch((error) => {
      this.modelPromise = undefined; // let the next call retry
      throw error;
    });

    return this.modelPromise;
  }
}
