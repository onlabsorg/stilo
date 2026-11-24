// The `comments` service: the cell comments of the open document.

import { Service } from "./service.js";
import { parseDocument, cellComments } from "../editor/index.js";

/**
 * The comments are read from the document's text: `<!--[ ... ]-->` in each
 * cell, when the document opens and on every edit. The service holds them
 * by line, and which line is pointed out. Going to a line is done by whoever
 * handles the `go-to` event (Stilo's own: `builtins/go-to.js`). Discussions
 * kept outside the document (threads, issues) are not comments: an
 * extension shows them in a panel of its own (S30).
 */
export class Comments extends Service {
    constructor(stilo) {
        super();
        this._stilo = stilo;
        this._list = [];
        this._line = null;
        stilo.document.on("open", ({ text }) => this.read(stilo.editor.value || text));
        stilo.editor.on("edit", () => this.read(stilo.editor.value));
        stilo.editor.on("comments-click", ({ line }) => this.show(line));
    }

    /** `[{line, comments}]`: every line of the document (from 1), with the
     * texts of its cell comments, maybe none. */
    get list() {
        return this._list;
    }

    /** The line pointed out, or `null`. */
    get line() {
        return this._line;
    }

    /** Read the comments of the document's text again. */
    read(text) {
        const cells = parseDocument(text ?? "");
        this._list = cells.map((cell, i) => ({ line: i + 1, comments: cellComments(cell.texl) }));
        this.changed();
    }

    /** Forget the comments and the line pointed out (no document, or a new one). */
    clear() {
        this._list = [];
        this._line = null;
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
