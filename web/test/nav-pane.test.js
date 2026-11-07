import { expect, fixture, html } from "@open-wc/testing";
import "../src/components/nav-pane.js";
import "../src/components/move-dialog.js";
import { relativeLink } from "../src/route.js";

const tree = {
    name: "",
    path: "",
    type: "folder",
    children: [
        {
            name: "projects",
            path: "projects",
            type: "folder",
            children: [{ name: "beam.texl", path: "projects/beam.texl", type: "file" }],
        },
    ],
};

async function pane() {
    const el = await fixture(html`<nav-pane .tree=${tree}></nav-pane>`);
    el.fired = [];
    el.addEventListener("tree-command", (e) => el.fired.push(e.detail));
    return el;
}

const row = (el, text) => [...el.renderRoot.querySelectorAll(".row")].find((r) => r.querySelector(".name").textContent === text);
const menu = (el) => el.renderRoot.querySelector("context-menu");
const labels = (el) => [...menu(el).renderRoot.querySelectorAll("button .label")].map((l) => l.textContent);

async function rightClick(el, target) {
    target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true, clientX: 20, clientY: 30 }));
    await el.updateComplete;
    await menu(el)?.updateComplete;
}

function press(target, key, init = {}) {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, composed: true, cancelable: true, ...init }));
}

describe("nav-pane menus", () => {
    it("offers the document commands on a document", async () => {
        const el = await pane();
        await rightClick(el, row(el, "beam").querySelector(".item"));
        expect(labels(el)).to.deep.equal(["Rename", "Duplicate", "Move to…", "Copy link", "Delete"]);
    });

    it("offers the folder commands on a folder", async () => {
        const el = await pane();
        await rightClick(el, row(el, "projects").querySelector(".item"));
        expect(labels(el)).to.deep.equal(["New document…", "New folder…", "Open as root", "Rename", "Move to…", "Delete"]);
    });

    it("offers the pane commands on the empty area", async () => {
        const el = await pane();
        await rightClick(el, el.renderRoot.querySelector(".tree"));
        expect(labels(el)).to.deep.equal(["New document…", "New folder…", "Refresh", "Show empty folders"]);
    });

    it("runs the chosen command on the node of the menu, and closes", async () => {
        const el = await pane();
        await rightClick(el, row(el, "beam").querySelector(".item"));
        menu(el).renderRoot.querySelector("button").click();
        await el.updateComplete;
        expect(el.fired).to.have.length(1);
        expect(el.fired[0].id).to.equal("tree-rename");
        expect(el.fired[0].node.path).to.equal("projects/beam.texl");
        expect(menu(el)).to.equal(null);
    });

    it("opens from the ⋯ button, and a second click closes it", async () => {
        const el = await pane();
        const more = row(el, "beam").querySelector(".more");
        more.click();
        await el.updateComplete;
        expect(menu(el)).to.not.equal(null);
        more.click();
        await el.updateComplete;
        expect(menu(el)).to.equal(null);
    });

    it("closes on Escape and gives the focus back", async () => {
        const el = await pane();
        const item = row(el, "beam").querySelector(".item");
        item.focus();
        await rightClick(el, item);
        press(menu(el).renderRoot.querySelector("button"), "Escape");
        await el.updateComplete;
        expect(menu(el)).to.equal(null);
        expect(el.renderRoot.activeElement).to.equal(item);
    });

    it("moves through the items with the arrow keys, skipping separators", async () => {
        const el = await pane();
        await rightClick(el, row(el, "beam").querySelector(".item"));
        const root = menu(el).renderRoot;
        press(root.activeElement, "ArrowUp");
        expect(root.activeElement.textContent).to.include("Delete");
        press(root.activeElement, "ArrowDown");
        expect(root.activeElement.textContent).to.include("Rename");
    });
});

describe("nav-pane keys", () => {
    it("F2 renames and Delete deletes the focused item", async () => {
        const el = await pane();
        const item = row(el, "beam").querySelector(".item");
        press(item, "F2");
        press(item, "Delete");
        expect(el.fired.map((f) => f.id)).to.deep.equal(["tree-rename", "tree-delete"]);
        expect(el.fired[0].node.path).to.equal("projects/beam.texl");
    });

    it("leaves Shift+F2 alone", async () => {
        const el = await pane();
        press(row(el, "beam").querySelector(".item"), "F2", { shiftKey: true });
        expect(el.fired).to.have.length(0);
    });

    it("remembers the last focused item as the current one", async () => {
        const el = await pane();
        expect(el.current).to.equal(null);
        row(el, "projects").querySelector(".item").focus();
        expect(el.current.path).to.equal("projects");
    });
});

describe("nav-pane empty folders", () => {
    const withEmpty = {
        name: "",
        path: "",
        type: "folder",
        children: [
            { name: "a", path: "a", type: "folder", children: [{ name: "b", path: "a/b", type: "folder", children: [] }] },
            { name: "c", path: "c", type: "folder", children: [{ name: "d.texl", path: "c/d.texl", type: "file" }] },
        ],
    };
    const names = (el) => [...el.renderRoot.querySelectorAll(".name")].map((n) => n.textContent);

    it("shows them by default", async () => {
        const el = await fixture(html`<nav-pane .tree=${withEmpty}></nav-pane>`);
        expect(names(el)).to.deep.equal(["a", "b", "c", "d"]);
    });

    it("hides a folder with no documents at any depth", async () => {
        const el = await fixture(html`<nav-pane .tree=${withEmpty} .showEmpty=${false}></nav-pane>`);
        expect(names(el)).to.deep.equal(["c", "d"]);
    });

    it("says there are no documents when nothing is left", async () => {
        const tree = { ...withEmpty, children: [withEmpty.children[0]] };
        const el = await fixture(html`<nav-pane .tree=${tree} .showEmpty=${false}></nav-pane>`);
        expect(el.renderRoot.querySelector(".empty")).to.not.equal(null);
    });

    it("marks the option in the menu when on", async () => {
        const el = await fixture(html`<nav-pane .tree=${withEmpty}></nav-pane>`);
        await rightClick(el, el.renderRoot.querySelector(".tree"));
        const option = menu(el).renderRoot.querySelector('[role="menuitemcheckbox"]');
        expect(option.getAttribute("aria-checked")).to.equal("true");
        expect(option.textContent).to.include("✓");
    });
});

describe("nav-pane askName", () => {
    const type = (input, value) => {
        input.value = value;
        input.dispatchEvent(new Event("input"));
    };
    const input = (el) => el.renderRoot.querySelector(".naming input");

    it("opens a collapsed folder and offers the value, selected", async () => {
        const el = await pane();
        row(el, "projects").querySelector(".item").click();
        await el.updateComplete;
        expect(row(el, "beam")).to.equal(undefined);
        el.askName({ folder: "projects", value: "untitled", label: "Name", submit: async () => {} });
        await el.updateComplete;
        await el.updateComplete;
        expect(input(el).value).to.equal("untitled");
        expect(el.renderRoot.activeElement).to.equal(input(el));
        expect(input(el).selectionEnd - input(el).selectionStart).to.equal(8);
        expect(row(el, "beam")).to.not.equal(undefined);
    });

    it("submits the trimmed name on Enter", async () => {
        const el = await pane();
        const names = [];
        const answer = el.askName({ folder: "", label: "Name", submit: async (name) => void names.push(name) });
        await el.updateComplete;
        type(input(el), "  new doc ");
        press(input(el), "Enter");
        expect(await answer).to.equal(true);
        expect(names).to.deep.equal(["new doc"]);
        expect(input(el)).to.equal(null);
    });

    it("stays and shows the message when the name cannot be used", async () => {
        const el = await pane();
        let error = "already exists";
        const answer = el.askName({ folder: "", label: "Name", submit: async () => error });
        await el.updateComplete;
        type(input(el), "x");
        press(input(el), "Enter");
        await new Promise((resolve) => setTimeout(resolve));
        await el.updateComplete;
        expect(el.renderRoot.querySelector(".naming-error").textContent).to.equal("already exists");
        expect(input(el).value).to.equal("x");
        error = undefined;
        press(input(el), "Enter");
        expect(await answer).to.equal(true);
    });

    it("gives up on Escape and on an empty name", async () => {
        const el = await pane();
        let answer = el.askName({ folder: "", label: "Name", submit: async () => {} });
        await el.updateComplete;
        press(input(el), "Escape");
        expect(await answer).to.equal(false);
        answer = el.askName({ folder: "", value: "", label: "Name", submit: async () => {} });
        await el.updateComplete;
        press(input(el), "Enter");
        expect(await answer).to.equal(false);
    });
});

describe("nav-pane rename row", () => {
    const input = (el) => el.renderRoot.querySelector(".naming input");

    it("takes the place of the item, keeping a folder's contents", async () => {
        const el = await pane();
        el.askName({ folder: "", replaces: "projects", value: "projects", label: "Name", submit: async () => {} });
        await el.updateComplete;
        await el.updateComplete;
        expect(input(el).value).to.equal("projects");
        expect(row(el, "projects")).to.equal(undefined);
        expect(row(el, "beam")).to.not.equal(undefined);
    });

    it("gives up when submit returns false", async () => {
        const el = await pane();
        const answer = el.askName({ folder: "", replaces: "projects", value: "projects", label: "Name", submit: async () => false });
        await el.updateComplete;
        press(input(el), "Enter");
        expect(await answer).to.equal(false);
        expect(row(el, "projects")).to.not.equal(undefined);
    });

    it("finds the current item again in a new tree", async () => {
        const el = await pane();
        el.setCurrent("projects/beam.texl");
        expect(el.current.name).to.equal("beam.texl");
        el.tree = JSON.parse(JSON.stringify(tree));
        await el.updateComplete;
        expect(el.current.path).to.equal("projects/beam.texl");
        el.tree = { ...tree, children: [] };
        await el.updateComplete;
        expect(el.current).to.equal(null);
    });
});

describe("move-dialog", () => {
    const full = {
        name: "",
        path: "",
        type: "folder",
        children: [
            { name: "a", path: "a", type: "folder", children: [{ name: "b", path: "a/b", type: "folder", children: [] }] },
            { name: "c", path: "c", type: "folder", children: [{ name: "d.texl", path: "c/d.texl", type: "file" }] },
        ],
    };
    const dialog = (node) => fixture(html`<move-dialog .tree=${full} .node=${node}></move-dialog>`);
    const folders = (el) => [...el.renderRoot.querySelectorAll(".folder")];
    const enabled = (el) => folders(el).filter((f) => !f.disabled).map((f) => f.textContent.trim());
    const moveButton = (el) => el.renderRoot.querySelector(".buttons .primary");

    it("lists folders only, and not a document's own folder", async () => {
        const el = await dialog(full.children[1].children[0]);
        expect(folders(el).map((f) => f.textContent.trim())).to.deep.equal(["/", "a", "b", "c"]);
        expect(enabled(el)).to.deep.equal(["/", "a", "b"]);
    });

    it("does not offer a folder itself, what is inside it, or its parent", async () => {
        const el = await dialog(full.children[0]);
        expect(enabled(el)).to.deep.equal(["c"]);
    });

    it("confirms the chosen folder, not before one is chosen", async () => {
        const el = await dialog(full.children[1].children[0]);
        expect(moveButton(el).disabled).to.equal(true);
        let chosen;
        el.addEventListener("choose", (e) => (chosen = e.detail.folder));
        folders(el)[2].click();
        await el.updateComplete;
        moveButton(el).click();
        expect(chosen).to.equal("a/b");
    });

    it("warns about links", async () => {
        const el = await dialog(full.children[1].children[0]);
        expect(el.renderRoot.querySelector(".warning").textContent).to.include("will stop");
    });
});

describe("relativeLink", () => {
    it("goes from the open document's folder", () => {
        expect(relativeLink("projects/beam/check.texl", "library/steel.texl")).to.equal("../../library/steel.texl");
        expect(relativeLink("projects/beam/check.texl", "projects/beam/other.texl")).to.equal("other.texl");
        expect(relativeLink("projects/check.texl", "projects/beam/other.texl")).to.equal("beam/other.texl");
    });

    it("goes from the root when no document is open", () => {
        expect(relativeLink(null, "library/steel.texl")).to.equal("library/steel.texl");
    });

    it("encodes what a link cannot hold", () => {
        expect(relativeLink(null, "my lib/a b.texl")).to.equal("my%20lib/a%20b.texl");
    });
});
