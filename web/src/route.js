// The browser URL decides what the app shows:
//
//   /                          navigation root = server root, no document open
//   /path/to/doc.texl          navigation root = server root, doc.texl open
//   /path/to/doc.texl?root=a/b navigation root a/b, doc.texl open
//   /?root=a/b                 navigation root a/b, no document open
//   /?view=x.page&k=v          the view x.page (a page that is not a document,
//                              S17), with the parameters {k: "v"}
//
// A path that is not a .texl file opens no document, and neither does an
// address with a view. Paths are returned relative to the server root,
// without leading "/".

const strip = (path) => decodeURIComponent(path).replace(/^\/+|\/+$/g, "");

/**
 * The route of an address: `{root, doc, view, params}`, `view` being the id
 * of a view or `null`, and `params` the other parameters of its query
 * string (`{}` without a view).
 */
export function readRoute(url = location) {
    const path = strip(url.pathname);
    const query = new URLSearchParams(url.search);
    const root = query.get("root");
    const view = query.get("view") || null;
    const params = {};
    if (view) for (const [key, value] of query) if (key !== "root" && key !== "view" && !(key in params)) params[key] = value;
    return { root: root ? strip(root) : "", doc: !view && path.endsWith(".texl") ? path : null, view, params };
}

/** The URL for a route: the document's path, plus `?root=` unless the
 * navigation root is the server root; or for a view `/?view=<id>`, the
 * root and its parameters. */
export function routeUrl({ root, doc, view, params = {} }) {
    const encode = (p) => p.split("/").map(encodeURIComponent).join("/");
    const query = [];
    if (view) query.push(`view=${encodeURIComponent(view)}`);
    if (root) query.push(`root=${encode(root)}`);
    if (view) for (const [key, value] of Object.entries(params)) query.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    const base = "/" + (doc && !view ? encode(doc) : "");
    return query.length ? `${base}?${query.join("&")}` : base;
}

/**
 * The link to the document at `path` from the document `from` (from the server
 * root if `null`): relative, so it works under any server and in `stilo render`,
 * and encoded, so it is a valid address in `texl.import` and in Markdown.
 */
export function relativeLink(from, path) {
    const folder = (from ?? "").split("/").slice(0, -1);
    const target = path.split("/");
    let shared = 0;
    while (shared < folder.length && shared < target.length - 1 && folder[shared] === target[shared]) shared++;
    return [...folder.slice(shared).map(() => ".."), ...target.slice(shared).map(encodeURIComponent)].join("/");
}
