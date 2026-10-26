// Client of protocol v0 (docs/protocol.md). Paths are relative to the server
// root, without leading "/".

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

/**
 * A document's public URL, `/<path>`: the server returns the file to
 * `texl.import` and the web app to browsers. It is the editor's `url`.
 */
export function documentUrl(path) {
    return new URL("/" + encode(path), location.origin).href;
}

/** The URL of a file in the protocol's API. */
export function contentUrl(path) {
    return new URL(`${API}/files/${encode(path)}`, location.origin).href;
}

/** GET a file: `{text, etag}`. */
export async function readFile(path) {
    const response = await check(await fetch(contentUrl(path), { cache: "no-store" }));
    return { text: await response.text(), etag: response.headers.get("ETag") };
}

/** CREATE a new file; fails with status 409 if it exists. Returns the ETag. */
export async function createFile(path, text = "") {
    const response = await check(
        await fetch(contentUrl(path), { method: "POST", body: text, headers: { "Content-Type": "text/plain; charset=utf-8" } }),
    );
    return response.headers.get("ETag");
}

/** UPDATE a file; fails with status 412 if it changed since `etag`. Returns the new ETag. */
export async function updateFile(path, text, etag) {
    const headers = { "Content-Type": "text/plain; charset=utf-8" };
    if (etag) headers["If-Match"] = etag;
    const response = await check(await fetch(contentUrl(path), { method: "PUT", body: text, headers }));
    return response.headers.get("ETag");
}

/** QUERY the tree of a folder (`""` is the root). */
export async function readTree(path, depth) {
    const query = depth ? `?depth=${depth}` : "";
    const response = await check(await fetch(`${API}/tree/${encode(path)}${query}`, { cache: "no-store" }));
    return response.json();
}
