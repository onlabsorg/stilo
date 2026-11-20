// The `editor` service: the `<texl-editor>` of the open document.

import { Service } from "./service.js";
import { parseDocument } from "../editor/index.js";

/** The editor's events the service passes on, under the same names, except
 * `change` (an edit), passed on as `edit`. */
const EVENTS = {
    change: "edit",
    "comments-click": "comments-click",
    "errors-change": "errors-change",
    "error-click": "error-click",
    "selection-change": "selection-change",
    "mark-click": "mark-click",
};

/**
 * @typedef {object} Mark
 * @property {string} cell - The name of the cell it is on.
 * @property {string} text - A short text, shown in the cell's right margin.
 * @property {"accent" | "warning" | "danger"} [tone] - Its colour.
 * @property {string} [title] - Its hover text.
 */

/**
 * A new `<texl-editor>` is made for every document, so value, undo history
 * and selection start fresh. The view that makes it attaches it here; the
 * service passes on its events (`edit`, `comments-click`, `errors-change`,
 * `error-click`, `selection-change`, `mark-click`, with the editor's
 * `detail`) and lets others use it without holding on to the element.
 * Mark providers (`decorate`) put marks on its cells.
 */
export class Editor extends Service {
    constructor(stilo) {
        super();
        this._stilo = stilo;
        this._element = null;
        this._stops = [];
        /** The mark providers (`decorate`). */
        this._decorators = [];
        this._newWait();
        this.on("edit", () => this.applyMarks());
    }

    /**
     * Add a mark provider: `provider(doc)` returns the marks of the open
     * document, `[{cell, text, tone?, title?}]`, each on a cell by its name,
     * shown in the cell's right margin; a click on one fires `mark-click`
     * (`{line, cell, mark}`). `doc` is `{path, value, cells}`, the cells as
     * the file format reads them (`{name, type, texl, ...}`) with their
     * `line`. Asked when a document opens, after every edit, and on
     * `invalidate()`. Returns the function that removes it.
     * @param {(doc: {path: string, value: string, cells: object[]}) => Mark[]} provider
     * @returns {() => void}
     */
    decorate(provider) {
        const entry = { provider };
        this._decorators.push(entry);
        this.applyMarks();
        return () => {
            const i = this._decorators.indexOf(entry);
            if (i < 0) return;
            this._decorators.splice(i, 1);
            this.applyMarks();
        };
    }

    /** Ask the mark providers again: what they return has changed. */
    invalidate() {
        this.applyMarks();
    }

    /** The marks of the open document from every provider, by cell name
     * (lowercase), as the editor takes them (`marks`). */
    marks() {
        const path = this._stilo.document?.path;
        if (!path || !this._element || !this._decorators.length) return {};
        const value = this._element.value;
        const cells = parseDocument(value).map((cell, i) => ({ ...cell, line: i + 1 }));
        const byName = {};
        for (const { provider } of this._decorators) {
            let marks;
            try {
                marks = provider({ path, value, cells }) ?? [];
            } catch (error) {
                console.error("Stilo: a mark provider failed", error);
                continue;
            }
            for (const mark of marks) {
                const name = mark?.cell?.toLowerCase();
                if (name) (byName[name] ??= []).push(mark);
            }
        }
        return byName;
    }

    /** Give the editor the marks of the providers. */
    applyMarks() {
        if (this._element) this._element.marks = this.marks();
    }

    _newWait() {
        this._ready = new Promise((resolve) => (this._resolve = resolve));
    }

    /** The editor element, or `null` while there is none. */
    get element() {
        return this._element;
    }

    /** The document's text in the editor, as it would be saved. */
    get value() {
        return this._element?.value ?? "";
    }

    /** The selected line and the name of its cell, `{line, cell}` (the
     * editor's `selection`), or `null` without an editor. */
    get selection() {
        return this._element?.selection ?? null;
    }

    /** The open document as rendered, the HTML of its cells (the editor's
     * `renderedHtml`); `""` without an editor. */
    async renderedHtml(options) {
        return this._element ? this._element.renderedHtml(options) : "";
    }

    /** Whether a cell is being edited. */
    get editing() {
        return !!this._element?.editing;
    }

    /**
     * Attach the editor element the view made (or `null`).
     * @param {HTMLElement | null} element
     */
    attach(element) {
        if (element === this._element) return;
        for (const stop of this._stops) stop();
        this._stops = [];
        this._element = element ?? null;
        if (this._element) {
            for (const [from, to] of Object.entries(EVENTS)) {
                const listener = (e) => this.emit(to, e.detail);
                this._element.addEventListener(from, listener);
                this._stops.push(() => element.removeEventListener(from, listener));
            }
            this._resolve(this._element);
        }
        this.changed();
    }

    /** Let go of the editor: a new document is coming, in a new one. Who
     * waits for the old one gets `null`. */
    reset() {
        this.attach(null);
        this._resolve(null);
        this._newWait();
    }

    /** The next editor attached (or the one attached now), or `null` if a
     * new document comes first. */
    whenReady() {
        return this._element ? Promise.resolve(this._element) : this._ready;
    }

    /** The editor once the window shows the latest state (`ui.settled`),
     * or `null`. */
    async settled() {
        await this._stilo.ui.settled();
        return this._element;
    }

    focus() {
        this._element?.focus();
    }

    /** Select a line (from 1), back in the editor view, and focus it. */
    async reveal(line) {
        this._stilo.ui.setSource(null);
        const element = await this.settled();
        element?.select(line);
        element?.focus();
    }

    /** Run a command of the editor (`runCommand`, docs/component/api.md),
     * back in the editor view. */
    runCommand(name) {
        const element = this._element;
        if (!element) return;
        this._stilo.ui.setSource(null);
        element.focus();
        return element.runCommand(name);
    }
}
