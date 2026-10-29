export interface PluginSettings {
  /** Language IDs that will never be emitted. */
  disabledLanguageIds: string[];
}

export interface LanguageDefinition {
  id: string;       // guesslang's ID for the first 54 (kept for saved settings; see MAGIKA_LABELS), else Magika's label
  label: string;    // human-readable name shown in the UI
}

/** The languages and formats that can be detected, with display names. */
export const ALL_LANGUAGES: LanguageDefinition[] = [
  { id: "asm",        label: "Assembly" },
  { id: "asp",        label: "ASP.NET" },
  { id: "autohotkey", label: "AutoHotkey" },
  { id: "autoit",     label: "AutoIt" },
  { id: "awk",        label: "Awk" },
  { id: "bat",        label: "Batch (Windows)" },
  { id: "bib",        label: "BibTeX" },
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
  { id: "diff",       label: "Diff / patch" },
  { id: "dm",         label: "DM" },
  { id: "dockerfile", label: "Dockerfile" },
  { id: "erb",        label: "ERB (Embedded Ruby)" },
  { id: "erl",        label: "Erlang" },
  { id: "ex",         label: "Elixir" },
  { id: "f90",        label: "Fortran" },
  { id: "go",         label: "Go" },
  { id: "groovy",     label: "Groovy" },
  { id: "handlebars", label: "Handlebars" },
  { id: "hcl",        label: "HCL / Terraform" },
  { id: "hs",         label: "Haskell" },
  { id: "htaccess",   label: "Apache config (.htaccess)" },
  { id: "html",       label: "HTML" },
  { id: "ignorefile", label: "Ignore file (.gitignore)" },
  { id: "ini",        label: "INI / Config" },
  { id: "java",       label: "Java" },
  { id: "jinja",      label: "Jinja" },
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
  { id: "po",         label: "Gettext PO" },
  { id: "prolog",     label: "Prolog" },
  { id: "proto",      label: "Protocol Buffers" },
  { id: "ps1",        label: "PowerShell" },
  { id: "py",         label: "Python" },
  { id: "r",          label: "R" },
  { id: "rb",         label: "Ruby" },
  { id: "rs",         label: "Rust" },
  { id: "rst",        label: "reStructuredText" },
  { id: "scala",      label: "Scala" },
  { id: "scss",       label: "SCSS" },
  { id: "sh",         label: "Shell / Bash" },
  { id: "smali",      label: "Smali" },
  { id: "solidity",   label: "Solidity" },
  { id: "sql",        label: "SQL" },
  { id: "swift",      label: "Swift" },
  { id: "tcl",        label: "Tcl" },
  { id: "tex",        label: "LaTeX" },
  { id: "textproto",  label: "Protobuf text format" },
  { id: "toml",       label: "TOML" },
  { id: "ts",         label: "TypeScript" },
  { id: "twig",       label: "Twig" },
  { id: "v",          label: "V / Verilog" },
  { id: "vba",        label: "VBA" },
  { id: "vhdl",       label: "VHDL" },
  { id: "vue",        label: "Vue" },
  { id: "xml",        label: "XML" },
  { id: "yaml",       label: "YAML" },
  { id: "yara",       label: "YARA" },
  { id: "zig",        label: "Zig" },
];

/**
 * Sensible defaults for macOS/Linux users: blacklist languages unlikely to appear in a
 * personal knowledge base.
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  disabledLanguageIds: [
    "asm", "bat", "cbl", "clj", "coffee", "csv", "dart", "dm",
    "erl", "ex", "f90", "go", "groovy", "ini", "jl", "kt",
    "lisp", "lua", "matlab", "md", "ml", "mm", "pas", "prolog",
    "tex", "toml", "v", "vba"
  ],
};

/**
 * Settings from the plugin's saved data. Picks known keys only, so the confidence threshold older
 * versions saved is dropped. Every version saved a list of strings; anything else (a hand-edited or
 * damaged data.json) falls back to the defaults instead of breaking detection and the toggles.
 */
export function parseSettings(saved: unknown): PluginSettings {
  const ids = (saved as { disabledLanguageIds?: unknown } | null)?.disabledLanguageIds;
  return {
    disabledLanguageIds: Array.isArray(ids) && ids.every((id): id is string => typeof id === "string")
      ? ids
      : DEFAULT_SETTINGS.disabledLanguageIds,
  };
}

/** A language's toggle is on when the language is not in the disabled list. */
export function isLanguageEnabled(disabledLanguageIds: readonly string[], id: string): boolean {
  return !disabledLanguageIds.includes(id);
}

/**
 * Returns a new disabled list with `id` turned on or off. It never changes the given array,
 * which may still be DEFAULT_SETTINGS' own list.
 */
export function setLanguageEnabled(disabledLanguageIds: readonly string[], id: string, enabled: boolean): string[] {
  const others = disabledLanguageIds.filter((disabledId) => disabledId !== id);
  return enabled ? others : [...others, id];
}
