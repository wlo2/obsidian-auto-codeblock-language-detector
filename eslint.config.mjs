// eslint.config.mjs
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  // Same scope as Obsidian's community plugin scanner: only plugin source code. It skips build
  // output, *.cjs/*.mjs/*.cts/*.mts files (vendored code, its types, build scripts, config) and tests.
  { ignores: ["main.js", "**/*.{cjs,mjs,cts,mts}", "test/**"] },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
]);
