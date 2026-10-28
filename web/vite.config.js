import { defineConfig } from "vite";

// The Python server; override with STILO_SERVER=http://host:port.
const SERVER = process.env.STILO_SERVER ?? "http://127.0.0.1:8000";

// `npm run dev` serves the app on :5173 and forwards to the Python server on
// :8000 the protocol (/_api) and the Texl files asked for by anything but a
// browser page (texl.import of a public URL, see docs/protocol.md).
// `npm run build` writes the app into the Python package, src/stilo/web,
// which the server serves itself: index.html for every page, the bundle under
// /_app/.
export default defineConfig(({ command }) => ({
    base: command === "build" ? "/_app/" : "/",
    // Pre-bundling would move texl_wasm.js away from its .wasm file, which it
    // loads by a URL relative to itself.
    optimizeDeps: {
        exclude: ["@onlabsorg/texl"],
    },
    build: {
        outDir: "../src/stilo/web",
        emptyOutDir: true,
        // Texl (WebAssembly glue) and CodeMirror make one large bundle; fine for now.
        chunkSizeWarningLimit: 1000,
    },
    server: {
        proxy: {
            "/_api": SERVER,
            "^/.*\\.texl$": {
                target: SERVER,
                bypass: (req) => (req.headers.accept?.includes("text/html") ? req.url : undefined),
            },
        },
    },
}));
