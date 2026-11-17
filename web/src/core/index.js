// The core of the web app (S17): `createStilo()` builds the `stilo` object,
// the services that hold the app's state and behaviour. The views (the panes)
// show them, and Stilo's own commands and panes use them as extensions will.

import { Transport } from "../api.js";
import { Commands } from "./commands.js";
import { Keys } from "./keys.js";
import { Menus } from "./menus.js";
import { UI } from "./ui.js";
import { Panels } from "./panels.js";
import { TopBar, Status } from "./registry.js";
import { Errors } from "./errors.js";
import { Comments } from "./comments.js";
import { Editor } from "./editor.js";
import { Document } from "./document.js";
import { Router } from "./router.js";
import { Tree } from "./tree.js";
import { Extensions, API_VERSION } from "./extensions.js";

export { Service } from "./service.js";
export { stiloContext, StiloController, StiloProvider } from "./context.js";
export { Commands } from "./commands.js";
export { Keys, isMac, formatKeys, parseKeys, matchesKeys } from "./keys.js";
export { Menus } from "./menus.js";
export { UI } from "./ui.js";
export { Panels } from "./panels.js";
export { Registry, TopBar, Status } from "./registry.js";
export { Errors } from "./errors.js";
export { Comments } from "./comments.js";
export { Editor } from "./editor.js";
export { Document } from "./document.js";
export { Router } from "./router.js";
export { Extensions, API_VERSION, compatible } from "./extensions.js";
export { Tree, findNode, checkName, parentFolder, baseName } from "./tree.js";

/**
 * Create the services of one app.
 * @param {object} [options]
 * @param {Transport} [options.transport] - The protocol client; by default,
 *   one for the page's own server.
 */
export function createStilo({ transport = new Transport() } = {}) {
    const stilo = { apiVersion: API_VERSION, transport };
    stilo.commands = new Commands(stilo);
    stilo.keys = new Keys();
    stilo.menus = new Menus();
    stilo.ui = new UI();
    stilo.panels = new Panels();
    stilo.topBar = new TopBar();
    stilo.status = new Status();
    // Each of these listens to the ones before it
    stilo.editor = new Editor(stilo);
    stilo.errors = new Errors(stilo);
    stilo.document = new Document(stilo);
    stilo.comments = new Comments(stilo);
    stilo.router = new Router(stilo);
    stilo.tree = new Tree(stilo);
    stilo.extensions = new Extensions(stilo);
    return stilo;
}
