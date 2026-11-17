import { expect, fixture, html } from "@open-wc/testing";
import { createStilo, Settings } from "../src/core/index.js";
import { startStilo } from "../src/start.js";
import "../src/components/top-bar.js";

/** An app on a fake server, in the page. */
async function app() {
    const target = document.createElement("div");
    document.body.append(target);
    const transport = { readTree: async () => ({ path: "", name: "", type: "folder", children: [] }), documentUrl: (p) => `/${p}`, documentPath: () => null };
    const el = await startStilo({ target, transport });
    await el.updateComplete;
    return { el, stilo: el.stilo, remove: () => target.remove() };
}

/** The dialog the app shows, once rendered. */
async function shown(el) {
    await el.updateComplete;
    const host = el.shadowRoot.querySelector("stilo-dialog");
    if (!host) return null;
    await host.updateComplete;
    return host.shadowRoot.querySelector("dialog");
}

describe("ui: status levels", () => {
    it("keep the level of the message, and colour it in the top bar", async () => {
        const stilo = createStilo();
        stilo.ui.notify("Not saved", { level: "error" });
        expect(stilo.ui.level).to.equal("error");
        const host = await fixture(html`<stilo-provider .stilo=${stilo}><top-bar></top-bar></stilo-provider>`);
        const bar = host.querySelector("top-bar");
        await bar.updateComplete;
        expect(bar.renderRoot.querySelector(".status").classList.contains("error")).to.be.true;
        stilo.ui.notify("Saved");
        expect(stilo.ui.level).to.equal("info");
        stilo.ui.notify("", { level: "warning" });
        expect(stilo.ui.level).to.equal("info");
    });
});

describe("ui: dialogs", () => {
    it("use the browser's without a view for dialogs, and refuse a custom one", async () => {
        const stilo = createStilo();
        const confirm = window.confirm;
        window.confirm = (message) => message === "Sure?";
        try {
            expect(await stilo.ui.confirm("Sure?")).to.be.true;
        } finally {
            window.confirm = confirm;
        }
        let error;
        await stilo.ui.dialog(() => "").catch((e) => (error = e));
        expect(error).to.exist;
    });

    it("confirm in a dialog of Stilo's own: OK, Cancel and Escape", async () => {
        const { el, stilo, remove } = await app();
        try {
            let answer = stilo.ui.confirm("Delete the folder?", { ok: "Delete", danger: true });
            let dialog = await shown(el);
            expect(dialog.open).to.be.true;
            expect(dialog.querySelector(".message").textContent).to.equal("Delete the folder?");
            const ok = dialog.querySelector("button.primary");
            expect(ok.textContent).to.equal("Delete");
            expect(ok.classList.contains("danger")).to.be.true;
            ok.click();
            expect(await answer).to.be.true;
            expect(await shown(el)).to.be.null;

            answer = stilo.ui.confirm("Again?");
            dialog = await shown(el);
            dialog.querySelector("button.secondary").click();
            expect(await answer).to.be.false;

            answer = stilo.ui.confirm("Once more?");
            dialog = await shown(el);
            dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
            expect(await answer).to.be.false;
        } finally {
            remove();
        }
    });

    it("prompt for a text, and show a custom dialog that closes with a value", async () => {
        const { el, stilo, remove } = await app();
        try {
            const name = stilo.ui.prompt("Name of the copy", "beam copy");
            let dialog = await shown(el);
            const input = dialog.querySelector("input");
            expect(input.value).to.equal("beam copy");
            input.value = "beam 2";
            dialog.querySelector("button.primary").click();
            expect(await name).to.equal("beam 2");

            const cancelled = stilo.ui.prompt("Name");
            dialog = await shown(el);
            dialog.querySelector("button.secondary").click();
            expect(await cancelled).to.be.null;

            const picked = stilo.ui.dialog((close) => html`<p>Pick</p><button class="a" @click=${() => close("a")}>A</button>`);
            dialog = await shown(el);
            dialog.querySelector("button.a").click();
            expect(await picked).to.equal("a");
        } finally {
            remove();
        }
    });

    it("keep the window's shortcuts off while a dialog is open", async () => {
        const { el, stilo, remove } = await app();
        try {
            let ran = 0;
            stilo.commands.register({ id: "x.go", label: "Go", group: "File", run: () => ran++ });
            stilo.keys.bind("Alt+Q", "x.go");
            const key = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "q", code: "KeyQ", altKey: true, cancelable: true }));
            key();
            expect(ran).to.equal(1);
            const answer = stilo.ui.confirm("Sure?");
            await shown(el);
            key();
            expect(ran).to.equal(1);
            stilo.ui.currentDialog.close(false);
            await answer;
        } finally {
            remove();
        }
    });
});

describe("settings", () => {
    const clear = () => {
        for (const key of Object.keys(localStorage)) if (key.startsWith("stilo.ext.")) localStorage.removeItem(key);
    };
    beforeEach(clear);
    afterEach(clear);

    it("keep values by key in the browser, by namespace, and say when they change", () => {
        const settings = new Settings("test");
        const changes = [];
        settings.on("change", (detail) => changes.push(detail));
        expect(settings.get("size", 12)).to.equal(12);
        settings.set("size", 14);
        settings.set("words", { min: 1, list: ["a"] });
        expect(settings.get("size")).to.equal(14);
        expect(settings.get("words")).to.deep.equal({ min: 1, list: ["a"] });
        expect(localStorage.getItem("stilo.ext.test.size")).to.equal("14");
        expect(settings.keys().sort()).to.deep.equal(["size", "words"]);
        settings.remove("size");
        expect(settings.get("size", 12)).to.equal(12);
        expect(changes.map((c) => c.key)).to.deep.equal(["size", "words", "size"]);
        expect(settings.scope("other").get("words")).to.be.undefined;
    });

    it("give each extension its own, and stop its listeners on deactivate", async () => {
        const stilo = createStilo();
        let given;
        let heard = 0;
        await stilo.extensions.activate({
            id: "word-count",
            apiVersion: "1",
            activate(s) {
                given = s.settings;
                s.settings.on("change", () => heard++);
            },
        });
        given.set("goal", 500);
        expect(localStorage.getItem("stilo.ext.word-count.goal")).to.equal("500");
        expect(stilo.settings.scope("word-count").get("goal")).to.equal(500);
        expect(stilo.settings.get("goal")).to.be.undefined;
        expect(heard).to.equal(1);
        stilo.extensions.deactivate("word-count");
        stilo.settings.scope("word-count").set("goal", 600);
        expect(heard).to.equal(1);
    });
});

describe("the dialog element", () => {
    it("gives the focus back to where it was when it closes", async () => {
        const { el, stilo, remove } = await app();
        const button = document.createElement("button");
        document.body.append(button);
        try {
            button.focus();
            const answer = stilo.ui.confirm("Sure?");
            const dialog = await shown(el);
            expect(document.activeElement).to.not.equal(button);
            dialog.querySelector("button.secondary").click();
            await answer;
            await el.updateComplete;
            expect(document.activeElement).to.equal(button);
        } finally {
            button.remove();
            remove();
        }
    });
});
