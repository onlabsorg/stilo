// The browser URL decides what the app shows:
//
//   /                          navigation root = server root, no document open
//   /path/to/doc.texl          navigation root = server root, doc.texl open
//   /path/to/doc.texl?root=a/b navigation root a/b, doc.texl open
//   /?root=a/b                 navigation root a/b, no document open
//
// A path that is not a .texl file opens no document. Paths are returned
// relative to the server root, without leading "/".

const strip = (path) => decodeURIComponent(path).replace(/^\/+|\/+$/g, "");

export function readRoute(url = location) {
    const path = strip(url.pathname);
    const root = new URLSearchParams(url.search).get("root");
    return { root: root ? strip(root) : "", doc: path.endsWith(".texl") ? path : null };
}

/** The URL for a route: the document's path, plus `?root=` unless the
 * navigation root is the server root. */
export function routeUrl({ root, doc }) {
    const encode = (p) => p.split("/").map(encodeURIComponent).join("/");
    const base = "/" + (doc ? encode(doc) : "");
    return root ? `${base}?root=${encode(root)}` : base;
}
