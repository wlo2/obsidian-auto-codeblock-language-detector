import { builtinModules } from "node:module";
import esbuild from "esbuild";

const isProduction = process.argv[2] === "production";

const buildOptions = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", ...builtinModules],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: isProduction ? false : "inline",
  minify: isProduction,
  outfile: "main.js"
};

if (isProduction) {
  await esbuild.build(buildOptions);
} else {
  const context = await esbuild.context(buildOptions);
  await context.watch();
}
