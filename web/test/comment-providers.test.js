import { expect, fixture, html } from "@open-wc/testing";
import "../src/editor/index.js";
import "../src/components/comments-pane.js";
import { createStilo, Router } from "../src/core/index.js";

const TEXT = `<!--{ aaaa : text }-->
One
<!--[ In the file ]-->
<!--{ BBBB : text }-->
Two
`;

describe("the editor's extra comments and marks", () => {
    it("counts comments from outside in the margin, by cell name, and shows marks that fire mark-click", async () => {
        const editor = await fixture(html`<texl-editor></texl-editor>`);
        editor.value = TEXT;
        await editor.rendered;
        editor.extraComments = { bbbb: ["From the tracker", "Another"], aaaa: ["Also"] };
        editor.marks = { aaaa: [{ cell: "aaaa", text: "Typo", tone: "warning", title: "1 spelling mistake" }] };
        await editor.updateComplete;
        const margins = [...editor.shadowRoot.querySelectorAll(".margin.right")];
        expect(margins[0].querySelector(".comment-count").textContent.trim()).to.equal("2");
        expect(margins[1].querySelector(".comment-count").textContent.trim()).to.equal("2");
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
        this.extraComments = {};
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

/** Open a document and wait for the providers. */
async function open(stilo, path) {
    await stilo.document.load(path);
    await new Promise((resolve) => setTimeout(resolve));
}

describe("comment providers", () => {
    it("place comments from outside on the cells they name, beside the file's own", async () => {
        const stilo = setUp();
        stilo.comments.addProvider({
            id: "x.issues",
            label: "Issues",
            comments: async (path) =>
                path === "a.texl"
                    ? [
                          { cell: "bbbb", text: "Check this", author: "Ada", date: "2026-11-17" },
                          { cell: "zzzz", text: "On no cell" },
                      ]
                    : [],
        });
        await open(stilo, "a.texl");
        const [one, two] = stilo.comments.list;
        expect(one.comments).to.deep.equal(["In the file"]);
        expect(one.others).to.deep.equal([]);
        expect(two.others).to.deep.equal([{ cell: "bbbb", text: "Check this", author: "Ada", date: "2026-11-17", source: "Issues", provider: "x.issues" }]);
        expect(stilo.editor.element.extraComments).to.deep.equal({ bbbb: ["Check this"] });
        // They follow their cell when it moves
        stilo.editor.element.value = "<!--{ bbbb : text }-->\nTwo\n<!--{ aaaa : text }-->\nOne\n";
        stilo.editor.emit("edit");
        expect(stilo.comments.list[0].others[0].text).to.equal("Check this");
    });

    it("leave out a provider that fails, and ignore answers for a document no longer open", async () => {
        const stilo = setUp();
        const consoleError = console.error;
        console.error = () => {};
        let release;
        const slow = new Promise((resolve) => (release = resolve));
        try {
            stilo.comments.addProvider({ id: "x.broken", label: "Broken", comments: () => { throw new Error("down"); } });
            stilo.comments.addProvider({ id: "x.slow", label: "Slow", comments: async (path) => (path === "a.texl" ? (await slow, [{ cell: "aaaa", text: "Late" }]) : []) });
            const first = stilo.document.load("a.texl");
            await first;
            await open(stilo, "b.texl");
            release();
            await new Promise((resolve) => setTimeout(resolve));
            expect(stilo.document.path).to.equal("b.texl");
            expect(stilo.comments.list.flatMap((l) => l.others)).to.deep.equal([]);
        } finally {
            console.error = consoleError;
        }
    });

    it("refuse a taken id, and take their comments away when removed or their extension deactivated", async () => {
        const stilo = setUp();
        const provider = { id: "notes.all", label: "Notes", comments: () => [{ cell: "aaaa", text: "Note" }] };
        await stilo.extensions.activate({ id: "notes", apiVersion: "1", activate: (s) => s.comments.addProvider(provider) });
        expect(() => stilo.comments.addProvider(provider)).to.throw();
        await open(stilo, "a.texl");
        expect(stilo.comments.list[0].others.length).to.equal(1);
        stilo.extensions.deactivate("notes");
        expect(stilo.comments.list[0].others).to.deep.equal([]);
        expect(stilo.editor.element.extraComments).to.deep.equal({});
    });

    it("show in the comments pane, with where they come from and who wrote them", async () => {
        const stilo = setUp();
        stilo.comments.addProvider({ id: "x.issues", label: "Issues", comments: () => [{ cell: "bbbb", text: "Check this", author: "Ada" }] });
        await open(stilo, "a.texl");
        const host = await fixture(html`<stilo-provider .stilo=${stilo}><comments-pane></comments-pane></stilo-provider>`);
        const pane = host.querySelector("comments-pane");
        await pane.updateComplete;
        const entries = [...pane.renderRoot.querySelectorAll(".entry")];
        expect(entries.map((e) => e.querySelector(".where").textContent)).to.deep.equal(["Cell 1", "Cell 2"]);
        expect(entries[1].querySelector(".other p").textContent).to.equal("Check this");
        expect(entries[1].querySelector(".by").textContent).to.equal("Issues · Ada");
    });
});

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
