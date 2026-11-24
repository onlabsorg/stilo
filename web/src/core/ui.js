// The `ui` service: what the window shows around the document, and the ways
// to talk to the user that look like Stilo.

import { html } from "lit";
import { Service } from "./service.js";
import { cellTagName } from "../editor/index.js";

export class UI extends Service {
    constructor() {
        super();
        this._status = "";
        this._navOpen = true;
        this._pane = null;
        this._source = null;
        this._settle = null;
        this._level = "info";
        /** The dialogs open, the last on top: `{render, close}`. */
        this._dialogs = [];
        /** The view that shows dialogs, or `null`: without one, `confirm` and
         * `prompt` use the browser's. */
        this._dialogView = null;
    }

    /** The message in the top bar ("Saved", an error), or `""`. */
    get status() {
        return this._status;
    }

    /** Whether the navigation pane is open. */
    get navOpen() {
        return this._navOpen;
    }

    /** The id of the panel open in the right pane (`panels`), or `null`. */
    get pane() {
        return this._pane;
    }

    /** The document's text shown read-only in place of the editor (Show
     * source), or `null`. */
    get source() {
        return this._source;
    }

    _set(name, value) {
        if (this[name] === value) return;
        this[name] = value;
        this.changed();
    }

    /** How the status reads: `"info"`, `"warning"` or `"error"`. */
    get level() {
        return this._level;
    }

    /** Show a message in the top bar, with a level (`info`, the default,
     * `warning` or `error`, which colour it); `""` clears it. */
    notify(message, { level = "info" } = {}) {
        if (this._status === message && this._level === level) return;
        this._status = message;
        this._level = message ? level : "info";
        this.changed();
    }

    /** The dialog on top, `{render, close}`, or `null`. */
    get currentDialog() {
        return this._dialogs.at(-1) ?? null;
    }

    /** The view that shows dialogs, or `null`. */
    get dialogView() {
        return this._dialogView;
    }

    /** Set the view that shows dialogs (the app), or `null`. */
    setDialogView(view) {
        this._dialogView = view;
    }

    /**
     * Show a dialog, modal, over the window. `render(close)` returns its
     * content, a Lit template; `close(value)` closes it and resolves the
     * promise to `value`. Escape closes it with `undefined`. Returns the
     * promise; it rejects if no view shows dialogs.
     * @param {(close: (value?: any) => void) => unknown} render
     * @returns {Promise<any>}
     */
    dialog(render) {
        if (!this._dialogView) return Promise.reject(new Error("no view shows dialogs"));
        return new Promise((resolve) => {
            const entry = {
                render: () => render(entry.close),
                close: (value) => {
                    const i = this._dialogs.indexOf(entry);
                    if (i < 0) return;
                    this._dialogs.splice(i, 1);
                    this.changed();
                    resolve(value);
                },
            };
            this._dialogs.push(entry);
            this.changed();
        });
    }

    /**
     * Ask the user to confirm, in a dialog of Stilo's own (the browser's,
     * without a view for dialogs); resolves to whether they did.
     * @param {string} message
     * @param {{ok?: string, cancel?: string, danger?: boolean}} [options] - The
     *   buttons' names ("OK", "Cancel"); `danger` colours OK as a warning.
     */
    async confirm(message, { ok = "OK", cancel = "Cancel", danger = false } = {}) {
        if (!this._dialogView) return window.confirm(message);
        const answer = await this.dialog(
            (close) => html`<form method="dialog" @submit=${(e) => (e.preventDefault(), close(true))}>
                <p class="message">${message}</p>
                <div class="buttons">
                    <button type="button" class="secondary" @click=${() => close(false)}>${cancel}</button>
                    <button type="submit" class="primary ${danger ? "danger" : ""}" autofocus>${ok}</button>
                </div>
            </form>`,
        );
        return answer === true;
    }

    /**
     * Ask the user for a text, in a dialog of Stilo's own (the browser's,
     * without a view for dialogs); resolves to it, or `null` if they cancel.
     * @param {string} message
     * @param {string} [value] - The text at first.
     * @param {{ok?: string, cancel?: string}} [options]
     */
    async prompt(message, value = "", { ok = "OK", cancel = "Cancel" } = {}) {
        if (!this._dialogView) return window.prompt(message, value);
        const answer = await this.dialog(
            (close) => html`<form
                method="dialog"
                @submit=${(e) => (e.preventDefault(), close(e.currentTarget.querySelector("input").value))}
            >
                <label class="message">${message}<input type="text" .value=${value} autofocus /></label>
                <div class="buttons">
                    <button type="button" class="secondary" @click=${() => close(null)}>${cancel}</button>
                    <button type="submit" class="primary">${ok}</button>
                </div>
            </form>`,
        );
        return typeof answer === "string" ? answer : null;
    }

    /**
     * Ask the user to write a short rich text (a message, a note), in a
     * dialog with the editor of Stilo's `rich` cells: styles, lists, links,
     * as in the document. Resolves to the text as the Markdown a `rich`
     * cell stores, or `null` if they cancel (Escape, Cancel). OK and
     * Ctrl+Enter accept it. Without a view for dialogs, the browser's
     * prompt asks for the Markdown itself.
     * @param {string} message
     * @param {string} [value] - The text at first, Markdown.
     * @param {{ok?: string, cancel?: string}} [options]
     * @returns {Promise<string | null>}
     */
    async write(message, value = "", { ok = "OK", cancel = "Cancel" } = {}) {
        if (!this._dialogView) return window.prompt(message, value);
        const cell = /** @type {any} */ (document.createElement(cellTagName("rich")));
        cell.texl = value;
        cell.mode = "edit";
        cell.className = "rich-text";
        // The cell's commit (Ctrl+Enter, OK) and discard (Escape) both end in
        // `cell-exit`; `cell-change` comes first only when the text changed
        let commit = false;
        let text = value;
        const exitEdit = cell.exitEdit.bind(cell);
        cell.exitEdit = (accept = true) => {
            commit = accept;
            exitEdit(accept);
        };
        let closeDialog = null;
        cell.addEventListener("cell-change", (e) => (text = e.detail.texl));
        cell.addEventListener("cell-exit", () => closeDialog?.(commit ? text : null));
        const answer = await this.dialog((close) => {
            closeDialog = close;
            return html`<form method="dialog" @submit=${(e) => (e.preventDefault(), cell.exitEdit(true))}>
                <p class="message">${message}</p>
                ${cell}
                <div class="buttons">
                    <button type="button" class="secondary" @click=${() => close(null)}>${cancel}</button>
                    <button type="submit" class="primary">${ok}</button>
                </div>
            </form>`;
        });
        return typeof answer === "string" ? answer : null;
    }

    setNavOpen(open) {
        this._set("_navOpen", !!open);
    }

    toggleNav() {
        this.setNavOpen(!this._navOpen);
    }

    /** Open a panel in the right pane by its id, or close it with `null`. */
    openPane(id) {
        this._set("_pane", id ?? null);
    }

    /** Open a panel, or close it if it is the one open. */
    togglePane(id) {
        this.openPane(this._pane === id ? null : id);
    }

    /** Set how to wait until the window shows the latest state: the app
     * that renders the window gives it (`settled`). */
    setSettle(settle) {
        this._settle = settle;
    }

    /** Resolves when the window shows the latest state, e.g. the navigation
     * pane after `setNavOpen(true)`, or the editor after `setSource(null)`. */
    async settled() {
        await this._settle?.();
    }

    /** Show a text read-only in place of the editor, or go back with `null`. */
    setSource(text) {
        this._set("_source", text ?? null);
    }
}
