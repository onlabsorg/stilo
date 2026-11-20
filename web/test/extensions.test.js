import { expect, fixture, html } from "@open-wc/testing";
import { createStilo, API_VERSION, compatible, Registry } from "../src/core/index.js";
import "../src/components/top-bar.js";
import "../src/components/commands-pane.js";
import { activateBuiltins } from "../src/builtins/index.js";
import { startStilo } from "../src/start.js";

/** The services, Stilo's own contributions activated, with the console's
 * errors and the status kept. */
function setUp() {
    const stilo = createStilo({ transport: { readTree: async () => ({ path: "", name: "", type: "folder", children: [] }) } });
    activateBuiltins(stilo);
    const errors = [];
    const consoleError = console.error;
    console.error = (...args) => errors.push(args[0]);
    return { stilo, errors, restore: () => (console.error = consoleError) };
}

describe("extensions", () => {
    let env;
    beforeEach(() => (env = setUp()));
    afterEach(() => env.restore());

    it("accepts the same major version and a minor version up to this one", () => {
        expect(API_VERSION).to.equal("1.0");
        expect(compatible("1")).to.be.true;
        expect(compatible("1.0")).to.be.true;
        expect(compatible("1.1")).to.be.false;
        expect(compatible("2.0")).to.be.false;
        expect(compatible(undefined)).to.be.false;
    });

    it("activate an extension with a stilo object complete on its own", async () => {
        const { stilo } = env;
        let given;
        const ok = await stilo.extensions.activate({ id: "word-count", apiVersion: "1.0", activate: (s) => (given = s) });
        expect(ok).to.be.true;
        expect(stilo.extensions.list().map((e) => e.id)).to.deep.equal(["word-count"]);
        for (const name of ["html", "css", "svg", "LitElement", "StiloController", "TexlCell", "styles", "apiVersion", "commands", "keys", "menus", "panels", "topBar", "status", "views", "document", "editor", "comments", "errors", "tree", "transport", "ui", "settings", "cells", "router", "extensions"])
            expect(given[name], name).to.exist;
        // The same services: what it registers is there for everyone
        given.commands.register({ id: "word-count.count", label: "Count words", group: "Document", run: () => 7 });
        expect(stilo.commands.run("word-count.count")).to.equal(7);
        expect(given.document.path).to.equal(stilo.document.path);
    });

    it("refuse ids of commands and panels outside the extension's own", async () => {
        const { stilo, errors } = env;
        const ok = await stilo.extensions.activate({
            id: "bad",
            apiVersion: "1",
            activate: (s) => s.commands.register({ id: "save-all", label: "Save all", group: "File" }),
        });
        expect(ok).to.be.false;
        expect(stilo.commands.get("save-all")).to.be.undefined;
        expect(stilo.extensions.failures[0].id).to.equal("bad");
        expect(errors[0]).to.contain('"bad" was not activated');
    });

    it("skip an extension whose activate throws, undoing what it registered, and go on", async () => {
        const { stilo } = env;
        const ok = await stilo.extensions.activate({
            id: "broken",
            apiVersion: "1.0",
            activate(s) {
                s.commands.register({ id: "broken.one", label: "One", group: "File" });
                s.keys.bind("Alt+Q", "broken.one");
                throw new Error("boom");
            },
        });
        expect(ok).to.be.false;
        expect(stilo.commands.get("broken.one")).to.be.undefined;
        expect(stilo.keys.keysFor("broken.one")).to.not.be.ok;
        expect(stilo.extensions.list()).to.deep.equal([]);
        expect(stilo.extensions.failures[0].reason).to.contain("boom");
        expect(stilo.ui.status).to.contain("broken");
        expect(await stilo.extensions.activate({ id: "fine", apiVersion: "1", activate() {} })).to.be.true;
    });

    it("skip an extension written for another API version, a bad id, a taken id, or no activate", async () => {
        const { stilo } = env;
        const activate = () => {};
        expect(await stilo.extensions.activate({ id: "old", apiVersion: "0.9", activate })).to.be.false;
        expect(await stilo.extensions.activate({ id: "Bad.Id", apiVersion: "1", activate })).to.be.false;
        expect(await stilo.extensions.activate({ id: "twice", apiVersion: "1", activate })).to.be.true;
        expect(await stilo.extensions.activate({ id: "twice", apiVersion: "1", activate })).to.be.false;
        expect(await stilo.extensions.activate({ id: "nothing", apiVersion: "1" })).to.be.false;
        expect(stilo.extensions.failures.map((f) => f.id)).to.deep.equal(["old", "Bad.Id", "twice", "nothing"]);
    });

    it("undo every registration on deactivate, also the ones the extension forgot", async () => {
        const { stilo } = env;
        let deactivated = 0;
        let edits = 0;
        await stilo.extensions.activate({
            id: "count",
            apiVersion: "1.0",
            activate(s) {
                s.commands.register({ id: "count.run", label: "Run", group: "File", run() {} });
                s.keys.bind("Alt+Q", "count.run");
                s.menus.add("tree/document", "count.run");
                s.panels.register({ id: "count.panel", label: "Count", icon: "", render: () => "" });
                s.editor.on("edit", () => edits++);
                // Disposed by the extension itself: not undone twice
                s.commands.register({ id: "count.gone", label: "Gone", group: "File" })();
            },
            deactivate: () => deactivated++,
        });
        expect(stilo.menus.items("tree/document")).to.include("count.run");
        stilo.editor.emit("edit");
        stilo.extensions.deactivate("count");
        stilo.editor.emit("edit");
        expect(deactivated).to.equal(1);
        expect(edits).to.equal(1);
        expect(stilo.commands.get("count.run")).to.be.undefined;
        expect(stilo.keys.keysFor("count.run")).to.not.be.ok;
        expect(stilo.menus.items("tree/document")).to.not.include("count.run");
        expect(stilo.panels.get("count.panel")).to.be.undefined;
        expect(stilo.extensions.list()).to.deep.equal([]);
        // Stilo's own are still there
        expect(stilo.commands.get("save")).to.exist;
    });

    it("take away an extension's badges on Stilo's panels on deactivate, keeping one record per panel", async () => {
        const { stilo } = env;
        await stilo.extensions.activate({
            id: "issues",
            apiVersion: "1.0",
            activate(s) {
                for (let n = 1; n <= 50; n++) s.panels.setBadge("comments", { text: String(n) });
            },
        });
        expect(stilo.panels.badge("comments").text).to.equal("50");
        // One record for the 50 calls: the scope does not grow with them
        expect(stilo.extensions._active.get("issues").scope.disposers.size).to.equal(1);
        stilo.extensions.deactivate("issues");
        expect(stilo.panels.badge("comments")).to.equal(undefined);
        // A badge Stilo set since stays
        await stilo.extensions.activate({ id: "again", apiVersion: "1.0", activate: (s) => s.panels.setBadge("errors", { text: "x" }) });
        stilo.panels.setBadge("errors", { text: "2", label: "2 errors" });
        stilo.extensions.deactivate("again");
        expect(stilo.panels.badge("errors").text).to.equal("2");
    });
});

describe("startStilo", () => {
    it("puts an app in the target, with Stilo's own contributions, then the extensions", async () => {
        const target = document.createElement("div");
        document.body.append(target);
        const order = [];
        const transport = {
            readTree: async () => ({ path: "", name: "", type: "folder", children: [] }),
            documentUrl: (path) => `/${path}`,
        };
        const consoleError = console.error;
        console.error = () => {};
        try {
            const app = await startStilo({
                target,
                transport,
                extensions: [
                    { id: "first", apiVersion: "1", activate: (s) => order.push(["first", !!s.commands.get("save")]) },
                    { id: "broken", apiVersion: "1", activate: () => { throw new Error("no"); } },
                    { id: "second", apiVersion: "1", activate: () => order.push(["second"]) },
                ],
            });
            expect(app.localName).to.equal("stilo-app");
            expect(app.parentNode).to.equal(target);
            expect(app.stilo.transport).to.equal(transport);
            expect(order).to.deep.equal([["first", true], ["second"]]);
            expect(app.stilo.extensions.list().map((e) => e.id)).to.deep.equal(["first", "second"]);
            await app.updateComplete;
            expect(app.shadowRoot.querySelector("top-bar")).to.exist;
        } finally {
            console.error = consoleError;
            target.remove();
        }
    });
});

describe("startStilo and the server's info", () => {
    it("reads the info before the extensions, so activate can ask it, and only once", async () => {
        const target = document.createElement("div");
        document.body.append(target);
        let reads = 0;
        const seen = [];
        const transport = {
            readTree: async () => ({ path: "", name: "", type: "folder", children: [] }),
            documentUrl: (path) => `/${path}`,
            info: async () => (reads++, { protocol: 1, capabilities: ["files"], extensions: [{ id: "history" }] }),
        };
        try {
            const app = await startStilo({
                target,
                transport,
                extensions: [{ id: "history", apiVersion: "1", activate: (s) => seen.push([s.info.hasExtension("history"), s.info.has("move")]) }],
            });
            await app.updateComplete;
            expect(seen).to.deep.equal([[true, false]]);
            expect(reads).to.equal(1);
        } finally {
            target.remove();
        }
    });
});

describe("registries: panels, topBar, status", () => {
    it("list items by order, refuse a taken id, and replace one until disposed", () => {
        const registry = new Registry();
        registry.register({ id: "b", order: 20 });
        const disposeA = registry.register({ id: "a", order: 10, label: "A" });
        expect(() => registry.register({ id: "a" })).to.throw();
        expect(() => registry.replace("none", {})).to.throw();
        const undo = registry.replace("a", { id: "other", order: 10, label: "A2" });
        expect(registry.get("a").label).to.equal("A2");
        expect(registry.list().map((i) => i.id)).to.deep.equal(["a", "b"]);
        undo();
        expect(registry.get("a").label).to.equal("A");
        // Disposing the original under a replacement keeps the replacement
        const undo2 = registry.replace("a", { label: "A3" });
        disposeA();
        expect(registry.get("a").label).to.equal("A3");
        undo2();
        expect(registry.get("a")).to.be.undefined;
        expect(registry.list().map((i) => i.id)).to.deep.equal(["b"]);
    });

    it("let an extension replace a built-in panel, and bring it back on deactivate", async () => {
        const { stilo, restore } = setUp();
        try {
            const original = stilo.panels.get("comments");
            await stilo.extensions.activate({
                id: "notes",
                apiVersion: "1",
                activate: (s) => s.panels.replace("comments", { label: "Notes", icon: "", order: 20, render: () => "notes" }),
            });
            expect(stilo.panels.get("comments").label).to.equal("Notes");
            stilo.extensions.deactivate("notes");
            expect(stilo.panels.get("comments")).to.equal(original);
        } finally {
            restore();
        }
    });

    it("show top-bar items left of the panels' buttons", async () => {
        const stilo = createStilo();
        stilo.panels.register({ id: "x.panel", label: "Panel", icon: "P", render: () => "" });
        stilo.topBar.register({ id: "x.late", order: 2, render: () => html`<b>late</b>` });
        stilo.topBar.register({ id: "x.user", order: 1, render: () => "Ada" });
        const el = await fixture(html`<stilo-provider .stilo=${stilo}><top-bar></top-bar></stilo-provider>`);
        const bar = el.querySelector("top-bar");
        await bar.updateComplete;
        const right = bar.renderRoot.querySelector(".right");
        expect([...right.querySelectorAll(".item")].map((i) => i.textContent.trim())).to.deep.equal(["Ada", "late"]);
        expect(right.lastElementChild.getAttribute("aria-label")).to.equal("Panel");
    });

    it("show the status line only while it has items", async () => {
        const target = document.createElement("div");
        document.body.append(target);
        const transport = { readTree: async () => ({ path: "", name: "", type: "folder", children: [] }), documentUrl: (p) => `/${p}` };
        try {
            const app = await startStilo({ target, transport });
            await app.updateComplete;
            expect(app.shadowRoot.querySelector("footer")).to.be.null;
            let words = 3;
            const dispose = app.stilo.status.register({ id: "x.words", render: () => `${words} words` });
            await app.updateComplete;
            expect(app.shadowRoot.querySelector("footer").textContent.trim()).to.equal("3 words");
            words = 4;
            app.stilo.status.changed();
            await app.updateComplete;
            expect(app.shadowRoot.querySelector("footer").textContent.trim()).to.equal("4 words");
            dispose();
            await app.updateComplete;
            expect(app.shadowRoot.querySelector("footer")).to.be.null;
        } finally {
            target.remove();
        }
    });

    it("lay out a panel of several elements from the top of the pane, and one element filling it", async () => {
        const target = document.createElement("div");
        target.style.height = "600px";
        document.body.append(target);
        const transport = { readTree: async () => ({ path: "", name: "", type: "folder", children: [] }), documentUrl: (p) => `/${p}` };
        try {
            const app = await startStilo({ target, transport });
            const { panels, ui } = app.stilo;
            // As the first extension in docs/extensions.md: a header, then a paragraph
            panels.register({ id: "x.two", label: "Two", icon: "2", render: () => html`<div class="pane-header">Two</div><p class="two">Text</p>` });
            panels.register({ id: "x.one", label: "One", icon: "1", render: () => html`<div class="one">All</div>` });
            ui.openPane("x.two");
            await app.updateComplete;
            const aside = app.shadowRoot.querySelector("aside");
            const header = aside.querySelector(".pane-header");
            const top = aside.getBoundingClientRect().top;
            expect(header.getBoundingClientRect().top - top).to.be.below(2);
            // The header keeps its height, and the paragraph comes right after it, not halfway down
            expect(header.getBoundingClientRect().height).to.be.below(60);
            expect(aside.querySelector(".two").getBoundingClientRect().top - top).to.be.below(100);
            ui.openPane("x.one");
            await app.updateComplete;
            const one = app.shadowRoot.querySelector("aside .one");
            expect(Math.abs(one.getBoundingClientRect().height - aside.clientHeight)).to.be.below(2);
        } finally {
            target.remove();
        }
    });
});

describe("the commands pane's Extensions group", () => {
    it("shows only while an extension is active or failed, the failed ones with why", async () => {
        const { stilo, restore } = setUp();
        try {
            const el = await fixture(html`<stilo-provider .stilo=${stilo}><commands-pane></commands-pane></stilo-provider>`);
            const pane = el.querySelector("commands-pane");
            await pane.updateComplete;
            expect(pane.renderRoot.querySelector("h3.extensions")).to.be.null;
            await stilo.extensions.activate({ id: "word-count", apiVersion: "1", activate() {} });
            await stilo.extensions.activate({ id: "broken", apiVersion: "2", activate() {} });
            await pane.updateComplete;
            expect(pane.renderRoot.querySelector("h3.extensions")).to.exist;
            const rows = [...pane.renderRoot.querySelectorAll(".extension")];
            expect(rows.map((r) => r.textContent.trim())).to.deep.equal(["word-count", "broken: not activated"]);
            expect(rows[1].title).to.contain("API version 2");
        } finally {
            restore();
        }
    });
});

describe("transport middleware and loader", () => {
    it("send every request through the middleware, the last added outermost, until disposed", async () => {
        const { Transport } = await import("../src/api.js");
        const transport = new Transport({ origin: "https://example.com" });
        const seen = [];
        const realFetch = window.fetch;
        window.fetch = async (url, init) => {
            seen.push(["fetch", url, init?.headers?.Authorization]);
            return new Response("<% x = 1 %>", { status: 200 });
        };
        try {
            const disposeAuth = transport.use((url, init, next) => {
                seen.push(["auth"]);
                return next(url, { ...init, headers: { ...init?.headers, Authorization: "Bearer t" } });
            });
            transport.use(async (url, init, next) => {
                seen.push(["log"]);
                return next(url, init);
            });
            const { source } = await transport.loader("https://example.com/a.texl");
            expect(source).to.equal("<% x = 1 %>");
            expect(seen).to.deep.equal([["log"], ["auth"], ["fetch", "https://example.com/a.texl", "Bearer t"]]);
            seen.length = 0;
            disposeAuth();
            await transport.readFile("a.texl");
            expect(seen.map((s) => s[0])).to.deep.equal(["log", "fetch"]);
            // A middleware may answer itself, e.g. a 401
            transport.use(async () => new Response(JSON.stringify({ error: "sign in" }), { status: 401 }));
            let error;
            await transport.readFile("a.texl").catch((e) => (error = e));
            expect(error.status).to.equal(401);
        } finally {
            window.fetch = realFetch;
        }
    });

    it("undo an extension's middleware on deactivate", async () => {
        const { Transport } = await import("../src/api.js");
        const stilo = createStilo({ transport: new Transport({ origin: "https://example.com" }) });
        await stilo.extensions.activate({ id: "auth", apiVersion: "1", activate: (s) => s.transport.use((u, i, next) => next(u, i)) });
        expect(stilo.transport._middleware.length).to.equal(1);
        stilo.extensions.deactivate("auth");
        expect(stilo.transport._middleware.length).to.equal(0);
    });
});
