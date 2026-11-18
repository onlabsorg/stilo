// Protocol v1 in the web app: the server's info, its read-only items, its
// refusals and its asking for a login.

import { expect } from "@open-wc/testing";
import { createStilo, Router } from "../src/core/index.js";
import { Transport, ApiError } from "../src/api.js";
import { activateBuiltins } from "../src/builtins/index.js";
import { activate as activateServer, loginUrl } from "../src/builtins/server.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Run `body` with the page's fetch answering by `answer(url, init)`. */
async function withFetch(answer, body) {
    const realFetch = window.fetch;
    window.fetch = async (url, init) => answer(new URL(url, location.href), init);
    try {
        return await body();
    } finally {
        window.fetch = realFetch;
    }
}

describe("the server's info", () => {
    it("is read from /_api/info, and a 404 means a version 0 server", async () => {
        const transport = new Transport();
        const info = { protocol: 1, server: { name: "stilo", version: "0.4.0" }, capabilities: ["files", "tree"], extensions: [{ id: "history" }] };
        expect(await withFetch(() => json(info), () => transport.info())).to.deep.equal(info);
        const v0 = await withFetch(() => json({ error: "unknown endpoint" }, 404), () => transport.info());
        expect(v0.protocol).to.equal(0);
        expect(v0.capabilities).to.include.members(["files", "tree", "folders", "move", "upload", "home"]);
        expect(v0.capabilities).to.not.include("trash");
        let error;
        await withFetch(() => json({ error: "down" }, 500), () => transport.info()).catch((e) => (error = e));
        expect(error.status).to.equal(500);
    });

    it("says what the server can do: everything until read, then its capabilities", async () => {
        const stilo = createStilo({ transport: { info: async () => ({ protocol: 1, server: { name: "x" }, capabilities: ["files", "tree"], extensions: [{ id: "pdf" }] }) } });
        expect(stilo.info.has("upload")).to.be.true;
        expect(stilo.info.protocol).to.be.null;
        let changes = 0;
        stilo.info.on("change", () => changes++);
        await stilo.info.load();
        expect(changes).to.equal(1);
        expect(stilo.info.protocol).to.equal(1);
        expect(stilo.info.has("files")).to.be.true;
        expect(stilo.info.has("upload")).to.be.false;
        expect(stilo.info.hasExtension("pdf")).to.be.true;
        expect(stilo.info.hasExtension("history")).to.be.false;
    });

    it("counts a transport without info, or info that cannot be read, as able to do everything", async () => {
        const plain = createStilo({ transport: {} });
        await plain.info.load();
        expect(plain.info.has("move")).to.be.true;
        const failing = createStilo({ transport: { info: async () => { throw new ApiError(500, "down"); } } });
        await failing.info.load();
        expect(failing.info.has("move")).to.be.true;
        expect(failing.info.error).to.equal("down");
    });

    it("greys out Stilo's commands the server cannot do, with why", async () => {
        const tree = { path: "", name: "", type: "folder", children: [{ path: "a", name: "a", type: "folder", children: [] }, { path: "b.texl", name: "b.texl", type: "file" }] };
        const stilo = createStilo({ transport: { readTree: async () => tree, info: async () => ({ protocol: 1, capabilities: ["files", "tree"] }) } });
        activateBuiltins(stilo);
        await stilo.tree.refresh();
        await stilo.info.load();
        const reason = (id, node) => stilo.commands.disabledReason(id, { node });
        expect(reason("tree-upload", tree)).to.equal("the server does not take uploaded files");
        expect(reason("tree-new-folder", tree)).to.equal("the server cannot create or delete folders");
        expect(reason("tree-rename", tree.children[1])).to.equal("the server cannot move items");
        expect(reason("tree-move", tree.children[1])).to.equal("the server cannot move items");
        expect(reason("tree-delete", tree.children[0])).to.equal("the server cannot create or delete folders");
        expect(reason("tree-delete", tree.children[1])).to.be.null;
        expect(reason("new-document", tree)).to.be.null;
        expect(reason("save")).to.be.null;
    });
});

describe("read-only items and refusals from the server", () => {
    it("lock what the tree marks read-only, the open document included", async () => {
        const tree = {
            path: "",
            name: "",
            type: "folder",
            children: [
                { path: "references", name: "references", type: "folder", readOnly: "The folder cannot be written on the server", children: [{ path: "references/x.texl", name: "x.texl", type: "file", readOnly: "Its folder cannot be written on the server" }] },
                { path: "a.texl", name: "a.texl", type: "file" },
            ],
        };
        const stilo = createStilo({ transport: { readTree: async () => tree, readFile: async () => ({ text: "", etag: '"e"' }), documentUrl: (p) => `/${p}` } });
        stilo.router = new Router(stilo, { history: { pushState() {}, replaceState() {} }, location: new URL("https://example.com/"), window: new EventTarget() });
        activateBuiltins(stilo);
        await stilo.tree.refresh();
        expect(stilo.tree.readOnlyReason("references")).to.equal("The folder cannot be written on the server");
        expect(stilo.tree.readOnlyReason("a.texl")).to.be.null;
        expect(stilo.commands.disabledReason("tree-delete", { node: tree.children[0] })).to.equal("The folder cannot be written on the server");
        const editor = Object.assign(new EventTarget(), { value: "", editing: false, focus() {} });
        stilo.document.on("change", () => stilo.document.path && !stilo.editor.element && stilo.editor.attach(editor));
        await stilo.document.load("references/x.texl");
        expect(stilo.document.readOnly).to.equal("Its folder cannot be written on the server");
    });

    it("show the server's reason when it refuses a save", async () => {
        const stilo = createStilo({
            transport: {
                readFile: async () => ({ text: "x", etag: '"e"' }),
                updateFile: async () => {
                    throw new ApiError(403, "Libraries are read-only");
                },
                documentUrl: (p) => `/${p}`,
            },
        });
        const editor = Object.assign(new EventTarget(), { value: "x", editing: false, focus() {} });
        stilo.document.on("change", () => stilo.document.path && !stilo.editor.element && stilo.editor.attach(editor));
        await stilo.document.load("a.texl");
        await stilo.document.save();
        expect(stilo.ui.status).to.equal("Not saved: Libraries are read-only");
    });
});

describe("asking for a login", () => {
    const setUp = () => {
        const transport = new Transport();
        const stilo = createStilo({ transport });
        const asked = [];
        let answer = true;
        stilo.ui.confirm = async (message, options) => (asked.push([message, options?.ok]), answer);
        const went = [];
        activateServer(stilo, { go: (url) => went.push(url) });
        return { stilo, transport, asked, went, answer: (a) => (answer = a) };
    };
    const settle = () => new Promise((resolve) => setTimeout(resolve));

    it("adds next to the login address", () => {
        expect(loginUrl("https://example.com/login?app=1", "https://stilo.example/a.texl")).to.equal(
            "https://example.com/login?app=1&next=https%3A%2F%2Fstilo.example%2Fa.texl",
        );
    });

    it("asks to sign in on a 401 with a login address, once, and goes there if the user agrees", async () => {
        const { transport, asked, went } = setUp();
        await withFetch(
            () => json({ error: "Sign in to continue", login: "https://example.com/login" }, 401),
            async () => {
                const results = await Promise.allSettled([transport.readTree(""), transport.readFile("a.texl")]);
                expect(results.map((r) => r.reason?.status)).to.deep.equal([401, 401]);
                expect(results[0].reason.body.login).to.equal("https://example.com/login");
            },
        );
        await settle();
        expect(asked).to.deep.equal([["Sign in to continue", "Sign in"]]);
        expect(went.length).to.equal(1);
        expect(new URL(went[0]).searchParams.get("next")).to.equal(location.href);
    });

    it("does not ask on a 401 without a login address, nor go if the user declines", async () => {
        const { transport, asked, went, answer } = setUp();
        await withFetch(() => json({ error: "No" }, 401), () => transport.readTree("").catch(() => {}));
        await settle();
        expect(asked).to.deep.equal([]);
        answer(false);
        await withFetch(() => json({ error: "Sign in", login: "/login" }, 401), () => transport.readTree("").catch(() => {}));
        await settle();
        expect(asked.length).to.equal(1);
        expect(went).to.deep.equal([]);
    });

    it("leaves a 401 to an extension's middleware that handles it", async () => {
        const { stilo, transport, asked } = setUp();
        await stilo.extensions.activate({
            id: "sso",
            apiVersion: "1",
            activate: (s) => s.transport.use(async (url, init, next) => {
                const response = await next(url, init);
                return response.status === 401 ? json({ error: "Signed in again, try once more" }, 409) : response;
            }),
        });
        await withFetch(() => json({ error: "Sign in", login: "/login" }, 401), () => transport.readTree("").catch(() => {}));
        await settle();
        expect(asked).to.deep.equal([]);
    });
});
