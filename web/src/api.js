// Client of protocol v1 (docs/protocol.md): the `Transport`, the only way the
// web app talks to the server. Paths are relative to the server root, without
// leading "/".

const API = "/_api";

export class ApiError extends Error {
    /**
     * @param {number} status - The HTTP status.
     * @param {string} message - The server's `error`.
     * @param {object} [body] - The whole error body, e.g. `login` with a `401`.
     */
    constructor(status, message, body = {}) {
        super(message);
        this.status = status;
        this.body = body;
    }
}

async function check(response) {
    if (response.ok) return response;
    let message = response.statusText;
    let body = {};
    try {
        body = await response.json();
        message = body.error ?? message;
    } catch {}
    throw new ApiError(response.status, message, body);
}

/** What a version 0 server can do (docs/protocol.md, GET the server's info). */
export const V0_CAPABILITIES = ["files", "tree", "folders", "move", "upload", "home"];

const encode = (path) => path.split("/").map(encodeURIComponent).join("/");

/** Whether the file at `path` is a Texl document; any other file is opened
 * by its public URL, not in the editor. */
export const isDocument = (path) => path.endsWith(".texl");

/** The extension of a packed package: a package in one zip file, which the
 * server shows as a read-only folder (S23). */
export const ARCHIVE_SUFFIX = ".texlz";

/** Whether `path` goes through a packed package: a segment ending in
 * `.texlz`, with more after it. The path of the archive itself names the
 * file, not a path through it. */
export const inArchive = (path) => path.split("/").slice(0, -1).some((segment) => segment.endsWith(ARCHIVE_SUFFIX));

/**
 * The protocol client. Every request goes through `fetch`, so one place
 * decides how the server is reached.
 */
export class Transport {
    /**
     * @param {object} [options]
     * @param {string} [options.origin] - The server's origin; the page's by default.
     */
    constructor({ origin = location.origin } = {}) {
        this.origin = origin;
        /** The middleware, outermost last; then the outermost ones (`use(…, {outermost})`). */
        this._middleware = [];
        this._outermost = [];
        /** The loader of Texl imports for the editor's engine (`load`, bound). */
        this.loader = (url) => this.load(url);
    }

    /**
     * Add a middleware, which every request goes through: a function
     * `(url, init, next) => Response` (or a promise of it) that may change
     * the request, call `next(url, init)` for the response, change it, or
     * answer itself. The one added last is the outermost. Returns the function
     * that removes it.
     * @param {(url: string, init: RequestInit | undefined, next: (url: string, init?: RequestInit) => Promise<Response>) => Response | Promise<Response>} middleware
     * @returns {() => void}
     */
    use(middleware, { outermost = false } = {}) {
        const list = outermost ? this._outermost : this._middleware;
        const entry = { middleware };
        list.push(entry);
        return () => {
            const i = list.indexOf(entry);
            if (i >= 0) list.splice(i, 1);
        };
    }

    /** Send a request through the middleware; the response as it comes,
     * failed or not. Middleware added with `{outermost: true}` (Stilo's
     * handling of a login, for one) wraps all the others, so it sees what
     * they made of the response. */
    send(url, init) {
        const chain = [...this._middleware, ...this._outermost];
        const call = (i, url, init) => (i < 0 ? fetch(url, init) : Promise.resolve(chain[i].middleware(url, init, (u, n) => call(i - 1, u, n))));
        return call(chain.length - 1, url, init);
    }

    /** Send a request to the server; throws an `ApiError` if it fails. */
    async fetch(url, init) {
        return check(await this.send(url, init));
    }

    /**
     * Load a Texl document for the engine's `texl.import`, through the
     * middleware: `{url, source}`, the URL being the final one after
     * redirects (a `~` in the path, for one). Throws if it cannot be read.
     */
    async load(url) {
        const response = await this.fetch(url);
        return { url: response.url || url, source: await response.text() };
    }

    /**
     * A document's public URL, `/<path>`: the server returns the file to
     * `texl.import` and the web app to browsers. It is the editor's `url`.
     */
    documentUrl(path) {
        return new URL("/" + encode(path), this.origin).href;
    }

    /** The path of the document at a public URL, or `null` if the URL is not
     * a `.texl` file on this server. The inverse of `documentUrl`. */
    documentPath(url) {
        if (url.origin !== new URL(this.origin).origin) return null;
        const path = decodeURIComponent(url.pathname.slice(1));
        return isDocument(path) ? path : null;
    }

    /** The URL of a file in the protocol's API. */
    contentUrl(path) {
        return new URL(`${API}/files/${encode(path)}`, this.origin).href;
    }

    /** The URL of a folder's tree in the protocol's API. */
    treeUrl(path) {
        return new URL(`${API}/tree/${encode(path)}`, this.origin).href;
    }

    /**
     * What the server is and can do (`GET /_api/info`): `{protocol, server,
     * capabilities, extensions}`. A server without it (`404`) speaks version
     * 0: every capability of version 0, no extensions.
     */
    async info() {
        try {
            const response = await this.fetch(new URL(`${API}/info`, this.origin).href, { cache: "no-store" });
            return await response.json();
        } catch (error) {
            if (error.status !== 404) throw error;
            return { protocol: 0, server: null, capabilities: [...V0_CAPABILITIES], extensions: [] };
        }
    }

    /** GET a file: `{text, etag}`. */
    async readFile(path) {
        const response = await this.fetch(this.contentUrl(path), { cache: "no-store" });
        return { text: await response.text(), etag: response.headers.get("ETag") };
    }

    /** CREATE a new file; fails with status 409 if it exists. Returns the ETag. */
    async createFile(path, text = "") {
        const headers = { "Content-Type": "text/plain; charset=utf-8" };
        const response = await this.fetch(this.contentUrl(path), { method: "POST", body: text, headers });
        return response.headers.get("ETag");
    }

    /** CREATE a file from a `File` or `Blob` the user chose, of any type;
     * fails with status 409 if it exists. */
    async uploadFile(path, file) {
        const headers = { "Content-Type": "application/octet-stream" };
        await this.fetch(this.contentUrl(path), { method: "POST", body: file, headers });
    }

    /** UPDATE a file, a document or another file (capability `rewrite`), with
     * a text or a `Blob`; fails with status 412 if it changed since `etag`.
     * Returns the new ETag. */
    async updateFile(path, text, etag) {
        const type = typeof text === "string" ? "text/plain; charset=utf-8" : text.type || "application/octet-stream";
        const headers = { "Content-Type": type };
        if (etag) headers["If-Match"] = etag;
        const response = await this.fetch(this.contentUrl(path), { method: "PUT", body: text, headers });
        return response.headers.get("ETag");
    }

    /** QUERY the tree of a folder (`""` is the root). */
    async readTree(path, depth) {
        const query = depth ? `?depth=${depth}` : "";
        const response = await this.fetch(this.treeUrl(path) + query, { cache: "no-store" });
        return response.json();
    }

    /** CREATE a folder, with its missing parents; fails with status 409 if
     * the path exists. */
    async createFolder(path) {
        await this.fetch(this.treeUrl(path), { method: "POST" });
    }

    /** MOVE a file or a folder to the whole new path `to`; fails with status
     * 409 if it exists. */
    async moveItem(path, to) {
        const headers = { "Content-Type": "application/json" };
        const url = new URL(`${API}/move/${encode(path)}`, this.origin).href;
        await this.fetch(url, { method: "POST", body: JSON.stringify({ to }), headers });
    }

    /** DELETE a file. Its folder stays. */
    async deleteFile(path) {
        await this.fetch(this.contentUrl(path), { method: "DELETE" });
    }

    /** DELETE a folder with everything in it: `{deleted}`, the number of files. */
    async deleteFolder(path) {
        const response = await this.fetch(this.treeUrl(path), { method: "DELETE" });
        return response.json();
    }
}
