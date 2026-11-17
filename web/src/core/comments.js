// The `comments` service: the cell comments of the open document.

import { Service } from "./service.js";
import { parseDocument, cellComments } from "../editor/index.js";

/**
 * @typedef {object} OuterComment
 * @property {string} cell - The name of the cell it is on.
 * @property {string} text - What it says.
 * @property {string} [author] - Who wrote it.
 * @property {string} [date] - When, as it should show.
 */

/**
 * @typedef {object} CommentProvider
 * @property {string} id - Unique; an extension's are `<extension-id>.<name>`.
 * @property {string} label - Where the comments come from, e.g. "Issues".
 * @property {(path: string) => OuterComment[] | Promise<OuterComment[]>} comments -
 *   The comments of the document at `path`.
 */

/**
 * The comments are read from the document's text: `<!--[ ... ]-->` in each
 * cell, when the document opens and on every edit; providers (`addProvider`)
 * add comments from elsewhere, anchored to cells by name. The service holds
 * them by line, and which line is pointed out. Going to a line is done by whoever
 * handles the `go-to` event (Stilo's own: `builtins/go-to.js`).
 */
export class Comments extends Service {
    constructor(stilo) {
        super();
        this._stilo = stilo;
        this._list = [];
        this._line = null;
        /** @type {CommentProvider[]} */
        this._providers = [];
        /** The comments of the providers for the open document, each with its `source` (label) and `provider` (id). */
        this._outer = [];
        this._generation = 0;
        stilo.document.on("open", ({ text }) => {
            this.read(stilo.editor.value || text);
            this.refresh();
        });
        stilo.editor.on("edit", () => this.read(stilo.editor.value));
        stilo.editor.on("comments-click", ({ line }) => this.show(line));
    }

    /** `[{line, comments, others}]`: every line of the document (from 1),
     * with the texts of its cell comments, maybe none, and the comments of
     * the providers on it (`{text, author?, date?, source, provider}`). */
    get list() {
        return this._list;
    }

    /** The line pointed out, or `null`. */
    get line() {
        return this._line;
    }

    /**
     * Add a provider of comments from outside the document (an issue
     * tracker, a review): they show in the comments pane and count in the
     * editor's margin, on the cells they name, read-only. Returns the
     * function that removes it. An id already taken is refused.
     * @param {CommentProvider} provider
     * @returns {() => void}
     */
    addProvider(provider) {
        if (this._providers.some((p) => p.id === provider.id)) throw new Error(`a comment provider with the id "${provider.id}" exists already`);
        this._providers.push(provider);
        this.refresh();
        return () => {
            const i = this._providers.indexOf(provider);
            if (i < 0) return;
            this._providers.splice(i, 1);
            this._outer = this._outer.filter((c) => c.provider !== provider.id);
            this.read(this._stilo.editor.value);
        };
    }

    /** Ask the providers again for the open document's comments. A provider
     * that fails is reported in the console and left out. */
    async refresh() {
        const path = this._stilo.document.path;
        const generation = ++this._generation;
        const found = await Promise.all(
            this._providers.map(async (provider) => {
                if (!path) return [];
                try {
                    const comments = (await provider.comments(path)) ?? [];
                    return comments.map((c) => ({ ...c, source: provider.label, provider: provider.id }));
                } catch (error) {
                    console.error(`Stilo: the comment provider "${provider.id}" failed`, error);
                    return [];
                }
            }),
        );
        if (generation !== this._generation) return; // asked again meanwhile
        this._outer = found.flat();
        this.read(this._stilo.editor.value);
    }

    /** Read the comments of the document's text again, and place the
     * providers' on its cells by name. */
    read(text) {
        const cells = parseDocument(text ?? "");
        const lines = new Map(cells.map((cell, i) => [cell.name?.toLowerCase(), i]));
        const others = cells.map(() => []);
        const extra = {};
        for (const comment of this._outer) {
            const name = comment.cell?.toLowerCase();
            const i = lines.get(name);
            if (i === undefined) continue;
            others[i].push(comment);
            (extra[name] ??= []).push(comment.text);
        }
        this._list = cells.map((cell, i) => ({ line: i + 1, comments: cellComments(cell.texl), others: others[i] }));
        if (this._stilo.editor.element) this._stilo.editor.element.extraComments = extra;
        this.changed();
    }

    /** Forget the comments and the line pointed out (no document, or a new one). */
    clear() {
        this._list = [];
        this._line = null;
        this._outer = [];
        this._generation++;
        this.changed();
    }

    /** Point out a line's comments and open the comments panel. */
    show(line) {
        this._line = line ?? null;
        this.changed();
        this._stilo.ui.openPane("comments");
    }

    /** Point out a line and go to it in the document. Fires `go-to` with `{line}`. */
    goTo(line) {
        this._line = line;
        this.changed();
        this.emit("go-to", { line });
    }
}
