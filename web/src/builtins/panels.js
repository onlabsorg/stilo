// Stilo's own panels of the right pane, registered through the `panels`
// service as an extension's would be (S17). Buttons in the top bar follow
// `order`, left to right.

import { html } from "lit";
import { commandsIcon, commentsIcon, errorsIcon } from "../icons.js";
import "../components/commands-pane.js";
import "../components/comments-pane.js";
import "../components/errors-pane.js";

export const panels = [
    { id: "errors", label: "Errors", icon: errorsIcon, order: 10, render: () => html`<errors-pane></errors-pane>` },
    { id: "comments", label: "Comments", icon: commentsIcon, order: 20, render: () => html`<comments-pane></comments-pane>` },
    { id: "commands", label: "Commands", icon: commandsIcon, order: 30, render: () => html`<commands-pane></commands-pane>` },
];

/** The errors panel's badge: how many errors, in the danger colour. */
function errorsBadge(count) {
    return count ? { text: String(count), label: count === 1 ? "1 error" : `${count} errors`, tone: "danger" } : null;
}

/** Register Stilo's panels. Returns the function that removes them. */
export function activate(stilo) {
    const disposers = panels.map((panel) => stilo.panels.register(panel));
    let count = 0;
    disposers.push(
        stilo.errors.on("change", () => {
            if (stilo.errors.count === count) return;
            count = stilo.errors.count;
            stilo.panels.setBadge("errors", errorsBadge(count));
        }),
    );
    return () => disposers.reverse().forEach((dispose) => dispose());
}
