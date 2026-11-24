// The example extension `examples/extensions/review-notes.js` (S29): notes on
// the cells of a packed package, in a real app, through the hooks Papiro's
// Threads panel uses (OnLabs D25).

import { expect } from "@open-wc/testing";
import { startStilo } from "../src/start.js";
import { Transport } from "../src/api.js";
import reviewNotes from "../../examples/extensions/review-notes.js";

const DOC = `<!--{ aaaa : text }-->
Span: 6 m
<!--{ bbbb : text }-->
Load: 12.5 kN/m
`;
const REL = "references/beam-revA.texlz";
const IN = "It is in a packed package, which cannot be changed";
const TREE = {
    name: "",
    path: "",
    type: "folder",
    children: [
        { name: "draft.texl", path: "draft.texl", type: "file" },
        {
            name: "references",
            path: "references",
            type: "folder",
            children: [
                {
                    name: "beam-revA.texlz",
                    path: REL,
                    type: "folder",
                    archive: true,
                    children: [{ name: "index.texl", path: `${REL}/index.texl`, type: "file", readOnly: IN }],
                },
            ],
        },
    ],
};
/** The bytes of the packed package, as `?download` gives them. */
const ZIP = "PK fake zip of beam rev A";

/** A fake server behind the page's own fetch. */
function serve() {
    const realFetch = window.fetch;
    window.fetch = async (url, init) => {
        const { pathname, search } = new URL(url, location.href);
        if (!pathname.startsWith("/_api/")) return realFetch(url, init);
        if (pathname === "/_api/info") return new Response(JSON.stringify({ protocol: 1, server: { name: "test" }, capabilities: ["files", "tree", "archives"], extensions: [] }));
        if (pathname === `/_api/files/${REL}` && search === "?download") return new Response(ZIP, { headers: { ETag: '"z"' } });
        if (pathname.startsWith("/_api/files/")) return new Response(DOC, { headers: { ETag: '"e"' } });
        if (pathname.startsWith("/_api/tree")) return new Response(JSON.stringify(TREE));
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    };
    return () => (window.fetch = realFetch);
}

const shadow = (el, selector) => el.shadowRoot.querySelector(selector);
const settle = async (app) => {
    for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        await app.updateComplete;
    }
};

async function sha256(text) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("the review notes example extension", () => {
    let restore, target, app, stilo;
    before(async () => {
        localStorage.removeItem(`stilo.ext.review-notes.${await sha256(ZIP)}`);
        restore = serve();
        target = document.createElement("div");
        document.body.append(target);
        app = await startStilo({ target, transport: new Transport(), extensions: [reviewNotes] });
        stilo = app.stilo;
        await stilo.tree.refresh();
        await stilo.router.apply({ root: "", doc: "draft.texl" });
        await settle(app);
    });
    after(async () => {
        target.remove();
        restore();
        localStorage.removeItem(`stilo.ext.review-notes.${await sha256(ZIP)}`);
    });

    it("refuses a document that is not in a packed package", () => {
        expect(stilo.commands.disabledReason("review-notes.new", { line: 1, cell: "aaaa" })).to.equal("only a packed package (a release) can be noted");
    });

    it("adds a note on a cell of a release, from the menu on the cell, written as rich text", async () => {
        await stilo.router.apply({ root: "", doc: `${REL}/index.texl` });
        await settle(app);
        expect(stilo.document.readOnly).to.equal(IN);
        expect(stilo.commands.disabledReason("review-notes.new", { line: 2, cell: "bbbb" })).to.be.null;

        // Right click on the second cell: Stilo's entries greyed out, the note's not
        const editor = shadow(app, "texl-editor");
        editor.shadowRoot.querySelector('[data-index="1"]').dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true, clientX: 50, clientY: 60 }));
        await app.updateComplete;
        const menu = shadow(app, "context-menu");
        await menu.updateComplete;
        const button = (label) => [...menu.shadowRoot.querySelectorAll("button")].find((b) => b.textContent.includes(label));
        expect(button("Edit the selected cell").getAttribute("aria-disabled")).to.equal("true");
        expect(button("New note…").getAttribute("aria-disabled")).to.equal("false");
        button("New note…").click();
        await settle(app);

        // The rich text dialog
        const dialog = shadow(app, "stilo-dialog");
        const cell = dialog.shadowRoot.querySelector(".rich-text");
        await cell.updateComplete;
        cell._rich.dispatch(cell._rich.state.tr.insertText("Check the load"));
        dialog.shadowRoot.querySelector("button.primary").click();
        await settle(app);

        expect(stilo.ui.pane).to.equal("review-notes.panel");
        expect(editor.marks.bbbb?.[0].text).to.equal("✎ 1");
        expect(stilo.panels.badge("review-notes.panel").text).to.equal("1");
        const saved = JSON.parse(localStorage.getItem(`stilo.ext.review-notes.${await sha256(ZIP)}`));
        expect(saved.map(({ path, cell, text, status }) => ({ path, cell, text, status }))).to.deep.equal([
            { path: "index.texl", cell: "bbbb", text: "Check the load", status: "open" },
        ]);
    });

    it("shows the notes in its panel, rendered, and goes to their cells", async () => {
        const text = shadow(app, "aside review-note-text");
        await text.updateComplete;
        await settle(app);
        expect(text.shadowRoot.innerHTML).to.contain("Check the load");
        stilo.editor.element.select(1);
        shadow(app, "aside .note .where a").click();
        await settle(app);
        expect(stilo.editor.selection).to.deep.equal({ path: `${REL}/index.texl`, line: 2, cell: "bbbb" });
    });

    it("closes a note", async () => {
        shadow(app, "aside .note button.toggle").click();
        await settle(app);
        expect(shadow(app, "aside .note").classList.contains("closed")).to.be.true;
        expect(stilo.panels.badge("review-notes.panel")).to.be.undefined;
    });
});
