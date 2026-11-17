import { expect } from "@open-wc/testing";
import { createStilo, Router } from "../src/core/index.js";
import { ApiError } from "../src/api.js";
import { activateBuiltins } from "../src/builtins/index.js";

const TEXT = "<!--{ aaaa : text }-->\nOne\n<!--[ A comment ]-->\n";

/** A stand-in for the server: files by path, and the requests made. */
function fakeTransport(files = { "a/b.texl": TEXT, "c.texl": "C" }) {
    const calls = [];
    return {
        calls,
        files,
        documentUrl: (path) => `https://example.com/${path}`,
        documentPath: (url) => (url.pathname.endsWith(".texl") ? url.pathname.slice(1) : null),
        async readFile(path) {
            calls.push(["read", path]);
            if (!(path in files)) throw new ApiError(404, "not found");
            return { text: files[path], etag: `"${path}"` };
        },
        async updateFile(path, text, etag) {
            calls.push(["update", path, text, etag]);
            if (etag === '"stale"') throw new ApiError(412, "changed");
            files[path] = text;
            return '"new"';
        },
    };
}

/** A stand-in for <texl-editor>. */
class FakeEditor extends EventTarget {
    constructor() {
        super();
        this.value = "";
        this.editing = false;
        this.commits = true;
        this.selected = null;
        this.focused = 0;
        this.commands = [];
    }
    focus() {
        this.focused++;
    }
    select(line) {
        this.selected = line;
    }
    async runCommand(name) {
        this.commands.push(name);
        if (name === "commit") {
            if (this.commits) this.editing = false;
            return this.commits;
        }
    }
    fire(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail }));
    }
}

/** The services on a fake server and a fake browser at `address`; every
 * new document gets a new fake editor, as the app does. */
function setUp(address = "/a/b.texl?root=a") {
    const transport = fakeTransport();
    const stilo = createStilo({ transport });
    const url = new URL(address, "https://example.com");
    const history = { entries: [], pushState: (_, __, to) => history.entries.push(["push", to]), replaceState: (_, __, to) => history.entries.push(["replace", to]) };
    stilo.router = new Router(stilo, { history, location: url, window: new EventTarget() });
    const editors = [];
    stilo.document.on("change", () => {
        if (stilo.document.path && !stilo.editor.element) {
            const editor = new FakeEditor();
            editors.push(editor);
            stilo.editor.attach(editor);
        }
    });
    let answer = true;
    const questions = [];
    stilo.ui.confirm = async (question) => (questions.push(question), answer);
    return { stilo, transport, history, editors, questions, answer: (a) => (answer = a), editor: () => editors.at(-1) };
}

describe("router and document", () => {
    it("open the document and the root of the address", async () => {
        const { stilo, editor } = setUp();
        await stilo.router.start();
        expect(stilo.router.root).to.equal("a");
        expect(stilo.document.path).to.equal("a/b.texl");
        expect(editor().value).to.equal(TEXT);
        expect(editor().focused).to.equal(1);
        expect(stilo.comments.list.map((c) => c.comments)).to.deep.equal([["A comment"]]);
    });

    it("say when a document cannot be read", async () => {
        const { stilo } = setUp("/missing.texl");
        await stilo.router.start();
        expect(stilo.document.error).to.equal("Document /missing.texl not found.");
    });

    it("mark the document dirty on an edit, and read its comments again", async () => {
        const { stilo, editor } = setUp();
        await stilo.router.start();
        stilo.ui.notify("Saved");
        editor().value = "<!--{ aaaa : text }-->\nOne\n";
        editor().fire("change");
        expect(stilo.document.dirty).to.equal(true);
        expect(stilo.ui.status).to.equal("");
        expect(stilo.comments.list.map((c) => c.comments)).to.deep.equal([[]]);
    });

    it("go to another document with a history entry, asking first if there are unsaved changes", async () => {
        const { stilo, history, questions, answer, editor } = setUp();
        await stilo.router.start();
        editor().fire("change");
        answer(false);
        await stilo.router.go({ root: "a", doc: "c.texl" });
        expect(questions).to.deep.equal(["Discard unsaved changes?"]);
        expect([stilo.document.path, history.entries.length]).to.deep.equal(["a/b.texl", 0]);
        answer(true);
        await stilo.router.go({ root: "a", doc: "c.texl" });
        expect(history.entries).to.deep.equal([["push", "/c.texl?root=a"]]);
        expect([stilo.document.path, stilo.document.dirty, editor().value]).to.deep.equal(["c.texl", false, "C"]);
    });

    it("replace the history entry without asking", async () => {
        const { stilo, history, questions, editor } = setUp();
        await stilo.router.start();
        editor().fire("change");
        stilo.document.discard();
        await stilo.router.replace({ root: "", doc: null });
        expect(questions).to.deep.equal([]);
        expect(history.entries).to.deep.equal([["replace", "/"]]);
        expect([stilo.router.root, stilo.document.path]).to.deep.equal(["", null]);
    });

    it("save with the ETag of the last read, and say so", async () => {
        const { stilo, transport, editor } = setUp();
        await stilo.router.start();
        const saved = [];
        stilo.document.on("save", (detail) => saved.push(detail));
        editor().value = "changed";
        editor().fire("change");
        await stilo.document.save();
        expect(transport.calls.at(-1)).to.deep.equal(["update", "a/b.texl", "changed", '"a/b.texl"']);
        expect([stilo.document.dirty, stilo.ui.status]).to.deep.equal([false, "Saved"]);
        expect(saved).to.deep.equal([{ path: "a/b.texl" }]);
    });

    it("do not overwrite a document changed on the server", async () => {
        const { stilo } = setUp();
        await stilo.router.start();
        stilo.document._etag = '"stale"';
        await stilo.document.save();
        expect(stilo.ui.status).to.equal("Not saved: changed on the server, reload it");
    });

    it("save the cell being edited too, and not save when it refuses its edit", async () => {
        const { stilo, transport, editor } = setUp();
        await stilo.router.start();
        editor().editing = true;
        editor().commits = false;
        await stilo.document.save();
        expect(stilo.ui.status).to.equal("Not saved: correct the cell being edited");
        expect(transport.calls.filter((c) => c[0] === "update")).to.have.length(0);
        editor().commits = true;
        await stilo.document.save();
        expect(editor().commands).to.deep.equal(["commit", "commit"]);
        expect(stilo.ui.status).to.equal("Saved");
    });

    it("reload in a new editor, asking first if there are unsaved changes", async () => {
        const { stilo, questions, answer, editors, editor } = setUp();
        await stilo.router.start();
        editor().fire("change");
        answer(false);
        await stilo.document.reload();
        expect(editors).to.have.length(1);
        answer(true);
        await stilo.document.reload();
        expect(questions).to.have.length(2);
        expect(editors).to.have.length(2);
        expect(stilo.document.dirty).to.equal(false);
    });
});

describe("editor service", () => {
    it("passes on the editor's errors and comment clicks to their services", async () => {
        const { stilo, editor } = setUp();
        await stilo.router.start();
        editor().fire("errors-change", { errors: [{ key: "k", count: 2 }] });
        expect(stilo.errors.count).to.equal(2);
        editor().fire("error-click", { error: { key: "k" } });
        expect([stilo.errors.current, stilo.ui.pane]).to.deep.equal(["k", "errors"]);
        editor().fire("comments-click", { line: 1 });
        expect([stilo.comments.line, stilo.ui.pane]).to.deep.equal([1, "comments"]);
    });

    it("lets go of an old editor: its events no longer count, and who waits for it gets null", async () => {
        const { stilo, editor } = setUp();
        await stilo.router.start();
        const old = editor();
        stilo.editor.reset();
        const waiting = stilo.editor.whenReady();
        stilo.editor.reset();
        expect(await waiting).to.equal(null);
        old.fire("change");
        expect(stilo.document.dirty).to.equal(false);
    });

    it("runs editor commands and goes to a line back in the editor view", async () => {
        const { stilo, editor } = setUp();
        activateBuiltins(stilo);
        await stilo.router.start();
        stilo.ui.setSource("text");
        stilo.commands.run("undo");
        expect(editor().commands).to.deep.equal(["undo"]);
        expect(stilo.ui.source).to.equal(null);
        stilo.ui.setSource("text");
        stilo.comments.goTo(1);
        await stilo.editor.settled();
        await new Promise((r) => setTimeout(r));
        expect(editor().selected).to.equal(1);
        expect(stilo.ui.source).to.equal(null);
    });

    it("goes to an error in another document, opening it first", async () => {
        const { stilo, editor } = setUp();
        activateBuiltins(stilo);
        await stilo.router.start();
        stilo.errors.goTo({ uri: "https://example.com/c.texl", line: 2 });
        await new Promise((r) => setTimeout(r, 10));
        expect(stilo.document.path).to.equal("c.texl");
        expect(editor().selected).to.equal(2);
    });
});

describe("tree service", () => {
    const shown = {
        name: "",
        path: "",
        type: "folder",
        children: [{ name: "p", path: "p", type: "folder", children: [{ name: "x.texl", path: "p/x.texl", type: "file" }] }],
    };

    /** The services with a tree read from `trees` by root, and a navigation
     * pane stand-in that answers `askName` with `answer(request)`. */
    function treeSetUp(trees = { "": shown, p: shown.children[0] }) {
        const stilo = createStilo();
        stilo.transport.readTree = async (root) => {
            if (!(root in trees)) throw new ApiError(404, "not found");
            return trees[root];
        };
        const requests = [];
        stilo.tree.attachView({ askName: async (request) => (requests.push(request), true) });
        return { stilo, requests };
    }

    it("checks names as the protocol's paths need", async () => {
        const { checkName } = await import("../src/core/index.js");
        expect(checkName("report.texl", "p", "file")).to.deep.equal({ name: "report", problem: "" });
        expect(checkName("a/b", "p", "file").problem).to.equal("A name cannot contain / or \\.");
        expect(checkName("_x", "", "folder").problem).to.equal("A name here cannot start with _.");
        expect(checkName("_x", "p", "folder").problem).to.equal("");
        expect(checkName("x.texl", "p", "other").problem).to.equal("Only documents end in .texl.");
    });

    it("reads the tree of a new root, and says when it is not there", async () => {
        const { stilo } = treeSetUp();
        await stilo.router.apply({ root: "", doc: null });
        await new Promise((r) => setTimeout(r));
        expect(stilo.tree.tree).to.equal(shown);
        await stilo.router.apply({ root: "gone", doc: null });
        await new Promise((r) => setTimeout(r));
        expect(stilo.tree.error).to.equal("Folder /gone not found.");
    });

    it("keeps the current item through a new tree, and acts on it or the open document", async () => {
        const { stilo } = treeSetUp();
        await stilo.tree.refresh();
        expect(stilo.tree.target).to.equal(null);
        stilo.tree.setCurrent("p/x.texl");
        await stilo.tree.refresh();
        expect(stilo.tree.current.path).to.equal("p/x.texl");
        expect(stilo.tree.folderFor()).to.equal("p");
        expect(stilo.tree.folderFor(shown.children[0])).to.equal("p");
        stilo.tree.setCurrent(null);
        expect(stilo.tree.folderFor()).to.equal("");
    });

    it("asks for names through its view, the navigation pane opened", async () => {
        const { stilo, requests } = treeSetUp();
        stilo.ui.setNavOpen(false);
        expect(await stilo.tree.askName({ folder: "p", label: "Name" })).to.equal(true);
        expect(stilo.ui.navOpen).to.equal(true);
        expect(requests.map((r) => r.folder)).to.deep.equal(["p"]);
    });

    it("creates a folder with the name asked for, and makes it the current item", async () => {
        const { newFolder } = await import("../src/builtins/files.js");
        const { stilo } = treeSetUp();
        const created = [];
        stilo.transport.createFolder = async (path) => {
            created.push(path);
            shown.children.push({ name: "new", path: "p/new", type: "folder", children: [] });
        };
        stilo.tree.attachView({ askName: async ({ submit }) => !(await submit("_ok")) && !(await submit("new")) });
        await stilo.tree.refresh();
        stilo.tree.setCurrent("p");
        await newFolder(stilo);
        shown.children.pop();
        expect(created).to.deep.equal(["p/_ok", "p/new"]);
    });

    it("opens the Move to… dialog, shows a failure there, and closes it", async () => {
        const { moveTo } = await import("../src/builtins/files.js");
        const { stilo } = treeSetUp();
        stilo.transport.moveItem = async () => {
            throw new ApiError(409, "exists");
        };
        const node = shown.children[0].children[0];
        await moveTo(stilo, node);
        expect(stilo.tree.moving.node).to.equal(node);
        await stilo.tree.chooseMove("q");
        expect(stilo.tree.moving.error).to.equal("x already exists in that folder.");
        stilo.tree.endMove();
        expect(stilo.tree.moving).to.equal(null);
    });
});
