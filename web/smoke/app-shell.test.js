// Smoke tests of the app shell: a few quick checks that the whole app starts
// and its main paths work at all, against a real `stilo serve` in a headless
// Chrome. Run with `npm run smoke` after `npm run build` (the server serves
// the built web app). Details are tested elsewhere: the editor in test/, the
// server and CLI in ../tests/.
//
// The server serves a copy of examples/, so saving changes nothing in the
// repository. STILO sets the command that runs the server (default:
// `uv run stilo`, at the repository root); CI sets it to the installed one.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const REPO = resolve(fileURLToPath(import.meta.url), "../../..");
const EDIT = "Smoke test: an edited line.";

let folder, server, browser, page, base;
/** Errors the page threw or logged; any one fails the test that saw it. */
const pageErrors = [];

/** A free TCP port on localhost. */
function freePort() {
    return new Promise((done, fail) => {
        const probe = createServer().listen(0, "127.0.0.1", () => {
            const { port } = probe.address();
            probe.close(() => done(port));
        });
        probe.on("error", fail);
    });
}

/** Waits until `url` answers, or fails after `ms`. */
async function waitForServer(url, ms = 30000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        if (server.exitCode !== null) throw new Error(`stilo serve exited with ${server.exitCode}`);
        try {
            if ((await fetch(url)).ok) return;
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`No answer from ${url} within ${ms} ms`);
}

before(async () => {
    try {
        await readFile(join(REPO, "src/stilo/web/index.html"));
    } catch {
        if (!process.env.STILO) throw new Error("No built web app: run `npm run build` first");
    }
    folder = await mkdtemp(join(tmpdir(), "stilo-smoke-"));
    await cp(join(REPO, "examples"), folder, { recursive: true });
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    const [command, ...args] = (process.env.STILO ?? "uv run stilo").split(" ");
    server = spawn(command, [...args, "serve", folder, "--port", String(port)], {
        cwd: REPO,
        stdio: ["ignore", "ignore", "inherit"],
    });
    await waitForServer(`${base}/_api/tree/`);

    const [chrome] = Launcher.getInstallations();
    if (!chrome) throw new Error("No local Chrome found");
    browser = await puppeteer.launch({ executablePath: chrome, headless: true, timeout: 120000 });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
        const url = message.location()?.url ?? "";
        // The browser asks for a favicon by itself; the app has none
        if (message.type() === "error" && !url.endsWith("/favicon.ico")) pageErrors.push(`${message.text()} ${url}`);
    });
    // Leaving with unsaved changes asks: that would be a failure, not a wait
    page.on("dialog", (dialog) => {
        pageErrors.push(`Unexpected dialog: ${dialog.message()}`);
        dialog.dismiss();
    });
});

after(async () => {
    await browser?.close();
    server?.kill();
    if (folder) await rm(folder, { recursive: true, force: true });
});

// -- helpers that run in the page --------------------------------------------

/** The text of the editor's rendered cells, once rendered, through shadow roots. */
async function renderedText() {
    return page.evaluate(async () => {
        const editor = document.querySelector("stilo-app")?.shadowRoot?.querySelector("texl-editor");
        if (!editor) return "";
        await editor.updateComplete;
        await editor.rendered;
        const texts = [];
        const walk = (root) => {
            for (const element of root.querySelectorAll("*")) {
                if (element.classList.contains("view")) texts.push(element.innerText);
                if (element.shadowRoot) walk(element.shadowRoot);
            }
        };
        walk(editor.shadowRoot);
        return texts.join("\n");
    });
}

/** Waits until the rendered document contains `text`. */
async function waitForText(text, timeout = 30000) {
    const end = Date.now() + timeout;
    let last = "";
    while (Date.now() < end) {
        last = await renderedText();
        if (last.includes(text)) return last;
        await new Promise((r) => setTimeout(r, 100));
    }
    assert.fail(`"${text}" not rendered within ${timeout} ms; rendered:\n${last.slice(0, 500)}`);
}

/** The errors of the open document's rendering (undefined values returned). */
const renderErrors = () =>
    page.evaluate(() => document.querySelector("stilo-app").shadowRoot.querySelector("texl-editor").errors.length);

const status = () =>
    page.evaluate(() => document.querySelector("stilo-app").shadowRoot.querySelector("top-bar").status);

/** Clicks the item of the navigation pane whose path is `path`. */
async function clickTreeItem(path) {
    const item = await page.waitForSelector(`stilo-app >>> nav-pane >>> .item[title="${path}"]`, { timeout: 10000 });
    await item.click();
}

function assertNoPageErrors() {
    assert.deepEqual(pageErrors.splice(0), [], "the page reported errors");
}

// -- the paths ---------------------------------------------------------------

test("opens a document and shows it rendered", async () => {
    await page.goto(`${base}/sample.texl`);
    // Text, and values that tags computed, an imported one among them
    const text = await waitForText("Beam check");
    assert.match(text, /Span: 6 m/);
    assert.match(text, /Section: IPE ?300/);
    assert.equal(await renderErrors(), 0);
    assertNoPageErrors();
});

test("edits a cell and saves it", async () => {
    // The first cell is selected: Enter edits it, Ctrl+Enter commits it
    await page.keyboard.press("Enter");
    await page.waitForSelector("stilo-app >>> texl-editor >>> .cm-content", { timeout: 10000 });
    await page.keyboard.down("Control");
    await page.keyboard.press("End");
    await page.keyboard.up("Control");
    await page.keyboard.type(`\n\n${EDIT}`);
    await page.keyboard.down("Control");
    await page.keyboard.press("Enter");
    await page.keyboard.up("Control");
    await waitForText(EDIT);

    await page.keyboard.down("Control");
    await page.keyboard.press("s");
    await page.keyboard.up("Control");
    await page.waitForFunction(
        () => document.querySelector("stilo-app").shadowRoot.querySelector("top-bar").status === "Saved",
        { timeout: 10000 },
    );
    assert.match(await readFile(join(folder, "sample.texl"), "utf8"), new RegExp(EDIT));
    assertNoPageErrors();
});

test("shows the saved change after a reload", async () => {
    await page.reload();
    await waitForText(EDIT);
    assert.equal(await status(), "");
    assertNoPageErrors();
});

test("opens another document from the navigation pane", async () => {
    // Folders start open; a click on a document opens it in the app
    await clickTreeItem("projects/beam/beam-check.texl");
    await page.waitForFunction(() => location.pathname === "/projects/beam/beam-check.texl", { timeout: 10000 });
    // Its figures come from the documents it imports, through the project home
    const text = await waitForText("Mezzanine floor beam");
    assert.match(text, /S355/);
    assert.equal(await renderErrors(), 0);
    assertNoPageErrors();
});
