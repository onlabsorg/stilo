// The `tree` service: the folders and files under the navigation root, as
// the navigation pane shows them.

import { Service } from "./service.js";
import { archiveOf, isDocument } from "../api.js";

const SHOW_OTHER_KEY = "stilo-show-other";

/** Why nothing can be added to a packed package, or changed in it. */
export const ARCHIVE_REASON = "A packed package: what is in it cannot be changed";

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

/**
 * @typedef {object} Decoration
 * @property {string} [badge] - A short text after the item's name.
 * @property {string} [tooltip] - A line of its hover text.
 * @property {"accent" | "warning" | "danger"} [tone] - The badge's colour.
 * @property {boolean} [muted] - Show the item muted.
 */

/** Call a provider; one that throws counts as saying nothing, and is
 * reported in the console. */
function call(provider, arg) {
    try {
        return provider(arg);
    } catch (error) {
        console.error("Stilo: a tree provider failed", error);
        return null;
    }
}

export const parentFolder = (path) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
export const baseName = (path) => path.slice(path.lastIndexOf("/") + 1);

/**
 * Check a name typed for a document (`file`), another file (`other`) or a
 * folder in `folder`: `{name}`, without the extension a document's may have,
 * and `problem` if it cannot be used (the rules of the protocol's paths).
 */
export function checkName(typed, folder, type) {
    const name = type === "file" ? typed.replace(/\.texl$/, "") : type === "archive" ? typed.replace(/\.texlz$/, "") : typed;
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
                : type === "folder" && /\.texlz?$/.test(name)
                  ? `A folder's name cannot end in ${name.slice(name.lastIndexOf("."))}.`
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
        /** The providers of extensions: decorations, filters, read-only items. */
        this._decorators = [];
        this._filters = [];
        this._readOnly = [];
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

    // -- providers -----------------------------------------------------------

    /** Add a provider to a list; returns the function that removes it. */
    _addProvider(list, provider) {
        const entry = { provider };
        list.push(entry);
        this.changed();
        return () => {
            const i = list.indexOf(entry);
            if (i < 0) return;
            list.splice(i, 1);
            this.changed();
        };
    }

    /**
     * Add a decoration provider: `provider(node)` returns how to show a tree
     * node, or nothing: `{badge?, tooltip?, tone?, muted?}`, `badge` a short
     * text after its name, `tooltip` a line of its hover text, `tone` the
     * badge's colour (`"accent"`, `"warning"`, `"danger"`), `muted` to show it
     * muted. Returns the function that removes it. Call `invalidate()` when
     * what it returns changes.
     * @param {(node: object) => Decoration | null | undefined} provider
     * @returns {() => void}
     */
    decorate(provider) {
        return this._addProvider(this._decorators, provider);
    }

    /**
     * Add a filter: `provider(node)` returns `false` to leave a node, and what
     * is inside it, out of the navigation pane. Returns the function that
     * removes it.
     * @param {(node: object) => boolean} provider
     * @returns {() => void}
     */
    filter(provider) {
        return this._addProvider(this._filters, provider);
    }

    /**
     * Add a read-only provider: `provider(path)` returns why the file or
     * folder at `path` cannot be changed (a text, or `true`), or nothing if
     * it can. A read-only document opens in the editor's read-only mode;
     * saving, renaming, moving and deleting it are disabled, and so is
     * adding items to a read-only folder. Returns the function that removes it.
     * @param {(path: string) => string | boolean | null | undefined} provider
     * @returns {() => void}
     */
    readOnly(provider) {
        return this._addProvider(this._readOnly, provider);
    }

    /** Ask the providers again: what they return has changed. */
    invalidate() {
        this.changed();
    }

    /** How to show a node, from every decoration provider: `{badges, tooltip,
     * muted}`, `badges` being `[{text, tone}]`; `null` if none says anything. */
    decoration(node) {
        const found = this._decorators.map(({ provider }) => call(provider, node)).filter(Boolean);
        if (!found.length) return null;
        return {
            badges: found.filter((d) => d.badge).map((d) => ({ text: String(d.badge), tone: d.tone })),
            tooltip: found.map((d) => d.tooltip).filter(Boolean).join("\n"),
            muted: found.some((d) => d.muted),
        };
    }

    /** Whether a node shows in the navigation pane (the filters). */
    shows(node) {
        return this._filters.every(({ provider }) => call(provider, node) !== false);
    }

    /** Why the item at `path` cannot be changed, or `null` if it can. */
    readOnlyReason(path) {
        for (const { provider } of this._readOnly) {
            const reason = call(provider, path);
            if (reason) return typeof reason === "string" ? reason : "Read-only";
        }
        return null;
    }

    /** The path of the packed package the item at `path` is in, the
     * innermost if they are nested (`references/` of a packed package), or
     * `null`: e.g. the release a document belongs to. By the path alone, so
     * it holds before the tree is read. */
    archiveOf(path) {
        return path ? archiveOf(path) : null;
    }

    /** Whether the item at `path` is a packed package: a file the tree
     * shows as a read-only folder (`archive` in the protocol's tree). */
    isArchive(path) {
        return findNode(this._tree, path)?.archive === true;
    }

    /** Why a node cannot be renamed, moved or deleted: it, or for a folder
     * an item inside it, is read-only; `null` if it can. A packed package
     * moves as the one file it is: what is in it does not lock it. */
    lockedReason(node) {
        if (!node) return null;
        const own = this.readOnlyReason(node.path);
        if (own !== null) return own;
        if (node.type !== "folder" || node.archive || !this._readOnly.length) return null;
        const inside = (folder) =>
            (folder.children ?? []).some((child) => this.readOnlyReason(child.path) !== null || (!child.archive && inside(child)));
        return inside(findNode(this._tree, node.path) ?? node) ? "It holds read-only items" : null;
    }

    /** Why nothing can be added to the folder at `path`: it is read-only,
     * or a packed package; `null` if items can be added. */
    addReason(path) {
        return this.readOnlyReason(path) ?? (this.isArchive(path) ? ARCHIVE_REASON : null);
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

    /** A folder was chosen in the dialog; a read-only one is refused. */
    chooseMove(folder) {
        if (!this._moving) return;
        const reason = this.addReason(folder);
        if (reason !== null) return this.failMove(`That folder is read-only: ${reason}`);
        return this._moving.choose(folder);
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
