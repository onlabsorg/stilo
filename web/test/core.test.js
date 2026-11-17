import { expect, fixture, html } from "@open-wc/testing";
import { LitElement } from "lit";
import { Service, StiloController, createStilo } from "../src/core/index.js";
import { Transport, ApiError } from "../src/api.js";

describe("Service", () => {
    it("calls listeners with the detail, and stops when told", () => {
        const service = new Service();
        const seen = [];
        const stop = service.on("open", (detail) => seen.push(detail));
        service.emit("open", { path: "a.texl" });
        stop();
        service.emit("open", { path: "b.texl" });
        expect(seen).to.deep.equal([{ path: "a.texl" }]);
    });

    it("fires change", () => {
        const service = new Service();
        let changes = 0;
        service.on("change", () => changes++);
        service.changed();
        expect(changes).to.equal(1);
    });
});

class Counter extends Service {
    constructor() {
        super();
        this.value = 0;
    }
    add() {
        this.value++;
        this.changed();
    }
}

class StiloView extends LitElement {
    constructor() {
        super();
        this.renders = 0;
        this._stilo = new StiloController(this, (stilo) => [stilo.counter]);
    }
    render() {
        this.renders++;
        return html`${this._stilo.stilo?.counter.value ?? "none"}`;
    }
}
customElements.define("test-stilo-view", StiloView);

/** An element that puts the view inside its own shadow root. */
class Wrapper extends LitElement {
    render() {
        return html`<test-stilo-view></test-stilo-view>`;
    }
}
customElements.define("test-stilo-wrapper", Wrapper);

describe("StiloController and <stilo-provider>", () => {
    it("gives the view the stilo object, through shadow roots", async () => {
        const stilo = { counter: new Counter() };
        const el = await fixture(html`<stilo-provider .stilo=${stilo}><test-stilo-wrapper></test-stilo-wrapper></stilo-provider>`);
        const wrapper = el.querySelector("test-stilo-wrapper");
        await wrapper.updateComplete;
        const view = wrapper.renderRoot.querySelector("test-stilo-view");
        await view.updateComplete;
        expect(view._stilo.stilo).to.equal(stilo);
        expect(view.renderRoot.textContent).to.equal("0");
    });

    it("renders the view again when a watched service changes", async () => {
        const stilo = { counter: new Counter() };
        const el = await fixture(html`<stilo-provider .stilo=${stilo}><test-stilo-view></test-stilo-view></stilo-provider>`);
        const view = el.querySelector("test-stilo-view");
        await view.updateComplete;
        stilo.counter.add();
        await view.updateComplete;
        expect(view.renderRoot.textContent).to.equal("1");
    });

    it("follows a new stilo object, and stops watching the old one", async () => {
        const first = { counter: new Counter() };
        const second = { counter: new Counter() };
        const el = await fixture(html`<stilo-provider .stilo=${first}><test-stilo-view></test-stilo-view></stilo-provider>`);
        const view = el.querySelector("test-stilo-view");
        el.stilo = second;
        await el.updateComplete;
        await view.updateComplete;
        expect(view._stilo.stilo).to.equal(second);
        const renders = view.renders;
        first.counter.add();
        await view.updateComplete;
        expect(view.renders).to.equal(renders);
    });
});

describe("createStilo", () => {
    it("makes a transport for the page's server unless given one", () => {
        expect(createStilo().transport).to.be.instanceOf(Transport);
        const transport = new Transport({ origin: "https://example.com" });
        expect(createStilo({ transport }).transport).to.equal(transport);
    });
});

describe("Transport", () => {
    let calls;
    let reply;
    let realFetch;
    beforeEach(() => {
        calls = [];
        reply = () => new Response("text", { headers: { ETag: '"1"' } });
        realFetch = window.fetch;
        window.fetch = async (url, init) => {
            calls.push({ url, init });
            return reply();
        };
    });
    afterEach(() => (window.fetch = realFetch));

    const transport = new Transport({ origin: "https://example.com" });

    it("reads a file at its encoded API address, without the browser's cache", async () => {
        expect(await transport.readFile("my docs/a.texl")).to.deep.equal({ text: "text", etag: '"1"' });
        expect(calls[0].url).to.equal("https://example.com/_api/files/my%20docs/a.texl");
        expect(calls[0].init.cache).to.equal("no-store");
    });

    it("updates a file with the ETag it was read with", async () => {
        await transport.updateFile("a.texl", "new", '"1"');
        expect(calls[0].init.method).to.equal("PUT");
        expect(calls[0].init.headers["If-Match"]).to.equal('"1"');
    });

    it("throws the server's error with its status", async () => {
        reply = () => new Response(JSON.stringify({ error: "file changed" }), { status: 412 });
        const error = await transport.updateFile("a.texl", "new", '"0"').catch((e) => e);
        expect(error).to.be.instanceOf(ApiError);
        expect(error.status).to.equal(412);
        expect(error.message).to.equal("file changed");
    });

    it("turns paths into public URLs and back, on its own server only", () => {
        const url = transport.documentUrl("my docs/a.texl");
        expect(url).to.equal("https://example.com/my%20docs/a.texl");
        expect(transport.documentPath(new URL(url))).to.equal("my docs/a.texl");
        expect(transport.documentPath(new URL("https://example.com/image.png"))).to.equal(null);
        expect(transport.documentPath(new URL("https://other.org/a.texl"))).to.equal(null);
    });
});
