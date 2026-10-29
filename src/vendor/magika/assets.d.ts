// esbuild inlines .bin files as bytes (the "binary" loader in esbuild.config.mjs).
declare module "*.bin" {
  const bytes: Uint8Array;
  export default bytes;
}
