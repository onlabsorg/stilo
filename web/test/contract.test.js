// The contract of the extension API (S17, docs/extensions.md): one extension
// that uses every hook, through the `stilo` object alone, in a real app. A
// change that breaks a hook breaks this test.

import { expect } from "@open-wc/testing";
import { startStilo } from "../src/start.js";
import { Transport } from "../src/api.js";

const DOC = `<!--{ aaaa : text }-->
One
<!--[ In the file ]-->
<!--{ bbbb : text }-->
Two
`;
const TREE = {
    name: "",
    path: "",
    type: "folder",
    children: [
        { name: "doc.texl", path: "doc.texl", type: "file" },
        { name: "hidden.texl", path: "hidden.texl", type: "file" },
        { name: "references", path: "references", type: "folder", children: [{ name: "x.texl", path: "references/x.texl", type: "file" }] },
    ],
};

/** What the extension saw and did, for the test to check. */
const seen = { requests: [], opened: [], edits: 0, deactivated: 0, selections: [], onCell: [] };

/** The extension: it imports nothing from Stilo. */
const contract = {
    id: "contract",
    apiVersion: "1.0",
    activate(stilo) {
        const { html, css, LitElement, StiloController, styles } = stilo;

        // An element of its own, following the services by context
        class Counter extends LitElement {
            static styles = [styles.base, css`:host { color: var(--text-muted); }`];
            constructor() {
                super();
                this._stilo = new StiloController(this, (s) => [s.document]);
            }
            render() {
                return html`open: ${this._stilo.stilo?.document.path ?? "none"}`;
            }
        }
        if (!customElements.get("contract-counter")) customElements.define("contract-counter", Counter);

        // Commands, keys, menus
        stilo.commands.register({
            id: "contract.ask",
            label: "Ask",
            group: "Contract",
            run: () => stilo.ui.dialog((close) => html`<button class="yes" @click=${() => close("yes")}>Yes</button>`),
            enabled: () => (stilo.document.path ? true : "no document"),
        });
        stilo.keys.bind("Alt+Shift+K", "contract.ask");
        stilo.menus.add("tree/document", "contract.ask", { group: "contract" });
        // A command on the cell a menu opened on, read-only documents too
        stilo.commands.register({
            id: "contract.on-cell",
            label: "On this cell",
            group: "Contract",
            run: (s, context) => seen.onCell.push({ ...context, selection: stilo.editor.selection }),
            enabled: (s, { cell } = {}) => (cell === undefined || cell ? true : "the line has no name"),
        });
        stilo.menus.add("editor/cell", "contract.on-cell", { group: "contract" });

        // Visible contributions
        stilo.panels.register({ id: "contract.panel", label: "Contract", icon: html`C`, order: 40, render: () => html`<p class="contract-panel">Panel</p>` });
        stilo.panels.setBadge("contract.panel", { text: "1", label: "1 thing" });
        stilo.panels.setBadge("comments", { text: "7", label: "7 issues" });
        stilo.panels.replace("commands", { label: "Other commands", icon: html`X`, order: 10, render: () => html`<p>Replaced</p>` });
        stilo.topBar.register({ id: "contract.user", render: () => html`<span class="contract-user">Ada</span>` });
        stilo.topBar.setBrand(() => html`<a class="contract-brand" href="/" title="Contract home">Contract</a>`);
        stilo.status.register({ id: "contract.counter", render: () => html`<contract-counter></contract-counter>` });
        stilo.views.register({ id: "contract.page", label: "Contract page", render: (s, params) => html`<p class="contract-view">Page ${params.n}</p>` });

        // The tree
        stilo.tree.decorate((node) => (node.path === "doc.texl" ? { badge: "M", tone: "warning", tooltip: "Changed" } : null));
        stilo.tree.filter((node) => node.path !== "hidden.texl");
        stilo.tree.readOnly((path) => (path === "references" || path.startsWith("references/") ? "a reference" : null));

        // The editor
        stilo.editor.decorate(({ cells }) => cells.filter((c) => c.texl.includes("Two")).map((c) => ({ cell: c.name, text: "Check", tone: "danger" })));

        // The transport
        stilo.transport.use((url, init, next) => {
            seen.requests.push(String(url));
            return next(url, init);
        });

        // The server's info
        seen.info = stilo.info;

        // Events and settings
        stilo.document.on("open", ({ path }) => seen.opened.push(path));
        stilo.editor.on("edit", () => seen.edits++);
        stilo.editor.on("selection-change", (selection) => seen.selections.push(selection));
        stilo.settings.set("runs", (stilo.settings.get("runs", 0) ?? 0) + 1);

        // A cell type
        class NoteCell extends stilo.TexlCell {
            static type = "contract-note";
            static label = "Note";
            static key = "n";
        }
        stilo.cells.register(NoteCell);
    },
    deactivate() {
        seen.deactivated++;
    },
};

/** A fake server behind the page's own fetch. */
function serve() {
    const realFetch = window.fetch;
    window.fetch = async (url, init) => {
        const path = new URL(url, location.href).pathname;
        if (!path.startsWith("/_api/")) return realFetch(url, init);
        if (path === "/_api/info") return new Response(JSON.stringify({ protocol: 1, server: { name: "test" }, capabilities: ["files", "tree", "folders", "move", "rewrite"], extensions: [{ id: "contract" }] }), { status: 200 });
        if (path.startsWith("/_api/files/") && init?.method === "PUT") return new Response(null, { status: 200, headers: { ETag: '"f"' } });
        if (path.startsWith("/_api/files/")) return new Response(DOC, { status: 200, headers: { ETag: '"e"' } });
        if (path.startsWith("/_api/tree")) return new Response(JSON.stringify(TREE), { status: 200 });
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    };
    return () => (window.fetch = realFetch);
}

const shadow = (el, selector) => el.shadowRoot.querySelector(selector);

describe("the extension API contract", () => {
    let restore, target, app, stilo;
    before(async () => {
        localStorage.removeItem("stilo.ext.contract.runs");
        restore = serve();
        target = document.createElement("div");
        document.body.append(target);
        app = await startStilo({ target, transport: new Transport(), extensions: [contract] });
        stilo = app.stilo;
        await stilo.router.apply({ root: "", doc: "doc.texl" });
        await stilo.tree.refresh();
        await new Promise((resolve) => setTimeout(resolve, 50));
        await app.updateComplete;
    });
    after(() => {
        target.remove();
        restore();
        localStorage.removeItem("stilo.ext.contract.runs");
    });

    it("is active, and listed in the commands pane", async () => {
        expect(stilo.extensions.list().map((e) => e.id)).to.deep.equal(["contract"]);
        stilo.ui.openPane("commands");
        await app.updateComplete;
        // The commands panel is the extension's replacement
        expect(shadow(app, "aside").textContent).to.contain("Replaced");
    });

    it("adds commands, keys and menu entries, which say when they do not apply", () => {
        expect(stilo.commands.get("contract.ask").label).to.equal("Ask");
        expect(stilo.keys.keysFor("contract.ask")).to.equal("Alt+Shift+K");
        expect(stilo.menus.items("tree/document")).to.include("contract.ask");
        expect(stilo.commands.disabledReason("contract.ask")).to.be.null;
    });

    it("shows dialogs", async () => {
        const answer = stilo.commands.run("contract.ask");
        await app.updateComplete;
        const dialog = shadow(app, "stilo-dialog");
        await dialog.updateComplete;
        dialog.shadowRoot.querySelector("button.yes").click();
        expect(await answer).to.equal("yes");
    });

    it("adds a panel with a badge in the rail, a top-bar item, a brand and a status item that follows the services", async () => {
        const bar = shadow(app, "top-bar");
        await bar.updateComplete;
        expect(bar.renderRoot.querySelector(".contract-user").textContent).to.equal("Ada");
        expect(bar.renderRoot.querySelector(".brand .contract-brand").textContent).to.equal("Contract");
        const rail = shadow(app, "panel-rail");
        await rail.updateComplete;
        expect([...rail.renderRoot.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).to.include("1 thing");
        const counter = shadow(app, "footer contract-counter");
        await counter.updateComplete;
        expect(counter.shadowRoot.textContent.trim()).to.equal("open: doc.texl");
    });

    it("decorates, filters and locks tree items", async () => {
        const pane = shadow(app, "nav-pane");
        await pane.updateComplete;
        const names = [...pane.renderRoot.querySelectorAll(".name")].map((n) => n.textContent);
        expect(names).to.not.include("hidden");
        expect(pane.renderRoot.querySelector(".badge.warning").textContent).to.equal("M");
        expect(stilo.tree.readOnlyReason("references/x.texl")).to.equal("a reference");
        expect(stilo.commands.disabledReason("tree-delete", { node: TREE.children[2] })).to.equal("a reference");
    });

    it("marks cells and hears the document's events", async () => {
        const editor = shadow(app, "texl-editor");
        expect(editor.marks).to.deep.equal({ bbbb: [{ cell: "bbbb", text: "Check", tone: "danger" }] });
        expect(seen.opened).to.include("doc.texl");
        editor.dispatchEvent(new CustomEvent("change"));
        expect(seen.edits).to.equal(1);
    });

    it("gets the document as rendered", async () => {
        const rendered = await stilo.editor.renderedHtml();
        expect(rendered).to.contain('data-cell="aaaa"');
        expect(rendered).to.contain("Two");
    });

    it("knows which cell is selected", async () => {
        expect(stilo.editor.selection).to.deep.equal({ path: "doc.texl", line: 1, cell: "aaaa" });
        const editor = shadow(app, "texl-editor");
        editor.select(2);
        await editor.updateComplete;
        expect(stilo.editor.selection).to.deep.equal({ path: "doc.texl", line: 2, cell: "bbbb" });
        expect(seen.selections.at(-1)).to.deep.equal({ line: 2, cell: "bbbb" });
    });

    it("puts a command in the menu on a cell, which runs on that cell", async () => {
        const editor = shadow(app, "texl-editor");
        const cell = editor.shadowRoot.querySelector('[data-index="0"]');
        const ask = new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true, clientX: 30, clientY: 40 });
        cell.dispatchEvent(ask);
        expect(ask.defaultPrevented).to.be.true;
        await app.updateComplete;
        const menu = shadow(app, "context-menu");
        await menu.updateComplete;
        const labels = [...menu.shadowRoot.querySelectorAll("button .label")].map((b) => b.textContent);
        expect(labels).to.include("On this cell");
        expect(labels).to.include("Edit the selected cell");
        [...menu.shadowRoot.querySelectorAll("button")].find((b) => b.textContent.includes("On this cell")).click();
        await app.updateComplete;
        expect(shadow(app, "context-menu")).to.be.null;
        expect(seen.onCell.at(-1)).to.deep.equal({ line: 1, cell: "aaaa", selection: { path: "doc.texl", line: 1, cell: "aaaa" } });
    });

    it("goes to a cell by its name", async () => {
        expect(stilo.editor.lineOf("BBBB")).to.equal(2);
        expect(await stilo.editor.goTo({ path: "doc.texl", cell: "bbbb" })).to.be.true;
        expect(stilo.editor.selection.line).to.equal(2);
        expect(await stilo.editor.goTo({ cell: "zzzz" })).to.be.false;
        expect(await stilo.editor.goTo({ line: 1 })).to.be.true;
        expect(stilo.editor.selection.line).to.equal(1);
    });

    it("renders a Texl text that is not the open document", async () => {
        const rendered = await stilo.editor.renderHtml("<!--{ cccc : markdown }-->\nTwo is <% 1 + 1 %>, **bold**\n");
        expect(rendered).to.contain('data-cell="cccc"');
        expect(rendered).to.contain("Two is 2");
        expect(rendered).to.contain("<strong>bold</strong>");
    });

    it("asks for a rich text, as Markdown", async () => {
        const answer = stilo.ui.write("Your reply", "Hello **world**");
        await app.updateComplete;
        const dialog = shadow(app, "stilo-dialog");
        await dialog.updateComplete;
        const cell = dialog.shadowRoot.querySelector(".rich-text");
        await cell.updateComplete;
        expect(cell.mode).to.equal("edit");
        cell._rich.dispatch(cell._rich.state.tr.insertText("Oh, ", 1));
        dialog.shadowRoot.querySelector("button.primary").click();
        expect(await answer).to.equal("Oh, Hello **world**");

        const cancelled = stilo.ui.write("Your reply");
        await app.updateComplete;
        await shadow(app, "stilo-dialog").updateComplete;
        shadow(app, "stilo-dialog").shadowRoot.querySelector("button.secondary").click();
        expect(await cancelled).to.be.null;
    });

    it("knows the packed package a document is in, and its hash", async () => {
        expect(stilo.tree.archiveOf("doc.texl")).to.be.null;
        expect(stilo.tree.archiveOf("rel.texlz/index.texl")).to.equal("rel.texlz");
        expect(stilo.tree.archiveOf("p/rel.texlz/references/steel.texlz/a.texl")).to.equal("p/rel.texlz/references/steel.texlz");
        const bytes = new TextEncoder().encode(DOC);
        const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
        expect(await stilo.transport.sha256("rel.texlz")).to.equal(digest);
        expect(seen.requests.at(-1)).to.contain("/_api/files/rel.texlz?download");
    });

    it("sees every request through its middleware, and keeps its settings", () => {
        expect(seen.requests.some((url) => url.includes("/_api/files/doc.texl"))).to.be.true;
        expect(seen.requests.some((url) => url.includes("/_api/tree"))).to.be.true;
        expect(localStorage.getItem("stilo.ext.contract.runs")).to.equal("1");
    });

    it("keeps data of its own in a file of the folder, a JSON file too", async () => {
        expect(seen.info.has("rewrite")).to.be.true;
        expect(await stilo.transport.updateFile("contract/data.json", '{"n": 1}', '"e"')).to.equal('"f"');
        expect(seen.requests.at(-1)).to.contain("/_api/files/contract/data.json");
    });

    it("knows what the server is and can do", () => {
        expect(seen.info.protocol).to.equal(1);
        expect(seen.info.has("tree")).to.be.true;
        expect(seen.info.has("upload")).to.be.false;
        expect(seen.info.hasExtension("contract")).to.be.true;
    });

    it("adds a cell type, with its command", () => {
        expect(stilo.cells.types()).to.include("contract-note");
        expect(stilo.commands.get("make-contract-note").label).to.equal("Change to Note and edit");
        expect(stilo.keys.keysFor("make-contract-note")).to.equal("N");
    });

    it("adds a page at its own address", async () => {
        await stilo.router.apply({ root: "", view: "contract.page", params: { n: "3" } });
        await app.updateComplete;
        expect(shadow(app, ".contract-view").textContent).to.equal("Page 3");
        await stilo.router.apply({ root: "", doc: "doc.texl" });
        await new Promise((resolve) => setTimeout(resolve, 50));
        await app.updateComplete;
    });

    it("takes everything away when deactivated", async () => {
        stilo.extensions.deactivate("contract");
        await app.updateComplete;
        expect(seen.deactivated).to.equal(1);
        expect(stilo.extensions.list()).to.deep.equal([]);
        expect(stilo.commands.get("contract.ask")).to.be.undefined;
        expect(stilo.keys.keysFor("contract.ask")).to.not.be.ok;
        expect(stilo.menus.items("tree/document")).to.not.include("contract.ask");
        expect(stilo.menus.items("editor/cell")).to.not.include("contract.on-cell");
        expect(stilo.panels.get("contract.panel")).to.be.undefined;
        expect(stilo.panels.get("commands").label).to.equal("Commands");
        expect(stilo.panels.badge("comments")).to.be.undefined;
        expect(stilo.topBar.list()).to.deep.equal([]);
        expect(stilo.topBar.brand).to.be.null;
        expect(shadow(app, "top-bar").renderRoot.querySelector(".brand").textContent.trim()).to.equal("Stilo");
        expect(stilo.status.list()).to.deep.equal([]);
        expect(shadow(app, "footer")).to.be.null;
        expect(stilo.views.get("contract.page")).to.be.undefined;
        expect(stilo.tree.readOnlyReason("references/x.texl")).to.be.null;
        expect(stilo.tree.decoration(TREE.children[0])).to.be.null;
        expect(stilo.tree.shows(TREE.children[1])).to.be.true;
        const editor = shadow(app, "texl-editor");
        expect(editor.marks).to.deep.equal({});
        expect(stilo.commands.get("make-contract-note")).to.be.undefined;
        const requests = seen.requests.length;
        await stilo.tree.refresh();
        expect(seen.requests.length).to.equal(requests);
        editor.dispatchEvent(new CustomEvent("change"));
        expect(seen.edits).to.equal(1);
        // Stilo's own are all there
        expect(stilo.commands.get("save")).to.exist;
        expect(stilo.panels.list().map((p) => p.id)).to.deep.equal(["commands", "errors", "comments"]);
    });
});
