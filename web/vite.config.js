import { defineConfig } from "vite";

// The Python server; override with STILO_SERVER=http://host:port.
const SERVER = process.env.STILO_SERVER ?? "http://127.0.0.1:8000";

// KaTeX's styles offer each font in three formats. Every browser Stilo runs in
// takes the first, so the build need not carry the other two.
const katexWoff2Only = {
    name: "katex-woff2-only",
    enforce: "pre",
    transform(code, id) {
        if (!id.includes("katex/dist/katex.min.css")) return null;
        return code.replace(/,url\([^)]*\.(?:woff|ttf)\) format\("[a-z]+"\)/g, "");
    },
};

// `npm run dev` serves the app on :5173 and forwards to the Python server on
// :8000 the protocol (/_api) and the public URLs of files: everything with an
// extension outside Vite's own paths, except the .texl pages a browser asks
// for, which are the app (see docs/protocol.md).
// `npm run build` writes the app into the Python package, src/stilo/web,
// which the server serves itself: index.html for every page, the bundle under
// /_app/.
export default defineConfig(({ command }) => ({
    base: command === "build" ? "/_app/" : "/",
    plugins: [katexWoff2Only],
    // Pre-bundling would move texl_wasm.js away from its .wasm file, which it
    // loads by a URL relative to itself.
    optimizeDeps: {
        exclude: ["@onlabsorg/texl"],
    },
    build: {
        outDir: "../src/stilo/web",
        emptyOutDir: true,
        // Texl (WebAssembly glue), CodeMirror and KaTeX make one large bundle; fine for now.
        chunkSizeWarningLimit: 1200,
    },
    server: {
        proxy: {
            "/_api": SERVER,
            "^/(?!src/|node_modules/|@)[^?]*\\.[^/?]+(\\?.*)?$": {
                target: SERVER,
                bypass: (req) =>
                    req.headers.accept?.includes("text/html") && req.url.split("?")[0].endsWith(".texl")
                        ? req.url
                        : undefined,
            },
        },
    },
}));
