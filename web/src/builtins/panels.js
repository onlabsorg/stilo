// Stilo's own panels of the right pane, registered through the `panels`
// service as an extension's would be (S17). Buttons in the top bar follow
// `order`, left to right.

import { html } from "lit";
import { commandsIcon, commentsIcon, errorsIcon } from "../icons.js";
import "../components/commands-pane.js";
import "../components/comments-pane.js";
import "../components/errors-pane.js";

// The comments and errors panes take their state from the app until their
// services exist (phase 2 of S17).
export const panels = [
    { id: "errors", label: "Errors", icon: errorsIcon, order: 10, render: (stilo) => stilo._app._renderErrorsPane() },
    { id: "comments", label: "Comments", icon: commentsIcon, order: 20, render: (stilo) => stilo._app._renderCommentsPane() },
    { id: "commands", label: "Commands", icon: commandsIcon, order: 30, render: () => html`<commands-pane></commands-pane>` },
];

/** Register Stilo's panels. Returns the function that removes them. */
export function activate(stilo) {
    const disposers = panels.map((panel) => stilo.panels.register(panel));
    return () => disposers.reverse().forEach((dispose) => dispose());
}
