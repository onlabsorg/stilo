// Stilo's own contributions, activated on every app's services as
// extensions are (S17).

import { activate as commands } from "./commands.js";
import { activate as panels } from "./panels.js";
import { activate as goTo } from "./go-to.js";

const activated = new WeakSet();

/** Activate the built-in contributions on a `stilo` object, once. */
export function activateBuiltins(stilo) {
    if (activated.has(stilo)) return;
    activated.add(stilo);
    commands(stilo);
    panels(stilo);
    goTo(stilo);
}
