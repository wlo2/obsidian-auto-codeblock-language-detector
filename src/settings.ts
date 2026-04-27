export interface PluginSettings {
  /** Minimum confidence score [0–1] to accept a detection. */
  confidenceThreshold: number;
  /** Language IDs (guesslang) that are blacklisted and will never be emitted. */
  disabledLanguageIds: string[];
}

export interface LanguageDefinition {
  id: string;       // guesslang internal ID
  label: string;    // human-readable name shown in the UI
}

/** All 54 languages the guesslang model can detect, with display names. */
export const ALL_LANGUAGES: LanguageDefinition[] = [
  { id: "asm",        label: "Assembly" },
  { id: "bat",        label: "Batch (Windows)" },
  { id: "c",          label: "C" },
  { id: "cbl",        label: "COBOL" },
  { id: "clj",        label: "Clojure" },
  { id: "cmake",      label: "CMake" },
  { id: "coffee",     label: "CoffeeScript" },
  { id: "cpp",        label: "C++" },
  { id: "cs",         label: "C#" },
  { id: "css",        label: "CSS" },
  { id: "csv",        label: "CSV" },
  { id: "dart",       label: "Dart" },
  { id: "dm",         label: "DM" },
  { id: "dockerfile", label: "Dockerfile" },
  { id: "erl",        label: "Erlang" },
  { id: "ex",         label: "Elixir" },
  { id: "f90",        label: "Fortran" },
  { id: "go",         label: "Go" },
  { id: "groovy",     label: "Groovy" },
  { id: "hs",         label: "Haskell" },
  { id: "html",       label: "HTML" },
  { id: "ini",        label: "INI / Config" },
  { id: "java",       label: "Java" },
  { id: "jl",         label: "Julia" },
  { id: "js",         label: "JavaScript" },
  { id: "json",       label: "JSON" },
  { id: "kt",         label: "Kotlin" },
  { id: "lisp",       label: "Lisp" },
  { id: "lua",        label: "Lua" },
  { id: "makefile",   label: "Makefile" },
  { id: "matlab",     label: "MATLAB" },
  { id: "md",         label: "Markdown" },
  { id: "ml",         label: "OCaml" },
  { id: "mm",         label: "Objective-C" },
  { id: "pas",        label: "Pascal" },
  { id: "php",        label: "PHP" },
  { id: "pm",         label: "Perl" },
  { id: "prolog",     label: "Prolog" },
  { id: "ps1",        label: "PowerShell" },
  { id: "py",         label: "Python" },
  { id: "r",          label: "R" },
  { id: "rb",         label: "Ruby" },
  { id: "rs",         label: "Rust" },
  { id: "scala",      label: "Scala" },
  { id: "sh",         label: "Shell / Bash" },
  { id: "sql",        label: "SQL" },
  { id: "swift",      label: "Swift" },
  { id: "tex",        label: "LaTeX" },
  { id: "toml",       label: "TOML" },
  { id: "ts",         label: "TypeScript" },
  { id: "v",          label: "V / Verilog" },
  { id: "vba",        label: "VBA" },
  { id: "xml",        label: "XML" },
  { id: "yaml",       label: "YAML" },
];

/**
 * Sensible defaults for macOS/Linux users:
 * - Lower confidence threshold so short snippets can still be detected.
 * - Blacklist languages unlikely to appear in a personal knowledge base.
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  confidenceThreshold: 0.15,
  disabledLanguageIds: ["bat", "dm", "v", "csv", "pas", "cbl"],
};
