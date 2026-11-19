import { expect, fixture, html } from "@open-wc/testing";
import "../src/components/nav-pane.js";
import "../src/components/move-dialog.js";
import { createStilo, findNode } from "../src/core/index.js";
import { activateBuiltins } from "../src/builtins/index.js";
import { inArchive } from "../src/api.js";
import { ARCHIVE_REASON, checkName } from "../src/core/tree.js";

// Packed packages (S23): the server shows a `.texlz` file as a folder marked
// `archive`, its items read-only. The web app shows it with its own icon and
// a lock, opens what is in it read-only, and moves, renames, downloads and
// deletes it as the one file it is.

const IN = "It is in a packed package, which cannot be changed";
const LIB = "references/lib.texlz";
const TREE = {
    name: "",
    path: "",
    type: "folder",
    children: [
        {
            name: "references",
            path: "references",
            type: "folder",
            children: [
                {
                    name: "lib.texlz",
                    path: LIB,
                    type: "folder",
                    archive: true,
                    size: 1234,
                    modified: "2026-11-19T10:00:00Z",
                    children: [
                        { name: "docs", path: `${LIB}/docs`, type: "folder", readOnly: IN, children: [] },
                        { name: "index.texl", path: `${LIB}/index.texl`, type: "file", readOnly: IN },
                        { name: "package.texl", path: `${LIB}/package.texl`, type: "file", readOnly: IN },
                    ],
                },
            ],
        },
        { name: "beam.texl", path: "beam.texl", type: "file" },
    ],
};

/** Stilo's services on the tree above; `calls` records the transport's writes. */
async function setUp() {
    const calls = [];
    const stilo = createStilo({
        transport: {
            readTree: async () => TREE,
            info: async () => ({ protocol: 1, capabilities: ["files", "tree", "folders", "move", "upload", "archives"], extensions: [] }),
            documentUrl: (path) => `/${path}`,
            readFile: async () => ({ text: "<!--{ abcd : text }-->\nx\n", etag: '"e"' }),
            updateFile: async () => '"f"',
            deleteFile: async (path) => calls.push(["deleteFile", path]),
            deleteFolder: async (path) => calls.push(["deleteFolder", path]),
            moveItem: async (from, to) => calls.push(["moveItem", from, to]),
        },
    });
    activateBuiltins(stilo);
    await stilo.info.refresh?.();
    await stilo.tree.refresh();
    stilo.calls = calls;
    return stilo;
}

const node = (stilo, path) => findNode(stilo.tree.tree, path);
const reason = (stilo, id, path) => stilo.commands.disabledReason(id, { node: node(stilo, path) });

describe("packed packages", () => {
    it("are read-only inside, but move, rename and delete as one file", async () => {
        const stilo = await setUp();
        for (const id of ["new-document", "tree-new-folder", "tree-upload"]) {
            expect(reason(stilo, id, LIB), id).to.contain(ARCHIVE_REASON);
            expect(reason(stilo, id, `${LIB}/docs`), id).to.contain(IN);
        }
        for (const id of ["tree-rename", "tree-move", "tree-delete"]) {
            expect(reason(stilo, id, LIB), id).to.be.null;
            expect(reason(stilo, id, `${LIB}/index.texl`), id).to.equal(IN);
        }
        // A folder holding one is not locked by what is in it
        expect(reason(stilo, "tree-delete", "references")).to.be.null;
        expect(reason(stilo, "tree-duplicate", `${LIB}/index.texl`)).to.contain(ARCHIVE_REASON);
        expect(reason(stilo, "tree-download", LIB)).to.be.null;
        expect(reason(stilo, "tree-download", "references")).to.equal("a folder cannot be downloaded");
    });

    it("open their documents read-only, also one the tree does not show", async () => {
        const stilo = await setUp();
        // A stand-in editor for the open document
        const editor = Object.assign(new EventTarget(), { value: "x", editing: false, focus() {} });
        stilo.document.on("change", () => stilo.document.path && !stilo.editor.element && stilo.editor.attach(editor));
        await stilo.document.load(`${LIB}/index.texl`);
        expect(stilo.document.readOnly).to.equal(IN);
        expect(stilo.commands.disabledReason("save")).to.equal(IN);
        await stilo.document.load("elsewhere/other.texlz/index.texl");
        expect(stilo.document.readOnly).to.equal(ARCHIVE_REASON);
        await stilo.document.load("beam.texl");
        expect(stilo.document.readOnly).to.be.null;
    });

    it("show in the navigation pane with their own icon, a lock and their menu", async () => {
        const stilo = await setUp();
        const host = await fixture(html`<stilo-provider .stilo=${stilo}><nav-pane></nav-pane></stilo-provider>`);
        const pane = host.querySelector("nav-pane");
        await pane.updateComplete;
        const item = pane.renderRoot.querySelector(`.item[title^="${LIB}"]`);
        expect(item.classList.contains("archive")).to.equal(true);
        expect(item.querySelector(".lock")).to.not.equal(null);
        expect(item.title).to.contain(`Read-only: ${ARCHIVE_REASON}`);
        const references = [...pane.renderRoot.querySelectorAll(".item")].find((i) => i.title === "references");
        expect(references.querySelector(".lock")).to.equal(null);
        item.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true, clientX: 20, clientY: 30 }));
        await pane.updateComplete;
        const menu = pane.renderRoot.querySelector("context-menu");
        await menu.updateComplete;
        const labels = [...menu.renderRoot.querySelectorAll("button .label")].map((l) => l.textContent);
        expect(labels).to.deep.equal(["Open as root", "Rename", "Move to…", "Download", "Delete"]);
    });

    it("are deleted as a file, and renamed keeping their extension", async () => {
        const stilo = await setUp();
        stilo.ui.confirm = async () => true;
        await stilo.commands.run("tree-delete", { node: node(stilo, LIB) });
        expect(stilo.calls).to.deep.equal([["deleteFile", LIB]]);
        expect(checkName("lib-revB.texlz", "references", "archive")).to.deep.equal({ name: "lib-revB", problem: "" });
        expect(checkName("x.texlz", "references", "folder").problem).to.equal("A folder's name cannot end in .texlz.");
    });

    it("are not offered as a destination in the Move to… dialog", async () => {
        const stilo = await setUp();
        const dialog = await fixture(html`<move-dialog .tree=${TREE} .node=${node(stilo, "beam.texl")}></move-dialog>`);
        const names = [...dialog.renderRoot.querySelectorAll(".folder span")].map((s) => s.textContent);
        expect(names).to.deep.equal(["/", "references"]);
        expect(stilo.tree.addReason(LIB)).to.equal(ARCHIVE_REASON);
    });

    it("download as their file, with ?download", async () => {
        const stilo = await setUp();
        const clicked = [];
        const click = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
            clicked.push(this.getAttribute("href"));
        };
        try {
            await stilo.commands.run("tree-download", { node: node(stilo, LIB) });
        } finally {
            HTMLAnchorElement.prototype.click = click;
        }
        expect(clicked).to.deep.equal([`/${LIB}?download`]);
    });

    it("are found in paths by their extension", () => {
        expect(inArchive(`${LIB}/index.texl`)).to.equal(true);
        expect(inArchive(LIB)).to.equal(false);
        expect(inArchive("references/lib/index.texl")).to.equal(false);
    });
});
