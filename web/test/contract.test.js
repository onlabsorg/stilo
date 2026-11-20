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
const seen = { requests: [], opened: [], edits: 0, deactivated: 0 };

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

        // Visible contributions
        stilo.panels.register({ id: "contract.panel", label: "Contract", icon: html`C`, order: 40, render: () => html`<p class="contract-panel">Panel</p>` });
        stilo.panels.setBadge("contract.panel", { text: "1", label: "1 thing" });
        stilo.panels.replace("commands", { label: "Other commands", icon: html`X`, order: 30, render: () => html`<p>Replaced</p>` });
        stilo.topBar.register({ id: "contract.user", render: () => html`<span class="contract-user">Ada</span>` });
        stilo.status.register({ id: "contract.counter", render: () => html`<contract-counter></contract-counter>` });
        stilo.views.register({ id: "contract.page", label: "Contract page", render: (s, params) => html`<p class="contract-view">Page ${params.n}</p>` });

        // The tree
        stilo.tree.decorate((node) => (node.path === "doc.texl" ? { badge: "M", tone: "warning", tooltip: "Changed" } : null));
        stilo.tree.filter((node) => node.path !== "hidden.texl");
        stilo.tree.readOnly((path) => (path === "references" || path.startsWith("references/") ? "a reference" : null));

        // The editor and the comments
        stilo.editor.decorate(({ cells }) => cells.filter((c) => c.texl.includes("Two")).map((c) => ({ cell: c.name, text: "Check", tone: "danger" })));
        stilo.comments.addProvider({ id: "contract.issues", label: "Issues", comments: async () => [{ cell: "bbbb", text: "From the tracker", author: "Ada" }] });

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

    it("adds a panel with a badge, a top-bar item and a status item that follows the services", async () => {
        const bar = shadow(app, "top-bar");
        await bar.updateComplete;
        expect(bar.renderRoot.querySelector(".contract-user").textContent).to.equal("Ada");
        expect([...bar.renderRoot.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).to.include("1 thing");
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

    it("marks cells, adds comments from outside, and hears the document's events", async () => {
        const editor = shadow(app, "texl-editor");
        expect(editor.marks).to.deep.equal({ bbbb: [{ cell: "bbbb", text: "Check", tone: "danger" }] });
        expect(editor.extraComments).to.deep.equal({ bbbb: ["From the tracker"] });
        expect(stilo.comments.list[1].others[0].source).to.equal("Issues");
        expect(seen.opened).to.include("doc.texl");
        editor.dispatchEvent(new CustomEvent("change"));
        expect(seen.edits).to.equal(1);
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
        expect(stilo.panels.get("contract.panel")).to.be.undefined;
        expect(stilo.panels.get("commands").label).to.equal("Commands");
        expect(stilo.topBar.list()).to.deep.equal([]);
        expect(stilo.status.list()).to.deep.equal([]);
        expect(shadow(app, "footer")).to.be.null;
        expect(stilo.views.get("contract.page")).to.be.undefined;
        expect(stilo.tree.readOnlyReason("references/x.texl")).to.be.null;
        expect(stilo.tree.decoration(TREE.children[0])).to.be.null;
        expect(stilo.tree.shows(TREE.children[1])).to.be.true;
        const editor = shadow(app, "texl-editor");
        expect(editor.marks).to.deep.equal({});
        expect(editor.extraComments).to.deep.equal({});
        expect(stilo.commands.get("make-contract-note")).to.be.undefined;
        const requests = seen.requests.length;
        await stilo.tree.refresh();
        expect(seen.requests.length).to.equal(requests);
        editor.dispatchEvent(new CustomEvent("change"));
        expect(seen.edits).to.equal(1);
        // Stilo's own are all there
        expect(stilo.commands.get("save")).to.exist;
        expect(stilo.panels.list().map((p) => p.id)).to.deep.equal(["errors", "comments", "commands"]);
    });
});
