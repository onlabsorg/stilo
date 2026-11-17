import { expect } from "@open-wc/testing";
import { createStilo, API_VERSION, compatible } from "../src/core/index.js";
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
        for (const name of ["html", "css", "svg", "LitElement", "styles", "apiVersion", "commands", "keys", "menus", "panels", "document", "editor", "tree", "transport"])
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
