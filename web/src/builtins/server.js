// What the server says, applied through the services as an extension would
// (protocol v1, S17): its read-only items, and its asking for a login.

import { inArchive } from "../api.js";
import { ARCHIVE_REASON, findNode } from "../core/tree.js";

/** The read-only items the server marks in the tree (`readOnly`). An item
 * the tree does not show, such as a document opened by its address, is
 * read-only if its path goes through a packed package (S23). */
function serverReadOnly(stilo) {
    return stilo.tree.readOnly((path) => {
        const node = findNode(stilo.tree.tree, path);
        return node ? (node.readOnly ?? null) : inArchive(path) ? ARCHIVE_REASON : null;
    });
}

/** The address of the login page with `next`, the page to come back to. */
export function loginUrl(login, next = location.href) {
    const url = new URL(login, location.href);
    url.searchParams.set("next", next);
    return url.href;
}

/**
 * A request the server answers with `401` and a `login` address asks the
 * user, in a dialog, to sign in, and goes to the login page if they agree;
 * the request fails as it would. One question at a time. The server's info
 * never asks: `startStilo` reads it before the app, and its dialogs, are
 * there; the app's first request after it asks instead. Added outermost
 * (`transport.use(…, {outermost: true})`): an extension's middleware sees the
 * response first and can handle a `401` its own way.
 */
function askForLogin(stilo, go = (url) => location.assign(url)) {
    let asking = false;
    return stilo.transport.use?.(
        async (url, init, next) => {
            const response = await next(url, init);
            if (response.status !== 401 || asking || isInfo(url)) return response;
            // Taken at once, so that requests failing together ask once
            asking = true;
            let body = {};
            try {
                body = await response.clone().json();
            } catch {}
            if (!body.login) {
                asking = false;
                return response;
            }
            stilo.ui
                .confirm(body.error || "Sign in to continue.", { ok: "Sign in" })
                .then((yes) => yes && go(loginUrl(body.login)))
                .finally(() => (asking = false));
            return response;
        },
        { outermost: true },
    );
}

/** Whether `url` is the server's info, `/_api/info`. */
const isInfo = (url) => new URL(url, location.href).pathname === "/_api/info";

/** Apply what the server says. Returns the function that stops it. */
export function activate(stilo, { go } = {}) {
    const disposers = [serverReadOnly(stilo), askForLogin(stilo, go)].filter(Boolean);
    return () => disposers.forEach((dispose) => dispose());
}
