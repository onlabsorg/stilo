// Client of protocol v0 (docs/protocol.md): the `Transport`, the only way the
// web app talks to the server. Paths are relative to the server root, without
// leading "/".

const API = "/_api";

export class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

async function check(response) {
    if (response.ok) return response;
    let message = response.statusText;
    try {
        message = (await response.json()).error ?? message;
    } catch {}
    throw new ApiError(response.status, message);
}

const encode = (path) => path.split("/").map(encodeURIComponent).join("/");

/** Whether the file at `path` is a Texl document; any other file is opened
 * by its public URL, not in the editor. */
export const isDocument = (path) => path.endsWith(".texl");

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
    }

    /** Send a request to the server; throws an `ApiError` if it fails. */
    async fetch(url, init) {
        return check(await fetch(url, init));
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

    /** UPDATE a file; fails with status 412 if it changed since `etag`.
     * Returns the new ETag. */
    async updateFile(path, text, etag) {
        const headers = { "Content-Type": "text/plain; charset=utf-8" };
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
