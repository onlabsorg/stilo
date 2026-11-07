import { chromeLauncher } from "@web/test-runner-chrome";

// What Vite does for `import text from "file.css?inline"`: the file as text.
const inlineCss = {
    name: "inline-css",
    resolveMimeType: (context) => (context.url.includes(".css?inline") ? "js" : undefined),
    transform(context) {
        if (context.url.includes(".css?inline")) {
            return { body: `export default ${JSON.stringify(context.body)};` };
        }
    },
};

// Tests run in a real browser (the locally installed Chrome), because cells
// are custom elements and Texl runs as WebAssembly.
export default {
    files: "test/**/*.test.js",
    nodeResolve: true,
    plugins: [inlineCss],
    // One file at a time: the tests check the focus and wait for animation
    // frames, which a page in a background tab does not get
    concurrency: 1,
    // Chrome's first launch on a fresh CI runner can take over 30 s, the
    // default of both Puppeteer's launch timeout and the runner's timeout for
    // the first test pages, which wait for the launch
    browsers: [
        chromeLauncher({ launchOptions: { headless: true, timeout: 120000 } }),
    ],
    browserStartTimeout: 180000,
};
