import { expect } from "@open-wc/testing";
import { createStilo, Router } from "../src/core/index.js";
import { readRoute, routeUrl } from "../src/route.js";
import { startStilo } from "../src/start.js";

const at = (address) => new URL(address, "https://example.com");

describe("routes with views", () => {
    it("read a view and its parameters, and no document with it", () => {
        expect(readRoute(at("/a/b.texl?root=a"))).to.deep.equal({ root: "a", doc: "a/b.texl", view: null, params: {} });
        expect(readRoute(at("/?view=history.compare&root=a&path=a%2Fb.texl&rev=3"))).to.deep.equal({
            root: "a",
            doc: null,
            view: "history.compare",
            params: { path: "a/b.texl", rev: "3" },
        });
        expect(readRoute(at("/a/b.texl?view=x.page")).doc).to.be.null;
    });

    it("build the address back", () => {
        expect(routeUrl({ root: "", doc: "a/b c.texl" })).to.equal("/a/b%20c.texl");
        expect(routeUrl({ root: "a", doc: null })).to.equal("/?root=a");
        const url = routeUrl({ root: "a/b", view: "x.page", params: { path: "a/b.texl", q: "x&y" } });
        expect(url).to.equal("/?view=x.page&root=a/b&path=a%2Fb.texl&q=x%26y");
        expect(readRoute(at(url))).to.deep.equal({ root: "a/b", doc: null, view: "x.page", params: { path: "a/b.texl", q: "x&y" } });
    });
});

/** The services on a fake server and browser at `address`. */
function setUp(address = "/a/b.texl") {
    const stilo = createStilo({
        transport: {
            readFile: async () => ({ text: "text", etag: '"e"' }),
            readTree: async () => ({ path: "", name: "", type: "folder", children: [] }),
            documentUrl: (path) => `https://example.com/${path}`,
        },
    });
    const history = [];
    stilo.router = new Router(stilo, {
        history: { pushState: (_, __, to) => history.push(["push", to]), replaceState: (_, __, to) => history.push(["replace", to]) },
        location: at(address),
        window: new EventTarget(),
    });
    const editor = Object.assign(new EventTarget(), { value: "", editing: false, focus() {} });
    stilo.document.on("change", () => stilo.document.path && !stilo.editor.element && stilo.editor.attach(editor));
    const questions = [];
    stilo.ui.confirm = async (q) => (questions.push(q), true);
    return { stilo, history, questions };
}

describe("views service and router", () => {
    it("open a view in place of the document, with a history entry, and go back to it", async () => {
        const { stilo, history, questions } = setUp();
        await stilo.router.start();
        expect(stilo.document.path).to.equal("a/b.texl");
        stilo.views.register({ id: "x.page", label: "Page", render: () => "" });
        await stilo.views.open("x.page", { n: "1" });
        expect(stilo.router.view).to.equal("x.page");
        expect(stilo.router.params).to.deep.equal({ n: "1" });
        expect(stilo.document.path).to.be.null;
        expect(history).to.deep.equal([["push", "/?view=x.page&n=1"]]);
        expect(questions).to.deep.equal([]);
        // Back: the address of the document again
        await stilo.router.apply(readRoute(at("/a/b.texl")));
        expect(stilo.router.view).to.be.null;
        expect(stilo.router.params).to.deep.equal({});
        expect(stilo.document.path).to.equal("a/b.texl");
    });

    it("ask before leaving unsaved changes for a view", async () => {
        const { stilo, questions } = setUp();
        await stilo.router.start();
        stilo.editor.emit("edit");
        await stilo.views.open("x.page");
        expect(questions).to.deep.equal(["Discard unsaved changes?"]);
    });

    it("fire change when only the parameters change", async () => {
        const { stilo } = setUp("/?view=x.page&n=1");
        await stilo.router.start();
        let changes = 0;
        stilo.router.on("change", () => changes++);
        await stilo.router.apply({ root: "", view: "x.page", params: { n: "2" } });
        await stilo.router.apply({ root: "", view: "x.page", params: { n: "2" } });
        expect(changes).to.equal(1);
        expect(stilo.router.route).to.deep.equal({ root: "", doc: null, view: "x.page", params: { n: "2" } });
    });

    it("take an extension's views, by its ids, until it is deactivated", async () => {
        const { stilo } = setUp();
        const consoleError = console.error;
        console.error = () => {};
        try {
            expect(await stilo.extensions.activate({ id: "dash", apiVersion: "1", activate: (s) => s.views.register({ id: "board", label: "B", render: () => "" }) })).to.be.false;
            expect(await stilo.extensions.activate({ id: "dash", apiVersion: "1", activate: (s) => s.views.register({ id: "dash.board", label: "B", render: () => "" }) })).to.be.true;
        } finally {
            console.error = consoleError;
        }
        expect(stilo.views.get("dash.board")).to.exist;
        stilo.extensions.deactivate("dash");
        expect(stilo.views.get("dash.board")).to.be.undefined;
    });
});

describe("views in the app", () => {
    it("show in place of the editor, with their label in the top bar, or say they are not there", async () => {
        const target = document.createElement("div");
        document.body.append(target);
        const transport = { readTree: async () => ({ path: "", name: "", type: "folder", children: [] }), documentUrl: (p) => `/${p}`, documentPath: () => null };
        try {
            const app = await startStilo({
                target,
                transport,
                extensions: [
                    {
                        id: "dash",
                        apiVersion: "1",
                        activate: (s) => s.views.register({ id: "dash.board", label: "Dashboard", render: (stilo, params) => s.html`<p>Board ${params.n}</p>` }),
                    },
                ],
            });
            await app.stilo.router.apply({ root: "", view: "dash.board", params: { n: "7" } });
            await app.updateComplete;
            expect(app.shadowRoot.querySelector(".view").textContent.trim()).to.equal("Board 7");
            expect(app.shadowRoot.querySelector("texl-editor")).to.be.null;
            const bar = app.shadowRoot.querySelector("top-bar");
            await bar.updateComplete;
            expect(bar.renderRoot.querySelector(".title").textContent).to.contain("Dashboard");
            await app.stilo.router.apply({ root: "", view: "gone.page", params: {} });
            await app.updateComplete;
            expect(app.shadowRoot.querySelector(".placeholder").textContent).to.contain("gone.page");
        } finally {
            target.remove();
        }
    });
});
