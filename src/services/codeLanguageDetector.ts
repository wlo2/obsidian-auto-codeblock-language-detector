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

const COMMON_PROSE_WORDS = new Set([
  "a", "about", "also", "and", "are", "as", "at", "be", "because", "been",
  "but", "by", "can", "does", "even", "for", "from", "had", "has", "have",
  "however", "if", "in", "is", "it", "its", "like", "mostly", "not", "of",
  "on", "one", "or", "so", "some", "that", "the", "then", "there", "this",
  "to", "too", "was", "what", "with", "would", "you", "your"
]);

const CODE_KEYWORDS = new Set([
  "abstract", "async", "await", "break", "case", "catch", "class", "const",
  "continue", "def", "delete", "do", "else", "enum", "except", "export",
  "extends", "false", "finally", "for", "from", "func", "function", "if",
  "import", "in", "interface", "let", "module", "namespace", "new", "nil",
  "none", "null", "package", "private", "protected", "public", "return",
  "self", "static", "struct", "switch", "this", "throw", "true", "try",
  "type", "var", "void", "while", "yield"
]);

const CODE_OPERATOR_PATTERN = /(?:=>|->|::|:=|==|!=|<=|>=|\+\+|--|\+=|-=|\*=|\/=|&&|\|\||[{}[\]();<>])/g;
const SENTENCE_END_PATTERN = /[.!?]["')\]]?$/;
const WORD_PATTERN = /[A-Za-z][A-Za-z']*/g;

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

    if (looksLikeNaturalLanguage(normalizedCode)) {
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

export function looksLikeNaturalLanguage(content: string): boolean {
  const lines = content.split(/\r?\n/);
  const nonEmptyLines = lines.map((line) => line.trim()).filter((line) => line.length > 0);

  if (nonEmptyLines.length < 2) {
    return false;
  }

  const words = content.match(WORD_PATTERN) ?? [];
  if (words.length < 35) {
    return false;
  }

  const lowerWords = words.map((word) => word.toLowerCase());
  const commonWordCount = lowerWords.filter((word) => COMMON_PROSE_WORDS.has(word)).length;
  const codeKeywordCount = lowerWords.filter((word) => CODE_KEYWORDS.has(word)).length;
  const operatorCount = (content.match(CODE_OPERATOR_PATTERN) ?? []).length;
  const assignmentLikeCount = (content.match(/(^|[^\w])\w+\s*[:=]\s*\S/g) ?? []).length;
  const indentedLineCount = lines.filter((line) => /^( {2,}|\t)\S/.test(line)).length;
  const sentenceLineCount = nonEmptyLines.filter((line) => SENTENCE_END_PATTERN.test(line)).length;
  const paragraphBreakCount = lines.filter((line) => line.trim().length === 0).length;
  const longLineCount = nonEmptyLines.filter((line) => line.length >= 80).length;

  const punctuationCount = (content.match(/[.,!?]/g) ?? []).length;
  const symbolCount = (content.match(/[{}[\]();<>:=+\-*/\\|&%$#@]/g) ?? []).length;

  const commonWordRatio = commonWordCount / words.length;
  const codeSignalRatio = (operatorCount + assignmentLikeCount + indentedLineCount + codeKeywordCount) / words.length;
  const prosePunctuationRatio = punctuationCount / words.length;
  const codeSymbolRatio = symbolCount / Math.max(content.length, 1);
  const sentenceLineRatio = sentenceLineCount / nonEmptyLines.length;
  const longLineRatio = longLineCount / nonEmptyLines.length;

  return (
    commonWordRatio >= 0.28 &&
    sentenceLineRatio >= 0.35 &&
    prosePunctuationRatio >= 0.04 &&
    codeSignalRatio < 0.18 &&
    codeSymbolRatio < 0.08 &&
    (paragraphBreakCount >= 1 || longLineRatio >= 0.45)
  );
}
