import { LitElement, html, css } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { base } from "./shared.js";
import { closeIcon, fileIcon, folderIcon, otherFileIcon } from "../icons.js";
import { ContextProvider } from "@lit/context";
import { isDocument } from "../api.js";
import { createStilo, stiloContext } from "../core/index.js";
import { relativeLink } from "../route.js";
import { activateBuiltins } from "../builtins/index.js";
import "./top-bar.js";
import "./nav-pane.js";
import "./move-dialog.js";

const NEW_DOCUMENT = (title) => `<!--{ rich }-->\n# ${title}\n`;
const SHOW_OTHER_KEY = "stilo-show-other";

const parentFolder = (path) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
const baseName = (path) => path.slice(path.lastIndexOf("/") + 1);
const documentName = (path) => baseName(path).replace(/\.texl$/, "");
const join = (folder, name) => (folder ? `${folder}/${name}` : name);
/** How many documents and other files are in a tree node, at any depth. */
function countFiles(node) {
    if (node.type === "file") return isDocument(node.path) ? { documents: 1, others: 0 } : { documents: 0, others: 1 };
    return (node.children ?? []).map(countFiles).reduce((a, b) => ({ documents: a.documents + b.documents, others: a.others + b.others }), { documents: 0, others: 0 });
}
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Whether `path` is the item at `item`, or inside it. */
const isIn = (path, item) => path === item || !!path?.startsWith(`${item}/`);

/** Put text on the clipboard. The clipboard API needs a secure page, so a server
 * reached over plain HTTP needs the old way. Returns whether it worked. */
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        document.body.append(area);
        area.select();
        const copied = document.execCommand("copy");
        area.remove();
        return copied;
    }
}

/**
 * The app shell: top bar, navigation pane, editor, right pane. Creates and
 * provides the services (`stilo`), lays out the window, and holds the
 * navigation pane's state (the tree) and its commands.
 */
export class StiloApp extends LitElement {
    static properties = {
        stilo: { attribute: false },
        _tree: { state: true },
        _treeError: { state: true },
        _showOther: { state: true },
        _moving: { state: true },
    };

    static styles = [
        base,
        css`
            :host {
                display: grid;
                grid-template-rows: var(--bar-height) 1fr;
                grid-template-columns: auto 1fr auto;
                grid-template-areas:
                    "bar bar bar"
                    "nav main pane";
                height: 100vh;
                overflow: hidden;
            }
            top-bar {
                grid-area: bar;
            }
            nav-pane {
                grid-area: nav;
                width: var(--nav-width);
            }
            main {
                grid-area: main;
                display: flex;
                flex-direction: column;
                min-width: 0;
                min-height: 0;
                padding: 1.5rem 1.5rem 0;
            }
            texl-editor {
                flex: 1;
                min-height: 0;
                width: 100%;
                max-width: 56rem;
                margin: 0 auto;
                border-radius: var(--radius) var(--radius) 0 0;
                box-shadow: var(--shadow);
                background: var(--texl-paper, var(--surface));
                color: var(--text);
            }
            .source {
                flex: 1;
                min-height: 0;
                width: 100%;
                max-width: 56rem;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                border-radius: var(--radius) var(--radius) 0 0;
                box-shadow: var(--shadow);
                background: var(--texl-paper, var(--surface));
                color: var(--text);
            }
            .source pre {
                flex: 1;
                margin: 0;
                padding: 0.5rem 1rem 1rem;
                overflow: auto;
                font-family: var(--texl-mono, ui-monospace, monospace);
                font-size: 13px;
                line-height: 1.5;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
                user-select: text;
            }
            .placeholder {
                margin: auto;
                max-width: 24rem;
                text-align: center;
                color: var(--text-muted);
                line-height: 1.6;
            }
            .placeholder.error {
                color: var(--danger);
            }
            aside {
                grid-area: pane;
                display: flex;
                flex-direction: column;
                width: var(--pane-width);
                min-height: 0;
                background: var(--surface);
                border-left: 1px solid var(--border);
            }
            aside > * {
                flex: 1;
            }
            [hidden] {
                display: none !important;
            }
            @media (max-width: 720px) {
                nav-pane,
                aside {
                    position: absolute;
                    top: var(--bar-height);
                    bottom: 0;
                    z-index: 1;
                    box-shadow: var(--shadow);
                }
                nav-pane {
                    left: 0;
                }
                aside {
                    right: 0;
                    width: min(var(--pane-width), 100vw);
                }
                main {
                    grid-column: 1 / -1;
                    padding: 0.75rem 0.75rem 0;
                }
            }
        `,
    ];

    constructor() {
        super();
        /** The services (S17), provided to the elements inside by context.
         * Created here unless set before the app is connected. */
        this.stilo = createStilo();
        this._provider = new ContextProvider(this, { context: stiloContext, initialValue: this.stilo });
        this._useStilo();
        this._tree = null;
        this._treeError = "";
        this._moving = null;
        this._showOther = true;
        try {
            this._showOther = localStorage.getItem(SHOW_OTHER_KEY) !== "false";
        } catch {}
        this._treeRoot = null;
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onBeforeUnload = (e) => {
            if (this.stilo.document.dirty) e.preventDefault();
        };
    }

    willUpdate(changed) {
        if (changed.has("stilo")) {
            this._useStilo();
            this._provider.setValue(this.stilo);
        }
    }

    /** Activate Stilo's own commands and panes on the services. */
    _useStilo() {
        // The commands reach the app this way until its state has moved into
        // the services (phase 2 of S17)
        this.stilo._app = this;
        activateBuiltins(this.stilo);
        this._unwatch?.();
        const { ui, panels, document, router } = this.stilo;
        const stops = [ui, panels, document].map((service) => service.on("change", () => this.requestUpdate()));
        stops.push(router.on("change", () => this._onRouteChange()));
        this._unwatch = () => stops.forEach((stop) => stop());
    }

    /** The open document's path, or `null`. */
    get _doc() {
        return this.stilo.document.path;
    }

    /** The navigation root. */
    get _root() {
        return this.stilo.router.root;
    }

    get _transport() {
        return this.stilo.transport;
    }

    get _ui() {
        return this.stilo.ui;
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener("keydown", this._onKeyDown);
        window.addEventListener("beforeunload", this._onBeforeUnload);
        this.stilo.router.start();
    }

    disconnectedCallback() {
        window.removeEventListener("keydown", this._onKeyDown);
        window.removeEventListener("beforeunload", this._onBeforeUnload);
        this.stilo.router.stop();
        super.disconnectedCallback();
    }

    /** After every rendering: attach the editor made for the open document. */
    updated() {
        const editor = this.renderRoot.querySelector("texl-editor");
        if (editor !== this.stilo.editor.element) this.stilo.editor.attach(editor, () => this.updateComplete);
    }

    // -- the tree ------------------------------------------------------------

    /** A new navigation root: read its tree. */
    _onRouteChange() {
        this.requestUpdate();
        if (this._root === this._treeRoot) return;
        this._treeRoot = this._root;
        this._tree = null;
        this._loadTree();
    }

    /** Show a route, with a new history entry. */
    _go(route) {
        return this.stilo.router.go(route);
    }

    /** Read the tree of the root again. The old tree stays until the new one
     * is there, so reading it again does not flash. */
    async _loadTree() {
        const root = this._root;
        try {
            const tree = await this._transport.readTree(root);
            if (root !== this._root) return; // the root moved meanwhile
            this._tree = tree;
            this._treeError = "";
        } catch (error) {
            if (root !== this._root) return;
            this._treeError = error.status === 404 ? `Folder /${root} not found.` : error.message;
        }
    }

    // -- commands ------------------------------------------------------------

    _onKeyDown(e) {
        if (e.defaultPrevented || this._moving) return;
        const id = this.stilo.keys.match(e, "global");
        if (!this.stilo.commands.get(id)?.run) return;
        e.preventDefault();
        this.stilo.commands.run(id);
    }

    runCommand(id, node) {
        return this.stilo.commands.run(id, { node });
    }

    /** What a tree command acts on when no item is given: the item last used
     * in the navigation pane, or else the open document. */
    get treeTarget() {
        return this._nav?.current ?? (this._doc ? { path: this._doc, name: baseName(this._doc), type: "file" } : null);
    }

    get _nav() {
        return this.renderRoot.querySelector("nav-pane");
    }

    /** The folder a new item goes in: `node` if it is one, the folder of `node` if
     * it is a document, else likewise for the item last used in the tree, else the
     * navigation root. */
    _folderFor(node) {
        const item = node ?? this._nav?.current;
        return !item ? this._root : item.type === "folder" ? item.path : parentFolder(item.path);
    }

    /** Check a name typed for a document (`file`), another file (`other`) or a
     * folder in `folder`: `{name}`, without the extension a document's may have,
     * and `problem` if it cannot be used. */
    _checkName(typed, folder, type) {
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

    /** Ask for a name in the tree. The navigation pane opens if it was closed. */
    async _askName(request) {
        this._ui.setNavOpen(true);
        await this.updateComplete;
        return this._nav.askName(request);
    }

    newDocument(node) {
        return this._createDocument(this._folderFor(node), "untitled", "Name of the new document", (title) => NEW_DOCUMENT(title));
    }

    /** Create a copy of a document, next to it, and open it. */
    async duplicate(node) {
        if (!node) return this._askForItem();
        if (node.type === "folder" || !isDocument(node.path)) {
            this._ui.notify("Duplicate works on documents only");
            return;
        }
        if (!(await this._saveFirst(node))) return;
        const name = documentName(node.path);
        await this._createDocument(parentFolder(node.path), `${name} copy`, `Name of the copy of ${name}`, async () => (await this._transport.readFile(node.path)).text);
    }

    /** Ask for a name in the tree, create the document with the text
     * `text(name)` gives, and open it. */
    async _createDocument(folder, value, label, text) {
        let path;
        const done = await this._askName({
            folder,
            value,
            label,
            submit: async (typed) => {
                const { name, problem } = this._checkName(typed, folder, "file");
                if (problem) return problem;
                path = join(folder, `${name}.texl`);
                try {
                    await this._transport.createFile(path, await text(name));
                } catch (error) {
                    return error.status === 409 ? `${name} already exists here.` : error.message;
                }
            },
        });
        if (!done) return;
        await this._loadTree();
        await this._go({ root: this._root, doc: path });
    }

    /** Create a folder in a chosen place, and make it the current item. */
    async newFolder(node) {
        const folder = this._folderFor(node);
        let path;
        const done = await this._askName({
            folder,
            value: "New folder",
            label: "Name of the new folder",
            icon: folderIcon,
            submit: async (typed) => {
                const { name, problem } = this._checkName(typed, folder, "folder");
                if (problem) return problem;
                path = join(folder, name);
                try {
                    await this._transport.createFolder(path);
                } catch (error) {
                    return error.status === 409 ? `${name} already exists here.` : error.message;
                }
            },
        });
        if (!done) return;
        await this._showInTree(path);
    }

    /** Choose files with the browser's dialog and add them to a folder. A file
     * whose name is taken or cannot be used is left out, and the status says so. */
    upload(node) {
        const folder = this._folderFor(node);
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.addEventListener("change", () => this._uploadFiles(folder, [...input.files]));
        input.click();
    }

    async _uploadFiles(folder, files) {
        if (!files.length) return;
        const done = [];
        const skipped = [];
        this._ui.notify("Uploading…");
        for (const file of files) {
            const { problem } = this._checkName(file.name, folder, isDocument(file.name) ? "file" : "other");
            if (problem) {
                skipped.push(`${file.name} (${problem.replace(/\.$/, "").toLowerCase()})`);
                continue;
            }
            const path = join(folder, file.name);
            try {
                await this._transport.uploadFile(path, file);
                done.push(path);
            } catch (error) {
                skipped.push(`${file.name} (${error.status === 409 ? "already exists" : error.message})`);
            }
        }
        await this._showInTree(done.length === 1 ? done[0] : null);
        const hidden = !this._showOther && done.some((path) => !isDocument(path)) ? "; other files are hidden" : "";
        const uploaded = done.length ? `Uploaded ${plural(done.length, "file")} to /${folder}${hidden}` : "Nothing uploaded";
        this._ui.notify(skipped.length ? `${uploaded}. Not uploaded: ${skipped.join(", ")}` : uploaded);
    }

    /** Rename a file or a folder, in its row of the tree. */
    async rename(node) {
        if (!node) return this._askForItem();
        if (!(await this._saveFirst(node))) return;
        const isFile = node.type === "file";
        const type = isFile && !isDocument(node.path) ? "other" : node.type;
        const folder = parentFolder(node.path);
        const old = type === "file" ? documentName(node.path) : baseName(node.path);
        let to;
        const done = await this._askName({
            folder,
            replaces: node.path,
            value: old,
            label: `New name of ${old}`,
            icon: { file: fileIcon, other: otherFileIcon, folder: folderIcon }[type],
            submit: async (typed) => {
                const { name, problem } = this._checkName(typed, folder, type);
                if (problem) return problem;
                if (name === old) return false;
                const what = isFile ? "it" : "the files in it";
                if (!(await this._ui.confirm(`Links from other documents to ${what} will stop working. Rename ${old} to ${name}?`))) return false;
                to = join(folder, type === "file" ? `${name}.texl` : name);
                try {
                    await this._transport.moveItem(node.path, to);
                } catch (error) {
                    return error.status === 409 ? `${name} already exists here.` : error.message;
                }
            },
        });
        if (done) await this._afterMove(node.path, to);
    }

    /** Open the Move to… dialog for a file or a folder. */
    async moveTo(node) {
        if (!node) return this._askForItem();
        if (!(await this._saveFirst(node))) return;
        try {
            this._moving = { node, tree: await this._transport.readTree(""), error: "" };
        } catch (error) {
            this._ui.notify(error.message);
        }
    }

    async _onMoveChoose(e) {
        const moving = this._moving;
        if (!moving || moving.busy) return;
        moving.busy = true;
        const { node } = moving;
        const to = join(e.detail.folder, baseName(node.path));
        try {
            await this._transport.moveItem(node.path, to);
        } catch (error) {
            const message = error.status === 409 ? `${documentName(to)} already exists in that folder.` : error.message;
            this._moving = { ...moving, busy: false, error: message };
            return;
        }
        this._moving = null;
        await this._afterMove(node.path, to);
        this._ui.notify(`Moved to /${e.detail.folder}`);
    }

    /** Move a file, or a folder with everything in it, to the trash. */
    async deleteItem(node) {
        if (!node) return this._askForItem();
        const isFile = node.type === "file";
        const closes = !!this._doc && isIn(this._doc, node.path);
        const name = isFile && isDocument(node.path) ? documentName(node.path) : baseName(node.path);
        let question = `Delete ${name}? It goes to the .trash folder.`;
        if (!isFile) {
            const { documents, others } = countFiles(node);
            const contents = [documents && plural(documents, "document"), others && plural(others, "other file")].filter(Boolean);
            question = contents.length
                ? `Delete the folder ${name} and everything in it (${contents.join(", ")})? It goes to the .trash folder.`
                : `Delete the empty folder ${name}?`;
        }
        const lost = closes && this.stilo.document.unsaved ? " Unsaved changes will be lost." : "";
        if (!(await this._ui.confirm(question + lost))) return;
        try {
            await (isFile ? this._transport.deleteFile(node.path) : this._transport.deleteFolder(node.path));
        } catch (error) {
            this._ui.notify(`Not deleted: ${error.message}`);
            return;
        }
        if (closes) {
            this.stilo.document.discard();
            await this.stilo.router.replace({ root: this._root, doc: null });
        }
        await this._loadTree();
        this._ui.notify(`Deleted ${name}`);
    }

    /** Before an operation on an item that holds the open document: offer to save
     * its unsaved changes. Returns whether to go on. */
    async _saveFirst(node) {
        const { document } = this.stilo;
        if (!this._doc || !isIn(this._doc, node.path) || !document.unsaved) return true;
        if (!(await this._ui.confirm("The open document has unsaved changes. Save them first?"))) return false;
        await document.save();
        return !document.unsaved;
    }

    /** After a move: follow the item with the open document and the root, whose
     * old addresses are gone, and show it in the tree. */
    async _afterMove(from, to) {
        const follow = (path) => (isIn(path, from) ? to + path.slice(from.length) : path);
        const route = { root: follow(this._root), doc: follow(this._doc) };
        const sameRoot = route.root === this._root;
        await this.stilo.router.replace(route);
        await this._showInTree(sameRoot ? to : null);
    }

    /** Read the tree again, then make the item at `path` the current one. */
    async _showInTree(path) {
        await this._loadTree();
        await this.updateComplete;
        if (path) this._nav?.setCurrent(path);
    }

    /** Copy a file's link, relative to the open document: what `texl.import`
     * or a Markdown link or image there needs. */
    async copyLink(node) {
        if (!node) return this._askForItem();
        if (node.type === "folder") {
            this._ui.notify("Copy link works on files, not folders");
            return;
        }
        const link = relativeLink(this._doc, node.path);
        this._ui.notify((await copyText(link)) ? `Link copied: ${link}` : `Could not copy the link: ${link}`);
    }

    /** Make a folder, or the folder of a document, the navigation root. */
    openAsRoot(node) {
        if (!node) return this._askForItem();
        return this._go({ root: node.type === "folder" ? node.path : parentFolder(node.path), doc: this._doc });
    }

    refreshTree() {
        return this._loadTree();
    }

    toggleOtherFiles() {
        this._showOther = !this._showOther;
        try {
            localStorage.setItem(SHOW_OTHER_KEY, this._showOther);
        } catch {}
    }

    _askForItem() {
        this._ui.notify("Choose an item in the navigation pane first");
    }

    // -- the main area -------------------------------------------------------

    /** A click on a link to a document on this server opens it in the app;
     * a link to anything else on the web, another file or another site, opens
     * in a new tab, with the document left as it is. The link resolves from
     * the open document, as its imports do. Other schemes (mailto:) stay with
     * the browser. */
    _onLinkClick(e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const link = e.composedPath().find((node) => node instanceof HTMLAnchorElement && node.hasAttribute("href"));
        if (!link || link.target || !this._doc) return;
        const url = new URL(link.getAttribute("href"), this._transport.documentUrl(this._doc));
        const path = this._transport.documentPath(url);
        if (path) {
            e.preventDefault();
            this._go({ root: this._root, doc: path });
        } else if (url.protocol === "http:" || url.protocol === "https:") {
            e.preventDefault();
            // Documents are untrusted: the new tab gets no hold on this one.
            window.open(url.href, "_blank", "noopener");
        }
    }

    // -- render --------------------------------------------------------------

    _renderMain() {
        const { error } = this.stilo.document;
        if (error) return html`<div class="placeholder error">${error}</div>`;
        if (!this._doc)
            return html`<div class="placeholder">
                Open a document from the navigation pane, or create one with
                <b>New document</b> (Alt+N).
            </div>`;
        // The editor renders the document as the document at `url`: relative
        // imports resolve from its folder, and imports are fetched again on
        // every rendering. A new editor per document still resets value, undo
        // history and dirty state.
        // The source view hides the editor, so its state survives.
        return html`${keyed(
                this._doc,
                html`<texl-editor
                    ?hidden=${this._ui.source !== null}
                    url=${this._transport.documentUrl(this._doc)}
                ></texl-editor>`,
            )}
            ${this._ui.source !== null
                ? html`<div class="source">
                      <div class="pane-header">
                          Source (read-only)
                          <span class="spacer"></span>
                          <button class="icon-button" title="Back to the editor" aria-label="Back to the editor" @click=${() => this.stilo.commands.run("show-source")}>
                              ${closeIcon}
                          </button>
                      </div>
                      <pre>${this._ui.source}</pre>
                  </div>`
                : ""}`;
    }

    render() {
        const panel = this._ui.pane ? this.stilo.panels.get(this._ui.pane) : null;
        return html`
            <top-bar></top-bar>
            <nav-pane
                ?hidden=${!this._ui.navOpen}
                .tree=${this._tree}
                .root=${this._root}
                .active=${this._doc}
                .error=${this._treeError}
                .showOther=${this._showOther}
                @open-document=${(e) => this._go({ root: this._root, doc: e.detail.path })}
                @navigate=${(e) => this._go({ root: e.detail.root, doc: this._doc })}
                @tree-command=${(e) => this.runCommand(e.detail.id, e.detail.node)}
            ></nav-pane>
            <main @click=${this._onLinkClick}>${this._renderMain()}</main>
            <aside ?hidden=${!panel}>${panel?.render(this.stilo) ?? ""}</aside>
            ${this._moving
                ? html`<move-dialog
                      .tree=${this._moving.tree}
                      .node=${this._moving.node}
                      .error=${this._moving.error}
                      @choose=${this._onMoveChoose}
                      @close=${() => (this._moving = null)}
                  ></move-dialog>`
                : ""}
        `;
    }
}
customElements.define("stilo-app", StiloApp);
