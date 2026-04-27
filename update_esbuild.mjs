import fs from 'fs';
let content = fs.readFileSync('esbuild.config.mjs', 'utf8');
content = `import builtins from "builtin-modules";\n` + content;
content = content.replace(/external:\s*\["obsidian",\s*"electron"\]/, 'external: ["obsidian", "electron", ...builtins]');
fs.writeFileSync('esbuild.config.mjs', content);
