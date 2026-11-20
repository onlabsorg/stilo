import { expect } from "@open-wc/testing";
import { createStilo, Commands, Keys, Menus, matchesKeys, isMac } from "../src/core/index.js";
import { activateBuiltins } from "../src/builtins/index.js";

const key = (init) => new KeyboardEvent("keydown", { cancelable: true, ...init });
const mod = isMac ? { metaKey: true } : { ctrlKey: true };

describe("commands service", () => {
    it("runs a command with the services and a context", () => {
        const stilo = {};
        const commands = new Commands(stilo);
        let seen;
        commands.register({ id: "a", label: "A", group: "G", run: (s, context) => (seen = [s, context]) });
        commands.run("a", { node: 1 });
        expect(seen).to.deep.equal([stilo, { node: 1 }]);
    });

    it("refuses an id taken, and removes a command when disposed", () => {
        const commands = new Commands({});
        const dispose = commands.register({ id: "a", label: "A", group: "G" });
        expect(() => commands.register({ id: "a", label: "B", group: "G" })).to.throw();
        dispose();
        expect(commands.get("a")).to.equal(undefined);
        commands.register({ id: "a", label: "B", group: "G" });
        dispose(); // a second dispose leaves the new command alone
        expect(commands.get("a").label).to.equal("B");
    });

    it("lists the commands in the order they were added, and says when they change", () => {
        const commands = new Commands({});
        let changes = 0;
        commands.on("change", () => changes++);
        commands.register({ id: "b", label: "B", group: "G" });
        commands.register({ id: "a", label: "A", group: "G" });
        expect(commands.list().map((c) => c.id)).to.deep.equal(["b", "a"]);
        expect(changes).to.equal(2);
    });
});

describe("keys service", () => {
    it("matches modifiers exactly", () => {
        expect(matchesKeys(key({ key: "s", ...mod }), "Mod+S")).to.equal(true);
        expect(matchesKeys(key({ key: "S", shiftKey: true, ...mod }), "Mod+S")).to.equal(false);
        expect(matchesKeys(key({ key: "S", shiftKey: true, ...mod }), "Mod+Shift+S")).to.equal(true);
        expect(matchesKeys(key({ key: "s" }), "Mod+S")).to.equal(false);
        expect(matchesKeys(key({ key: "F1" }), "F1")).to.equal(true);
        expect(matchesKeys(key({ key: "F1", altKey: true }), "F1")).to.equal(false);
    });

    it("matches a letter with Alt by its place on the keyboard", () => {
        // macOS: Alt+N types a character, not "n"
        expect(matchesKeys(key({ key: "˜", code: "KeyN", altKey: true }), "Alt+N")).to.equal(true);
        expect(matchesKeys(key({ key: "n", code: "KeyM", altKey: true }), "Alt+N")).to.equal(false);
    });

    it("finds the command of a key event where it applies", () => {
        const keys = new Keys();
        keys.bind("F2", "rename", { when: "tree" });
        keys.bind("Mod+S", "save");
        keys.bind("Enter", "edit", { when: "editor" });
        expect(keys.match(key({ key: "s", ...mod }))).to.equal("save");
        expect(keys.match(key({ key: "F2" }))).to.equal(null);
        expect(keys.match(key({ key: "F2" }), "tree")).to.equal("rename");
        expect(keys.match(key({ key: "Enter" }), "editor")).to.equal(null);
        expect(keys.keysFor("edit")).to.equal("Enter");
    });

    it("lets the last binding win, and brings back the one before when removed", () => {
        const keys = new Keys();
        const warn = console.warn;
        const warnings = [];
        console.warn = (message) => warnings.push(message);
        try {
            keys.bind("Mod+S", "save");
            const dispose = keys.bind("Mod+S", "x.save-all");
            expect(keys.match(key({ key: "s", ...mod }))).to.equal("x.save-all");
            expect(warnings).to.have.length(1);
            dispose();
            expect(keys.match(key({ key: "s", ...mod }))).to.equal("save");
        } finally {
            console.warn = warn;
        }
    });

    it("hides a binding from the lists when asked", () => {
        const keys = new Keys();
        keys.bind("Backspace", "delete", { when: "tree", show: false });
        expect(keys.keysFor("delete")).to.equal("");
        keys.bind("Delete", "delete", { when: "tree" });
        expect(keys.keysFor("delete")).to.equal("Delete");
    });
});

describe("menus service", () => {
    it("lists commands by group, groups in the order first used, with separators", () => {
        const menus = new Menus();
        menus.add("m", "a", { group: "one" });
        menus.add("m", "c", { group: "two" });
        menus.add("m", "b", { group: "one" });
        menus.add("other", "z");
        expect(menus.items("m")).to.deep.equal(["a", "b", "-", "c"]);
    });

    it("orders a group by order, and drops a group left empty", () => {
        const menus = new Menus();
        menus.add("m", "a", { group: "one", order: 2 });
        menus.add("m", "b", { group: "one", order: 1 });
        const dispose = menus.add("m", "c", { group: "two" });
        dispose();
        expect(menus.items("m")).to.deep.equal(["b", "a"]);
    });
});

describe("Stilo's own commands", () => {
    it("are registered once, with their keys and the navigation pane's menus", () => {
        const stilo = createStilo();
        activateBuiltins(stilo);
        activateBuiltins(stilo);
        expect(stilo.commands.get("save").label).to.equal("Save");
        expect(stilo.keys.match(key({ key: "s", ...mod }))).to.equal("save");
        expect(stilo.keys.keysFor("tree-delete")).to.equal("Delete");
        expect(stilo.menus.items("tree/document")).to.deep.equal([
            "tree-rename",
            "tree-duplicate",
            "tree-move",
            "tree-copy-link",
            "-",
            "tree-delete",
        ]);
        expect(stilo.menus.items("tree/pane")).to.deep.equal([
            "new-document",
            "tree-new-folder",
            "tree-upload",
            "-",
            "tree-refresh",
            "tree-show-other",
        ]);
    });
});

describe("ui service", () => {
    it("changes only when a value changes", async () => {
        const { UI } = await import("../src/core/index.js");
        const ui = new UI();
        let changes = 0;
        ui.on("change", () => changes++);
        ui.notify("Saved");
        ui.notify("Saved");
        ui.togglePane("comments");
        expect(ui.pane).to.equal("comments");
        ui.togglePane("comments");
        expect(ui.pane).to.equal(null);
        ui.toggleNav();
        expect(ui.navOpen).to.equal(false);
        expect(changes).to.equal(4);
    });
});

describe("panels service", () => {
    it("lists panels by order, refuses a taken id, and keeps badges", async () => {
        const { Panels } = await import("../src/core/index.js");
        const panels = new Panels();
        panels.register({ id: "b", label: "B", order: 20, render: () => "" });
        const dispose = panels.register({ id: "a", label: "A", order: 10, render: () => "" });
        expect(() => panels.register({ id: "a", label: "A2", render: () => "" })).to.throw();
        expect(panels.list().map((p) => p.id)).to.deep.equal(["a", "b"]);
        panels.setBadge("a", { text: "3" });
        expect(panels.badge("a").text).to.equal("3");
        dispose();
        expect(panels.badge("a")).to.equal(undefined);
        expect(panels.list().map((p) => p.id)).to.deep.equal(["b"]);
    });

    it("takes a badge away with the function setBadge returns, unless another was set since", async () => {
        const { Panels } = await import("../src/core/index.js");
        const panels = new Panels();
        panels.register({ id: "a", label: "A", render: () => "" });
        const first = panels.setBadge("a", { text: "1" });
        const second = panels.setBadge("a", { text: "2" });
        expect(first.key).to.equal("panels.badge:a");
        expect(second.key).to.equal(first.key);
        first(); // replaced since: nothing happens
        expect(panels.badge("a").text).to.equal("2");
        second();
        expect(panels.badge("a")).to.equal(undefined);
        expect(typeof panels.setBadge("a", null)).to.equal("function");
    });
});

describe("top bar", () => {
    it("shows the status and one button per panel, with its badge, and toggles them", async () => {
        const { fixture, html } = await import("@open-wc/testing");
        await import("../src/components/top-bar.js");
        const stilo = createStilo();
        stilo.panels.register({ id: "x.one", label: "One", icon: "1", order: 2, render: () => "" });
        stilo.panels.register({ id: "x.two", label: "Two", icon: "2", order: 1, render: () => "" });
        stilo.panels.setBadge("x.one", { text: "5", label: "5 things", tone: "danger" });
        stilo.ui.notify("Saved");
        const el = await fixture(html`<stilo-provider .stilo=${stilo}><top-bar heading="Doc"></top-bar></stilo-provider>`);
        const bar = el.querySelector("top-bar");
        await bar.updateComplete;
        const buttons = [...bar.renderRoot.querySelectorAll(".right button")];
        expect(buttons.map((b) => b.getAttribute("aria-label"))).to.deep.equal(["Two", "5 things"]);
        expect(buttons[1].classList.contains("danger")).to.equal(true);
        expect(bar.renderRoot.querySelector(".status").textContent).to.equal("Saved");
        buttons[1].click();
        expect(stilo.ui.pane).to.equal("x.one");
        await bar.updateComplete;
        expect(buttons[1].getAttribute("aria-pressed")).to.equal("true");
    });
});

describe("errors service and pane", () => {
    const error = (key, count, line) => ({
        key,
        count,
        lines: [line],
        description: "`x` is not defined",
        location: { uri: null, local: true, line, textLine: 0, source: "x", pos: 0 },
        causes: [],
    });

    it("counts the values, points one out and opens the panel", async () => {
        const stilo = createStilo();
        stilo.errors.set([error("a", 2, 1), error("b", 1, 3)]);
        expect(stilo.errors.count).to.equal(3);
        stilo.errors.show("b");
        expect(stilo.errors.current).to.equal("b");
        expect(stilo.ui.pane).to.equal("errors");
        stilo.errors.clear();
        expect([stilo.errors.count, stilo.errors.current]).to.deep.equal([0, null]);
    });

    it("puts their number on the errors panel's button", () => {
        const stilo = createStilo();
        activateBuiltins(stilo);
        stilo.errors.set([error("a", 2, 1)]);
        expect(stilo.panels.badge("errors")).to.include({ text: "2", label: "2 errors", tone: "danger" });
        stilo.errors.set([]);
        expect(stilo.panels.badge("errors")).to.equal(undefined);
    });

    it("lists them, highlights the one pointed out, and goes to a place on a click", async () => {
        const { fixture, html } = await import("@open-wc/testing");
        await import("../src/components/errors-pane.js");
        const stilo = createStilo();
        stilo.errors.set([error("a", 1, 1), error("b", 1, 3)]);
        stilo.errors.show("b");
        const places = [];
        stilo.errors.on("go-to", (place) => places.push(place));
        const el = await fixture(html`<stilo-provider .stilo=${stilo}><errors-pane></errors-pane></stilo-provider>`);
        const pane = el.querySelector("errors-pane");
        await pane.updateComplete;
        const entries = [...pane.renderRoot.querySelectorAll(".entry")];
        expect(entries).to.have.length(2);
        expect(entries[1].classList.contains("current")).to.equal(true);
        entries[1].click();
        expect(places).to.deep.equal([{ line: 3 }]);
        pane.renderRoot.querySelector("[aria-label=Close]").click();
        expect(stilo.ui.pane).to.equal(null);
    });
});

describe("comments service and pane", () => {
    const text = "<!--{ aaaa : text }-->\nOne\n<!--{ bbbb : text }-->\nTwo\n<!--[ Check this. ]-->\n<!--{ cccc : text }-->\nThree\n<!--[ And this. ]-->\n";

    it("reads the comments of each line, points one out and opens the panel", () => {
        const stilo = createStilo();
        stilo.comments.read(text);
        expect(stilo.comments.list.map((c) => c.comments.length)).to.deep.equal([0, 1, 1]);
        stilo.comments.show(2);
        expect([stilo.comments.line, stilo.ui.pane]).to.deep.equal([2, "comments"]);
        stilo.comments.clear();
        expect([stilo.comments.list.length, stilo.comments.line]).to.deep.equal([0, null]);
    });

    it("lists the lines with comments, highlights the one pointed out, and goes to a line on a click", async () => {
        const { fixture, html } = await import("@open-wc/testing");
        await import("../src/components/comments-pane.js");
        const stilo = createStilo();
        stilo.comments.read(text);
        stilo.comments.show(3);
        const places = [];
        stilo.comments.on("go-to", (place) => places.push(place));
        const el = await fixture(html`<stilo-provider .stilo=${stilo}><comments-pane></comments-pane></stilo-provider>`);
        const pane = el.querySelector("comments-pane");
        await pane.updateComplete;
        const entries = [...pane.renderRoot.querySelectorAll(".entry")];
        expect(entries.map((e) => e.querySelector(".where").textContent)).to.deep.equal(["Cell 2", "Cell 3"]);
        expect(entries[1].classList.contains("current")).to.equal(true);
        entries[0].click();
        expect(places).to.deep.equal([{ line: 2 }]);
        expect(stilo.comments.line).to.equal(2);
        pane.renderRoot.querySelector("[aria-label=Close]").click();
        expect(stilo.ui.pane).to.equal(null);
    });
});
