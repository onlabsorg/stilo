// The `document` service: the open document, read from and saved to the
// server.

import { Service } from "./service.js";

/**
 * The document open in the editor: its path, whether it has unsaved changes,
 * the error if it could not be read. Fires `open` ({path, text}) when its
 * text is in the editor, and `save` ({path}) when it was saved. The router
 * opens documents (`load`); commands save and reload them.
 */
export class Document extends Service {
    constructor(stilo) {
        super();
        this._stilo = stilo;
        this._path = null;
        this._error = "";
        this._dirty = false;
        this._etag = null;
        stilo.editor.on("edit", () => {
            this._dirty = true;
            this.changed();
            stilo.ui.notify("");
        });
    }

    /** The open document's path, or `null`. */
    get path() {
        return this._path;
    }

    /** Why the document could not be read, or `""`. */
    get error() {
        return this._error;
    }

    /** Whether it has changes not saved yet (not counting a cell being edited). */
    get dirty() {
        return this._dirty;
    }

    /** Why the open document cannot be changed (the `tree` service's
     * read-only providers), or `null` if it can, or if none is open. The
     * editor shows it in read-only mode; it cannot be saved. It follows the
     * providers: views showing it watch `tree` too. */
    get readOnly() {
        return this._path ? (this._stilo.tree?.readOnlyReason(this._path) ?? null) : null;
    }

    /** Whether it has changes not saved yet, a cell being edited included. */
    get unsaved() {
        return this._dirty || this._stilo.editor.editing;
    }

    /**
     * Open the document at `path` (`null`: none) in a new editor. Used by the
     * router: open documents with `router.go`, so the address follows.
     */
    async load(path) {
        const { editor, ui, comments, errors, transport } = this._stilo;
        this._path = path ?? null;
        this._error = "";
        this._dirty = false;
        this._etag = null;
        editor.reset();
        ui.notify("");
        comments.clear();
        errors.clear();
        ui.setSource(null);
        this.changed();
        if (!path) return;
        try {
            const { text, etag } = await transport.readFile(path);
            if (path !== this._path) return; // another document was opened meanwhile
            this._etag = etag;
            const element = await editor.whenReady();
            if (!element || path !== this._path) return;
            element.value = text;
            this.emit("open", { path, text });
            element.focus();
        } catch (error) {
            if (path !== this._path) return;
            this._error = error.status === 404 ? `Document /${path} not found.` : error.message;
            this.changed();
        }
    }

    /** Save the document, the cell being edited included. A cell that refuses
     * its edit stops the save; a document changed on the server meanwhile is
     * not overwritten. The status says how it went. */
    async save() {
        const { editor, ui, transport } = this._stilo;
        const path = this._path;
        if (!path || !editor.element) return;
        const readOnly = this.readOnly;
        if (readOnly !== null) {
            ui.notify(`Not saved: read-only (${readOnly})`);
            return;
        }
        if (editor.editing && !(await editor.element.runCommand("commit"))) {
            ui.setSource(null);
            ui.notify("Not saved: correct the cell being edited");
            return;
        }
        ui.notify("Saving…");
        try {
            this._etag = await transport.updateFile(path, editor.value, this._etag);
            this._dirty = false;
            this.changed();
            ui.notify("Saved");
            this.emit("save", { path });
        } catch (error) {
            ui.notify(error.status === 412 ? "Not saved: changed on the server, reload it" : `Not saved: ${error.message}`);
        }
    }

    /** Read the document again, after confirming if it has unsaved changes. */
    async reload() {
        if (!this._path) return;
        if (this._dirty && !(await this._stilo.ui.confirm("Discard unsaved changes?", { ok: "Discard", danger: true }))) return;
        await this.load(this._path);
    }

    /** Forget the unsaved changes (the document is going away). */
    discard() {
        if (!this._dirty) return;
        this._dirty = false;
        this.changed();
    }
}
