// Starting Stilo with extensions (S17).

import { createStilo } from "./core/index.js";
import { activateBuiltins } from "./builtins/index.js";
import "./components/stilo-app.js";

/**
 * Start the app: create its services, activate Stilo's own contributions,
 * then the given extensions in order (one that cannot be activated is
 * reported and skipped), and put a `<stilo-app>` in `target`. Resolves to
 * the app element; its services are its `stilo` property.
 *
 *     import { startStilo } from "@onlabsorg/stilo-web";
 *     startStilo({ extensions: [wordCount] });
 *
 * @param {object} [options]
 * @param {Element} [options.target] - Where the app goes; `document.body` by default.
 * @param {import("./core/extensions.js").Extension[]} [options.extensions]
 * @param {import("./api.js").Transport} [options.transport] - The protocol
 *   client; by default, one for the page's own server.
 * @returns {Promise<import("./components/stilo-app.js").StiloApp>}
 */
export async function startStilo({ target = document.body, extensions = [], transport } = {}) {
    const stilo = createStilo(transport ? { transport } : {});
    activateBuiltins(stilo);
    for (const extension of extensions) await stilo.extensions.activate(extension);
    const app = document.createElement("stilo-app");
    app.stilo = stilo;
    target.append(app);
    return app;
}
