// The core of the web app (S17): `createStilo()` builds the `stilo` object,
// the services that hold the app's state and behaviour. The views (the panes)
// show them, and Stilo's own commands and panes use them as extensions will.

import { Transport } from "../api.js";
import { Commands } from "./commands.js";
import { Keys } from "./keys.js";
import { Menus } from "./menus.js";
import { UI } from "./ui.js";
import { Panels } from "./panels.js";

export { Service } from "./service.js";
export { stiloContext, StiloController, StiloProvider } from "./context.js";
export { Commands } from "./commands.js";
export { Keys, isMac, formatKeys, parseKeys, matchesKeys } from "./keys.js";
export { Menus } from "./menus.js";
export { UI } from "./ui.js";
export { Panels } from "./panels.js";

/**
 * Create the services of one app.
 * @param {object} [options]
 * @param {Transport} [options.transport] - The protocol client; by default,
 *   one for the page's own server.
 */
export function createStilo({ transport = new Transport() } = {}) {
    const stilo = { transport };
    stilo.commands = new Commands(stilo);
    stilo.keys = new Keys();
    stilo.menus = new Menus();
    stilo.ui = new UI();
    stilo.panels = new Panels();
    return stilo;
}
