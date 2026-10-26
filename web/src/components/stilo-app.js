import { LitElement, html, css } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { parseDocument, cellComments } from "../editor/index.js";
import { base } from "./shared.js";
import { readFile, createFile, updateFile, readTree, documentUrl, ApiError } from "../api.js";
import { readRoute, routeUrl } from "../route.js";
import { commands, matchCommand, isMac } from "../commands.js";
import { toggleTheme } from "../theme.js";
import "./top-bar.js";
import "./nav-pane.js";
import "./commands-pane.js";
import "./comments-pane.js";

const NEW_DOCUMENT = (title) => `<!--{ markdown }-->\n# ${title}\n`;

/**
 * The app shell: top bar, navigation pane, editor, right pane. Holds the
 * state (navigation root and tree, open document, dirty flag) and runs the
 * commands.
 */
export class StiloApp extends LitElement {
    static properties = {
        _root: { state: true },
        _tree: { state: true },
        _treeError: { state: true },
        _doc: { state: true },
        _docError: { state: true },
        _dirty: { state: true },
        _status: { state: true },
        _navOpen: { state: true },
        _pane: { state: true },
        _comments: { state: true },
        _commentLine: { state: true },
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
        this._tree = null;
        this._treeError = "";
        this._docError = "";
        this._dirty = false;
        this._status = "";
        this._navOpen = true;
        this._pane = null;
        this._comments = [];
        this._commentLine = null;
        this._etag = null;
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onPopState = () => this._applyRoute(readRoute());
        this._onBeforeUnload = (e) => {
            if (this._dirty) e.preventDefault();
        };
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener("keydown", this._onKeyDown);
        window.addEventListener("popstate", this._onPopState);
        window.addEventListener("beforeunload", this._onBeforeUnload);
        this._applyRoute(readRoute());
    }

    disconnectedCallback() {
        window.removeEventListener("keydown", this._onKeyDown);
        window.removeEventListener("popstate", this._onPopState);
        window.removeEventListener("beforeunload", this._onBeforeUnload);
        super.disconnectedCallback();
    }

    get _editor() {
        return this.renderRoot.querySelector("texl-editor");
    }

    // -- routing -------------------------------------------------------------

    async _applyRoute({ root, doc }) {
        if (root !== this._root) {
            this._root = root;
            this._loadTree();
        }
        if (doc !== this._doc) await this._loadDocument(doc);
    }

    _go(route) {
        if (this._dirty && route.doc !== this._doc && !confirm("Discard unsaved changes?")) return;
        history.pushState(null, "", routeUrl(route));
        this._applyRoute(route);
    }

    async _loadTree() {
        this._tree = null;
        this._treeError = "";
        try {
            this._tree = await readTree(this._root);
        } catch (error) {
            this._treeError = error.status === 404 ? `Folder /${this._root} not found.` : error.message;
        }
    }

    async _loadDocument(path) {
        this._doc = path;
        this._docError = "";
        this._dirty = false;
        this._status = "";
        this._comments = [];
        this._commentLine = null;
        if (!path) return;
        try {
            const { text, etag } = await readFile(path);
            if (path !== this._doc) return; // another document was opened meanwhile
            this._etag = etag;
            await this.updateComplete;
            const editor = this._editor;
            editor.value = text;
            this._updateComments();
            editor.focus();
        } catch (error) {
            this._docError = error.status === 404 ? `Document /${path} not found.` : error.message;
        }
    }

    // -- commands ------------------------------------------------------------

    _onKeyDown(e) {
        if (e.defaultPrevented) return;
        const command = matchCommand(e);
        if (!command) return;
        e.preventDefault();
        command.run(this);
    }

    runCommand(id) {
        commands.find((c) => c.id === id)?.run?.(this);
    }

    async save() {
        if (!this._doc || !this._editor) return;
        this._status = "Saving…";
        try {
            this._etag = await updateFile(this._doc, this._editor.value, this._etag);
            this._dirty = false;
            this._status = "Saved";
        } catch (error) {
            this._status = error.status === 412 ? "Not saved: changed on the server, reload it" : `Not saved: ${error.message}`;
        }
    }

    async reload() {
        if (!this._doc) return;
        if (this._dirty && !confirm("Discard unsaved changes?")) return;
        await this._loadDocument(this._doc);
    }

    async newDocument() {
        const name = prompt(`New document in /${this._root}`, "untitled");
        if (!name) return;
        const file = name.endsWith(".texl") ? name : `${name}.texl`;
        const path = this._root ? `${this._root}/${file}` : file;
        try {
            await createFile(path, NEW_DOCUMENT(name.replace(/\.texl$/, "")));
        } catch (error) {
            alert(error instanceof ApiError && error.status === 409 ? `/${path} already exists.` : error.message);
            return;
        }
        await this._loadTree();
        this._go({ root: this._root, doc: path });
    }

    toggleNav() {
        this._navOpen = !this._navOpen;
    }

    togglePane(pane) {
        this._pane = this._pane === pane ? null : pane;
    }

    toggleTheme() {
        toggleTheme();
    }

    /** Send a key to the editor, as if the user pressed it there. */
    sendEditorKey(key, { mod = false, altKey = false, shiftKey = false } = {}) {
        const editor = this._editor;
        if (!editor) return;
        editor.focus();
        editor.dispatchEvent(
            new KeyboardEvent("keydown", {
                key,
                altKey,
                shiftKey,
                ctrlKey: mod && !isMac,
                metaKey: mod && isMac,
                bubbles: true,
                composed: true,
                cancelable: true,
            }),
        );
    }

    // -- editor events -------------------------------------------------------

    _onEditorChange() {
        this._dirty = true;
        this._status = "";
        this._updateComments();
    }

    _onCommentsClick(e) {
        this._commentLine = e.detail.line;
        this._pane = "comments";
    }

    _updateComments() {
        const text = this._editor?.value ?? "";
        this._comments = parseDocument(text).map((cell, i) => ({ line: i + 1, comments: cellComments(cell.texl) }));
    }

    // -- render --------------------------------------------------------------

    _heading() {
        if (!this._doc) return this._root ? `/${this._root}` : "Documents";
        const name = this._doc.slice(this._doc.lastIndexOf("/") + 1).replace(/\.texl$/, "");
        return `${name}${this._dirty ? " •" : ""}`;
    }

    _renderMain() {
        if (this._docError) return html`<div class="placeholder error">${this._docError}</div>`;
        if (!this._doc)
            return html`<div class="placeholder">
                Open a document from the navigation pane, or create one with
                <b>New document</b> (Alt+N).
            </div>`;
        // The editor renders the document as the document at `url`: relative
        // imports resolve from its folder, and imports are fetched again on
        // every rendering. A new editor per document still resets value, undo
        // history and dirty state.
        return keyed(
            this._doc,
            html`<texl-editor
                url=${documentUrl(this._doc)}
                @change=${this._onEditorChange}
                @comments-click=${this._onCommentsClick}
            ></texl-editor>`,
        );
    }

    render() {
        return html`
            <top-bar
                .heading=${this._heading()}
                .status=${this._status}
                ?nav-open=${this._navOpen}
                .pane=${this._pane}
                @toggle-nav=${this.toggleNav}
                @toggle-pane=${(e) => this.togglePane(e.detail.pane)}
            ></top-bar>
            <nav-pane
                ?hidden=${!this._navOpen}
                .tree=${this._tree}
                .root=${this._root}
                .active=${this._doc}
                .error=${this._treeError}
                @open-document=${(e) => this._go({ root: this._root, doc: e.detail.path })}
                @navigate=${(e) => this._go({ root: e.detail.root, doc: this._doc })}
            ></nav-pane>
            <main>${this._renderMain()}</main>
            <aside ?hidden=${!this._pane} @close-pane=${() => (this._pane = null)} @run-command=${(e) => this.runCommand(e.detail.id)}>
                ${this._pane === "commands" ? html`<commands-pane></commands-pane>` : ""}
                ${this._pane === "comments"
                    ? html`<comments-pane .comments=${this._comments} .line=${this._commentLine}></comments-pane>`
                    : ""}
            </aside>
        `;
    }
}
customElements.define("stilo-app", StiloApp);
