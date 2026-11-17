import { expect, fixture, html } from "@open-wc/testing";
import "../src/components/nav-pane.js";
import "../src/components/commands-pane.js";
import "../src/components/top-bar.js";
import { createStilo, findNode } from "../src/core/index.js";
import { activateBuiltins } from "../src/builtins/index.js";

const TREE = {
    name: "",
    path: "",
    type: "folder",
    children: [
        {
            name: "lib",
            path: "lib",
            type: "folder",
            children: [{ name: "steel.texl", path: "lib/steel.texl", type: "file" }],
        },
        { name: "beam.texl", path: "beam.texl", type: "file" },
        { name: "notes.texl", path: "notes.texl", type: "file" },
    ],
};

/** Stilo's services on a fake tree, the read-only provider making `lib/`
 * read-only, and `beam.texl` open. */
async function setUp() {
    const stilo = createStilo({
        transport: {
            readTree: async () => TREE,
            documentUrl: (path) => `https://example.com/${path}`,
            readFile: async () => ({ text: "", etag: '"e"' }),
            updateFile: async () => '"f"',
        },
    });
    activateBuiltins(stilo);
    await stilo.tree.refresh();
    return stilo;
}

const libReadOnly = (path) => (path === "lib" || path.startsWith("lib/") ? "a library" : null);
const node = (stilo, path) => findNode(stilo.tree.tree, path);

describe("tree providers", () => {
    it("merge decorations, and fire change when added, removed or invalidated", async () => {
        const stilo = await setUp();
        let changes = 0;
        stilo.tree.on("change", () => changes++);
        let changed = new Set(["beam.texl"]);
        const stop = stilo.tree.decorate((n) => (changed.has(n.path) ? { badge: "M", tone: "warning", tooltip: "Changed" } : null));
        stilo.tree.decorate((n) => (n.path === "beam.texl" ? { badge: 2, muted: true, tooltip: "2 issues" } : null));
        stilo.tree.decorate(() => {
            throw new Error("broken provider");
        });
        const consoleError = console.error;
        console.error = () => {};
        try {
            expect(stilo.tree.decoration(node(stilo, "beam.texl"))).to.deep.equal({
                badges: [{ text: "M", tone: "warning" }, { text: "2", tone: undefined }],
                tooltip: "Changed\n2 issues",
                muted: true,
            });
            expect(stilo.tree.decoration(node(stilo, "notes.texl"))).to.be.null;
            changed = new Set(["notes.texl"]);
            stilo.tree.invalidate();
            expect(stilo.tree.decoration(node(stilo, "notes.texl")).badges[0].text).to.equal("M");
            stop();
            expect(stilo.tree.decoration(node(stilo, "notes.texl"))).to.be.null;
            expect(changes).to.equal(5);
        } finally {
            console.error = consoleError;
        }
    });

    it("say why an item is read-only, and a folder holding read-only items locked", async () => {
        const stilo = await setUp();
        expect(stilo.tree.readOnlyReason("lib/steel.texl")).to.be.null;
        stilo.tree.readOnly(libReadOnly);
        stilo.tree.readOnly((path) => path === "notes.texl");
        expect(stilo.tree.readOnlyReason("lib/steel.texl")).to.equal("a library");
        expect(stilo.tree.readOnlyReason("notes.texl")).to.equal("Read-only");
        expect(stilo.tree.readOnlyReason("beam.texl")).to.be.null;
        expect(stilo.tree.lockedReason(node(stilo, ""))).to.equal("It holds read-only items");
        expect(stilo.tree.lockedReason(node(stilo, "beam.texl"))).to.be.null;
    });

    it("filter items out of the navigation pane, and show marks and the reason", async () => {
        const stilo = await setUp();
        stilo.tree.filter((n) => n.path !== "notes.texl");
        stilo.tree.readOnly(libReadOnly);
        stilo.tree.decorate((n) => (n.path === "beam.texl" ? { badge: "M", tone: "warning", tooltip: "Changed" } : null));
        const host = await fixture(html`<stilo-provider .stilo=${stilo}><nav-pane></nav-pane></stilo-provider>`);
        const pane = host.querySelector("nav-pane");
        await pane.updateComplete;
        const names = [...pane.renderRoot.querySelectorAll(".name")].map((n) => n.textContent);
        expect(names).to.deep.equal(["lib", "steel", "beam"]);
        const item = (path) => pane.renderRoot.querySelector(`.item[title^="${path}"]`);
        expect(item("lib/steel.texl").querySelector(".lock")).to.exist;
        expect(item("lib/steel.texl").title).to.equal("lib/steel.texl\nRead-only: a library");
        expect(item("beam.texl").querySelector(".badge.warning").textContent).to.equal("M");
        expect(item("beam.texl").title).to.equal("beam.texl\nChanged");
        expect(item("beam.texl").querySelector(".lock")).to.be.null;
    });

    it("refuse a read-only folder in the Move to… dialog", async () => {
        const stilo = await setUp();
        stilo.tree.readOnly(libReadOnly);
        const chosen = [];
        stilo.tree.startMove({ node: node(stilo, "beam.texl"), tree: TREE, choose: (f) => chosen.push(f) });
        stilo.tree.chooseMove("lib");
        expect(chosen).to.deep.equal([]);
        expect(stilo.tree.moving.error).to.contain("a library");
        stilo.tree.chooseMove("");
        expect(chosen).to.deep.equal([""]);
    });

    it("are undone when the extension that added them is deactivated", async () => {
        const stilo = await setUp();
        await stilo.extensions.activate({
            id: "locks",
            apiVersion: "1",
            activate(s) {
                s.tree.readOnly(libReadOnly);
                s.tree.decorate(() => ({ badge: "x" }));
                s.tree.filter(() => false);
            },
        });
        expect(stilo.tree.readOnlyReason("lib")).to.equal("a library");
        stilo.extensions.deactivate("locks");
        expect(stilo.tree.readOnlyReason("lib")).to.be.null;
        expect(stilo.tree.decoration(node(stilo, "lib"))).to.be.null;
        expect(stilo.tree.shows(node(stilo, "lib"))).to.be.true;
    });
});

describe("commands that do not apply", () => {
    it("give a reason, and do not run: the status says why", async () => {
        const stilo = await setUp();
        let ran = 0;
        let reason = "not today";
        stilo.commands.register({ id: "x.go", label: "Go", group: "File", run: () => ++ran, enabled: () => (reason ? reason : true) });
        stilo.commands.register({ id: "x.off", label: "Off", group: "File", run: () => ++ran, enabled: () => false });
        expect(stilo.commands.disabledReason("x.go")).to.equal("not today");
        expect(stilo.commands.disabledReason("x.off")).to.equal("");
        expect(stilo.commands.disabledReason("save")).to.be.null;
        stilo.commands.run("x.go");
        expect(ran).to.equal(0);
        expect(stilo.ui.status).to.equal("Go is not available: not today");
        reason = "";
        stilo.commands.run("x.go");
        expect(ran).to.equal(1);
    });

    it("on read-only items: Stilo's own commands on files and folders", async () => {
        const stilo = await setUp();
        stilo.tree.readOnly(libReadOnly);
        const steel = node(stilo, "lib/steel.texl");
        const lib = node(stilo, "lib");
        const reason = (id, n) => stilo.commands.disabledReason(id, { node: n });
        for (const id of ["tree-rename", "tree-move", "tree-delete"]) {
            expect(reason(id, steel), id).to.equal("a library");
            expect(reason(id, node(stilo, "beam.texl")), id).to.be.null;
        }
        expect(reason("tree-delete", node(stilo, ""))).to.equal("It holds read-only items");
        for (const id of ["new-document", "tree-new-folder", "tree-upload"]) expect(reason(id, lib), id).to.contain("a library");
        expect(reason("tree-duplicate", steel)).to.contain("a library");
        expect(reason("tree-copy-link", steel)).to.be.null;
    });

    it("show greyed out with the reason, in the menus and the commands pane", async () => {
        const stilo = await setUp();
        stilo.tree.readOnly(libReadOnly);
        const host = await fixture(html`<stilo-provider .stilo=${stilo}><nav-pane></nav-pane><commands-pane></commands-pane></stilo-provider>`);
        const pane = host.querySelector("nav-pane");
        await pane.updateComplete;
        const item = pane.renderRoot.querySelector('.item[title^="lib/steel.texl"]');
        item.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true, clientX: 20, clientY: 30 }));
        await pane.updateComplete;
        const menu = pane.renderRoot.querySelector("context-menu");
        await menu.updateComplete;
        const rename = [...menu.renderRoot.querySelectorAll("button")].find((b) => b.textContent.includes("Rename"));
        expect(rename.getAttribute("aria-disabled")).to.equal("true");
        expect(rename.title).to.equal("a library");
        let picked = 0;
        menu.addEventListener("pick", () => picked++);
        rename.click();
        expect(picked).to.equal(0);
        // The commands pane: tree commands act on the current item
        const commands = host.querySelector("commands-pane");
        await commands.updateComplete;
        const del = [...commands.renderRoot.querySelectorAll("button.command")].find((b) => b.textContent.includes("Delete") && !b.textContent.includes("cells"));
        expect(del.getAttribute("aria-disabled")).to.equal("true");
        expect(del.title).to.equal("a library");
    });
});

describe("read-only documents", () => {
    it("cannot be saved or changed, and the top bar says so", async () => {
        const stilo = await setUp();
        stilo.tree.readOnly(libReadOnly);
        // A stand-in editor for the open document
        const editor = Object.assign(new EventTarget(), { value: "x", editing: false, focus() {} });
        stilo.document.on("change", () => stilo.document.path && !stilo.editor.element && stilo.editor.attach(editor));
        await stilo.document.load("lib/steel.texl");
        expect(stilo.document.readOnly).to.equal("a library");
        expect(stilo.commands.disabledReason("save")).to.equal("a library");
        expect(stilo.commands.disabledReason("delete")).to.equal("a library");
        expect(stilo.commands.disabledReason("copy")).to.be.null;
        await stilo.document.save();
        expect(stilo.ui.status).to.contain("read-only");
        const host = await fixture(html`<stilo-provider .stilo=${stilo}><top-bar></top-bar></stilo-provider>`);
        const bar = host.querySelector("top-bar");
        await bar.updateComplete;
        expect(bar.renderRoot.querySelector(".read-only").title).to.equal("a library");
        await stilo.document.load("beam.texl");
        expect(stilo.document.readOnly).to.be.null;
        await bar.updateComplete;
        expect(bar.renderRoot.querySelector(".read-only")).to.be.null;
    });
});
