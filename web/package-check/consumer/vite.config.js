// The configuration docs/component/guide.md gives to a project that uses
// @onlabsorg/stilo-web: Texl's WebAssembly glue loads its .wasm file by a URL
// relative to itself, which pre-bundling would break.
import { defineConfig } from "vite";

export default defineConfig({
    optimizeDeps: {
        exclude: ["@onlabsorg/texl"],
    },
});
