// Checks the npm package @onlabsorg/stilo-web as a consumer gets it: packs it,
// installs the tarball in a copy of ./consumer (a small Vite project), builds
// that, and checks that the build has the app, the Texl WebAssembly module and
// the document font. Run with `npm run check-package` in web/.
//
// The tarball goes to the folder given with --out=<folder>, so the release can
// publish exactly what was checked; without it, it is removed with the rest.
// --keep leaves the temporary folder (the consumer project) and prints its path.

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(web, "package.json"), "utf8"));
const keep = process.argv.includes("--keep");
const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6);
const outDir = out ? resolve(out) : null;

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });
const fail = (message) => {
    console.error(`package check failed: ${message}`);
    process.exit(1);
};

const work = mkdtempSync(join(tmpdir(), "stilo-web-check-"));
if (outDir) mkdirSync(outDir, { recursive: true });
try {
    // 1. Pack, as `npm publish` would
    const packed = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", outDir ?? work], web))[0];
    const tarball = join(outDir ?? work, packed.filename);
    const files = packed.files.map((f) => f.path);
    for (const needed of ["package.json", "LICENSE", "README.md", "src/main.js", "src/editor/index.js", "src/theme.css"])
        if (!files.includes(needed)) fail(`the package lacks ${needed}`);
    const stray = files.filter((f) => !/^(package\.json|LICENSE|README\.md|src\/.*)$/.test(f));
    if (stray.length) fail(`the package has files outside src/: ${stray.join(", ")}`);

    // 2. Install it in a fresh consumer project, with the same Vite as here
    const app = join(work, "consumer");
    cpSync(fileURLToPath(new URL("consumer", import.meta.url)), app, { recursive: true });
    writeFileSync(
        join(app, "package.json"),
        JSON.stringify({ name: "stilo-web-consumer", private: true, type: "module" }, null, 2),
    );
    run("npm", ["install", "--no-audit", "--no-fund", tarball, `vite@${pkg.devDependencies.vite}`], app);

    // 3. Build it
    run("npx", ["vite", "build"], app);
    const assets = readdirSync(join(app, "dist", "assets"));
    for (const [what, pattern] of [
        ["the app's script", /\.js$/],
        ["the Texl WebAssembly module", /\.wasm$/],
        ["the document font", /atkinson-hyperlegible-next.*\.woff2$/],
    ])
        if (!assets.some((name) => pattern.test(name))) fail(`the build lacks ${what} (assets: ${assets.join(", ")})`);

    console.log(`package check passed: ${packed.filename}, ${files.length} files, ${(packed.size / 1024).toFixed(0)} kB`);
    console.log(`tarball: ${tarball}`);
} finally {
    if (keep) console.log(`kept: ${work}`);
    else rmSync(work, { recursive: true, force: true });
}
