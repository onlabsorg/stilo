// The `tree` service: the folders and files under the navigation root, as
// the navigation pane shows them.

import { Service } from "./service.js";
import { isDocument } from "../api.js";

const SHOW_OTHER_KEY = "stilo-show-other";

/** The node at `path` in a tree, if any. */
export function findNode(node, path) {
    if (!node) return null;
    if (node.path === path) return node;
    for (const child of node.children ?? []) {
        const found = findNode(child, path);
        if (found) return found;
    }
    return null;
}

export const parentFolder = (path) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
export const baseName = (path) => path.slice(path.lastIndexOf("/") + 1);

/**
 * Check a name typed for a document (`file`), another file (`other`) or a
 * folder in `folder`: `{name}`, without the extension a document's may have,
 * and `problem` if it cannot be used (the rules of the protocol's paths).
 */
export function checkName(typed, folder, type) {
    const name = type === "file" ? typed.replace(/\.texl$/, "") : typed;
    const problem = !name
        ? "Type a name."
        : /[/\\]/.test(name)
          ? "A name cannot contain / or \\."
          : name.startsWith(".")
            ? "A name cannot start with a dot."
            : !folder && name.startsWith("_")
              ? "A name here cannot start with _."
              : name === "~"
                ? "A name cannot be ~."
                : type === "folder" && isDocument(name)
                  ? "A folder's name cannot end in .texl."
                  : type === "other" && isDocument(name)
                    ? "Only documents end in .texl."
                    : "";
    return { name, problem };
}

/**
 * The tree of the navigation root (`router.root`; a node of the protocol's
 * QUERY), read again when the root changes. Also: the item last used in the
 * navigation pane (`current`), whether other files show, and the item being
 * moved while the Move to… dialog is open. The navigation pane attaches
 * itself as the view that asks for names (`askName`).
 */
export class Tree extends Service {
    constructor(stilo) {
        super();
        this._stilo = stilo;
        this._tree = null;
        this._error = "";
        this._current = null;
        this._moving = null;
        this._view = null;
        this._root = undefined;
        this._showOther = true;
        try {
            this._showOther = localStorage.getItem(SHOW_OTHER_KEY) !== "false";
        } catch {}
        stilo.router.on("change", () => {
            if (stilo.router.root === this._root) return;
            this._root = stilo.router.root;
            this._tree = null;
            this._error = "";
            this.changed();
            this.refresh();
        });
    }

    /** The navigation root, a folder path. */
    get root() {
        return this._stilo.router.root ?? "";
    }

    /** The tree of the root, or `null` while it is read. */
    get tree() {
        return this._tree;
    }

    /** Why the tree could not be read, or `""`. */
    get error() {
        return this._error;
    }

    /** Whether other files show, and folders holding only other files. */
    get showOther() {
        return this._showOther;
    }

    /** The tree node last focused or right-clicked in the navigation pane, if any. */
    get current() {
        return this._current;
    }

    /** What a command on a tree item acts on when no item is given: the
     * current item, or else the open document. */
    get target() {
        const path = this._stilo.document.path;
        return this._current ?? (path ? { path, name: baseName(path), type: "file" } : null);
    }

    /** The item being moved, while the Move to… dialog is open:
     * `{node, tree, error}`, `tree` being the whole tree; or `null`. */
    get moving() {
        return this._moving;
    }

    /** Read the tree of the root again. The old tree stays until the new one
     * is there, so reading it again does not flash. */
    async refresh() {
        const root = this.root;
        try {
            const tree = await this._stilo.transport.readTree(root);
            if (root !== this.root) return; // the root moved meanwhile
            this._tree = tree;
            this._error = "";
            this._current = this._current ? findNode(tree, this._current.path) : null;
        } catch (error) {
            if (root !== this.root) return;
            this._error = error.status === 404 ? `Folder /${root} not found.` : error.message;
        }
        this.changed();
    }

    /** Make the item at `path` the current one, if it is in the tree. */
    setCurrent(path) {
        const node = path ? findNode(this._tree, path) : null;
        if (node === this._current) return;
        this._current = node;
        this.changed();
    }

    /** Read the tree again, then make the item at `path` the current one. */
    async showInTree(path) {
        await this.refresh();
        if (path) this.setCurrent(path);
    }

    /** The folder a new item goes in: `node` if it is one, the folder of
     * `node` if it is a file, else likewise for the current item, else the
     * root. */
    folderFor(node) {
        const item = node ?? this._current;
        return !item ? this.root : item.type === "folder" ? item.path : parentFolder(item.path);
    }

    /** Show or hide other files. */
    setShowOther(on) {
        if (on === this._showOther) return;
        this._showOther = on;
        this.changed();
    }

    /** Show or hide other files, and remember it in this browser. */
    toggleShowOther() {
        this.setShowOther(!this._showOther);
        try {
            localStorage.setItem(SHOW_OTHER_KEY, this._showOther);
        } catch {}
    }

    /** The view that asks for names (the navigation pane), or `null`. */
    attachView(view) {
        this._view = view;
    }

    detachView(view) {
        if (this._view === view) this._view = null;
    }

    /**
     * Ask for a name in a row of the tree, the navigation pane opened if it
     * was closed (the request: see `<nav-pane>`'s `askName`). Resolves to
     * whether it was done.
     */
    async askName(request) {
        this._stilo.ui.setNavOpen(true);
        await this._stilo.ui.settled();
        return this._view ? this._view.askName(request) : false;
    }

    /** Open the Move to… dialog for `node`, with the whole tree; `choose`
     * moves it to a folder (`chooseMove`). */
    startMove({ node, tree, choose }) {
        this._moving = { node, tree, error: "", choose };
        this.changed();
    }

    /** A folder was chosen in the dialog. */
    chooseMove(folder) {
        return this._moving?.choose(folder);
    }

    /** Show why the move failed, in the dialog. */
    failMove(error) {
        if (!this._moving) return;
        this._moving = { ...this._moving, error };
        this.changed();
    }

    /** Close the dialog. */
    endMove() {
        if (!this._moving) return;
        this._moving = null;
        this.changed();
    }
}
