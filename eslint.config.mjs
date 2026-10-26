// eslint.config.mjs
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  // Same scope as Obsidian's community plugin scanner: only plugin source code.
  // Build output, vendored code, build scripts, config files and tests are skipped.
  { ignores: ["main.js", "**/*.cjs", "**/*.mjs", "test/**"] },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
]);
