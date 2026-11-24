import { expect, fixture, html } from "@open-wc/testing";
import "../src/editor/index.js";
import { createStilo, Router } from "../src/core/index.js";

const TEXT = `<!--{ aaaa : text }-->
One
<!--[ In the file ]-->
<!--{ BBBB : text }-->
Two
`;

describe("the editor's marks", () => {
    it("shows marks on cells by name, which fire mark-click", async () => {
        const editor = await fixture(html`<texl-editor></texl-editor>`);
        editor.value = TEXT;
        await editor.rendered;
        editor.marks = { aaaa: [{ cell: "aaaa", text: "Typo", tone: "warning", title: "1 spelling mistake" }] };
        await editor.updateComplete;
        const margins = [...editor.shadowRoot.querySelectorAll(".margin.right")];
        expect(margins[0].querySelector(".comment-count").textContent.trim()).to.equal("1");
        const mark = margins[0].querySelector(".mark.warning");
        expect(mark.textContent.trim()).to.equal("Typo");
        expect(mark.title).to.equal("1 spelling mistake");
        let detail;
        editor.addEventListener("mark-click", (e) => (detail = e.detail));
        mark.click();
        expect(detail.line).to.equal(1);
        expect(detail.cell).to.equal("aaaa");
        expect(detail.mark.text).to.equal("Typo");
    });
});

/** A stand-in for <texl-editor>. */
class FakeEditor extends EventTarget {
    constructor() {
        super();
        this.value = "";
        this.editing = false;
        this.marks = {};
    }
    focus() {}
    select() {}
}

/** The services on a fake server; each document opens in a new fake editor. */
function setUp(files = { "a.texl": TEXT, "b.texl": "<!--{ cccc : text }-->\nThree\n" }) {
    const stilo = createStilo({
        transport: {
            readFile: async (path) => ({ text: files[path], etag: '"e"' }),
            readTree: async () => ({ path: "", name: "", type: "folder", children: [] }),
            documentUrl: (path) => `https://example.com/${path}`,
        },
    });
    stilo.router = new Router(stilo, {
        history: { pushState() {}, replaceState() {} },
        location: new URL("https://example.com/"),
        window: new EventTarget(),
    });
    stilo.document.on("change", () => {
        if (stilo.document.path && !stilo.editor.element) {
            const editor = new FakeEditor();
            // As the real one: the value set by the document is the file's text
            stilo.editor.attach(editor);
        }
    });
    return stilo;
}

/** Open a document and wait for it. */
async function open(stilo, path) {
    await stilo.document.load(path);
    await new Promise((resolve) => setTimeout(resolve));
}

describe("mark providers", () => {
    it("give the editor marks on cells by name, again after an edit, and pass on mark-click", async () => {
        const stilo = setUp();
        let word = "One";
        stilo.editor.decorate(({ path, cells }) =>
            cells.filter((c) => c.texl.includes(word)).map((c) => ({ cell: c.name, text: `${path}:${c.line}`, tone: "danger" })),
        );
        stilo.editor.decorate(() => {
            throw new Error("broken");
        });
        const consoleError = console.error;
        console.error = () => {};
        try {
            await open(stilo, "a.texl");
            stilo.editor.element.value = TEXT;
            stilo.editor.emit("edit");
            expect(stilo.editor.element.marks).to.deep.equal({ aaaa: [{ cell: "aaaa", text: "a.texl:1", tone: "danger" }] });
            word = "Two";
            stilo.editor.invalidate();
            expect(Object.keys(stilo.editor.element.marks)).to.deep.equal(["bbbb"]);
        } finally {
            console.error = consoleError;
        }
        let clicked;
        stilo.editor.on("mark-click", (detail) => (clicked = detail));
        stilo.editor.element.dispatchEvent(new CustomEvent("mark-click", { detail: { line: 2, cell: "BBBB" } }));
        expect(clicked.cell).to.equal("BBBB");
    });

    it("are undone when their extension is deactivated", async () => {
        const stilo = setUp();
        await stilo.extensions.activate({ id: "check", apiVersion: "1", activate: (s) => s.editor.decorate(({ cells }) => cells.map((c) => ({ cell: c.name, text: "!" }))) });
        await open(stilo, "a.texl");
        stilo.editor.element.value = TEXT;
        stilo.editor.invalidate();
        expect(Object.keys(stilo.editor.element.marks).length).to.equal(2);
        stilo.extensions.deactivate("check");
        expect(stilo.editor.element.marks).to.deep.equal({});
    });
});
