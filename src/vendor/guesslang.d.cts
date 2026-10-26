// Types for guesslang.cjs, the vendored @microsoft/guesslang-js 0.0.4 build.

export interface ModelResult {
  confidence: number;
  languageId: string;
}

export declare class GuessLang {
  /** Results sorted by confidence, highest first; empty for input under 20 characters. */
  runModel(content: string): Promise<ModelResult[]>;
  dispose(): void;
}
