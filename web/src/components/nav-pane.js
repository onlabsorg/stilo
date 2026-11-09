import { LitElement, html, css } from "lit";
import { base } from "./shared.js";
import { folderIcon, fileIcon, otherFileIcon, chevronIcon, upIcon, moreIcon, newFileIcon, newFolderIcon } from "../icons.js";
import { commands, treeMenus, isMac } from "../commands.js";
import { isDocument, documentUrl } from "../api.js";
import "./context-menu.js";

/** Whether a tree node is a document or has one somewhere inside. */
const hasDocuments = (node) => (node.type === "file" ? isDocument(node.path) : !!node.children?.some(hasDocuments));

/** Whether a tree node is a file or has one somewhere inside. */
const hasFiles = (node) => node.type === "file" || !!node.children?.some(hasFiles);

/** Whether a tree node is another file, or a folder with files but no
 * documents at any depth: shown muted, and hidden with the other files. An
 * empty folder is not one: it is a place for documents. */
const isOther = (node) => !hasDocuments(node) && hasFiles(node);

/** The node at `path` in a tree, if any. */
function findNode(node, path) {
    if (node.path === path) return node;
    for (const child of node.children ?? []) {
        const found = findNode(child, path);
        if (found) return found;
    }
    return null;
}

/** The element that has the focus, inside shadow roots too. */
function focusedElement() {
    let element = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element;
}

/**
 * The navigation pane: the tree of folders and files under the navigation
 * root (a tree node from the protocol's QUERY). Documents open in the editor;
 * other files are muted and open by their public URL in a new tab.
 *
 * Each item has a menu, opened by a right click or its `⋯` button; so has the
 * pane, from the empty area of the tree or the header's `⋯` button. When an
 * item has the focus, F2 renames it and Delete deletes it. With `showOther`
 * off, other files and folders holding only other files are left out. `askName()` asks for a name in a
 * row of the tree: a new one, or in place of the item being renamed.
 *
 * Fires `open-document` ({path}), `navigate` ({root}) to move the root, and
 * `tree-command` ({id, node}) to run a command of `commands.js` on a tree node.
 */
export class NavPane extends LitElement {
    static properties = {
        tree: { attribute: false },
        root: { type: String },
        active: { type: String },
        error: { type: String },
        showOther: { attribute: false },
        _collapsed: { state: true },
        _menu: { state: true },
        _naming: { state: true },
    };

    static styles = [
        base,
        css`
            :host {
                display: flex;
                flex-direction: column;
                min-height: 0;
                background: var(--surface);
                border-right: 1px solid var(--border);
            }
            .root {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                text-transform: none;
                letter-spacing: 0;
                font-size: 12px;
            }
            ul {
                list-style: none;
                margin: 0;
                padding: 0;
            }
            .tree {
                flex: 1;
                overflow: auto;
                padding-bottom: 1rem;
            }
            .item {
                display: flex;
                align-items: center;
                gap: 0.375rem;
                width: 100%;
                height: 1.875rem;
                padding: 0 0.75rem 0 calc(0.5rem + var(--depth) * 0.875rem);
                border: 0;
                background: none;
                color: var(--text);
                font: inherit;
                text-align: left;
                cursor: pointer;
                white-space: nowrap;
            }
            .item:hover {
                background: var(--hover);
            }
            a.item {
                text-decoration: none;
            }
            .item.other,
            .item.other .icon {
                color: var(--text-faint);
            }
            .item[aria-current="true"] {
                background: var(--active);
                color: var(--accent);
            }
            .item .icon {
                width: 16px;
                height: 16px;
                color: var(--text-muted);
            }
            .item[aria-current="true"] .icon {
                color: var(--accent);
            }
            .chevron {
                transition: transform var(--transition);
            }
            .chevron.open {
                transform: rotate(90deg);
            }
            .spacer-chevron {
                width: 16px;
                flex: none;
            }
            .name {
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .row {
                position: relative;
            }
            .row:hover .item,
            .row:focus-within .item,
            .row.target .item {
                padding-right: 2rem;
            }
            .row.target .item {
                background: var(--hover);
            }
            button.more {
                position: absolute;
                top: 0.1875rem;
                right: 0.25rem;
                width: 1.5rem;
                height: 1.5rem;
                visibility: hidden;
            }
            .row:hover .more,
            .row:focus-within .more,
            .row.target .more {
                visibility: visible;
            }
            .naming {
                display: flex;
                align-items: center;
                gap: 0.375rem;
                height: 1.875rem;
                padding: 0 0.5rem 0 calc(0.5rem + var(--depth) * 0.875rem);
            }
            .naming .icon {
                width: 16px;
                height: 16px;
                color: var(--text-muted);
            }
            .naming input {
                flex: 1;
                min-width: 0;
                height: 1.5rem;
                padding: 0 0.25rem;
                border: 1px solid var(--accent);
                border-radius: 4px;
                outline: none;
                background: var(--surface);
                color: var(--text);
                font: inherit;
            }
            .naming-error {
                padding: 0.125rem 0.5rem 0.25rem calc(0.5rem + var(--depth) * 0.875rem + 2.375rem);
                font-size: 12px;
                white-space: normal;
                color: var(--danger);
            }
            .error {
                padding: 0.5rem 1rem;
                color: var(--danger);
            }
        `,
    ];

    constructor() {
        super();
        this.tree = null;
        this.root = "";
        this.active = null;
        this.error = "";
        this._collapsed = new Set();
        this.showOther = true;
        this._menu = null;
        this._naming = null;
        this._current = null;
    }

    /** The tree node last focused or right-clicked, if any: what a command acts
     * on when it is not called from the node's own menu or keys. */
    get current() {
        return this._current;
    }

    /** Make the item at `path` the current one, if it is in the tree. */
    setCurrent(path) {
        this._current = this.tree ? findNode(this.tree, path) : null;
    }

    willUpdate(changed) {
        if (changed.has("tree")) {
            this._current = this._current && this.tree ? findNode(this.tree, this._current.path) : null;
            this._menu = null;
        }
    }

    _fire(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    _toggle(path) {
        const collapsed = new Set(this._collapsed);
        collapsed.has(path) ? collapsed.delete(path) : collapsed.add(path);
        this._collapsed = collapsed;
    }

    /** Open the menu `kind` (of `treeMenus`) on `node`, at a point or below `origin`. */
    _openMenu(kind, node, origin, point) {
        const box = origin.getBoundingClientRect();
        const items = treeMenus[kind].map((id) => {
            if (id === "-") return id;
            const command = commands.find((c) => c.id === id);
            return id === "tree-show-other" ? { ...command, checked: this.showOther } : command;
        });
        this._menu = { items, node, origin, x: point?.x ?? box.left, y: point?.y ?? box.bottom };
    }

    _closeMenu() {
        const origin = this._menu?.origin;
        this._menu = null;
        origin?.focus();
    }

    _onContextMenu(e, kind, node) {
        e.preventDefault();
        e.stopPropagation();
        this._current = kind === "pane" ? this._current : node;
        // A menu key or Shift+F10 can report no position: then open at the item
        const point = e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : null;
        this._openMenu(kind, node, e.target, point);
    }

    /** The `⋯` button: open its menu, or close it if open. */
    _onMoreClick(e, kind, node) {
        const origin = e.currentTarget;
        if (this._menu?.origin === origin) return this._closeMenu();
        if (kind !== "pane") this._current = node;
        this._openMenu(kind, node, origin);
    }

    _onRowKeyDown(e, node) {
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        const id = e.key === "F2" ? "tree-rename" : e.key === "Delete" || (isMac && e.key === "Backspace") ? "tree-delete" : null;
        if (!id) return;
        e.preventDefault();
        this._fire("tree-command", { id, node });
    }

    /** What every row has around its item button: the menu, the keys, the `⋯` button. */
    _renderRow(kind, node, depth, item) {
        if (this._naming?.replaces === node.path) return this._renderNaming(depth);
        return html`<div
            class="row ${this._menu?.node === node ? "target" : ""}"
            @focusin=${() => (this._current = node)}
            @pointerdown=${() => (this._current = node)}
            @contextmenu=${(e) => this._onContextMenu(e, kind, node)}
            @keydown=${(e) => this._onRowKeyDown(e, node)}
        >
            ${item}${this._moreButton(kind, node, `More actions for ${node.name}`, "more")}
        </div>`;
    }

    _moreButton(kind, node, label, extraClass = "") {
        // A press on it does not count as outside the open menu: its click decides
        return html`<button
            class="icon-button ${extraClass}"
            tabindex=${extraClass ? -1 : 0}
            title="More actions"
            aria-label=${label}
            aria-haspopup="menu"
            @pointerdown=${(e) => e.stopPropagation()}
            @click=${(e) => this._onMoreClick(e, kind, node)}
        >
            ${moreIcon}
        </button>`;
    }

    /**
     * Ask for a name in a new row of `folder`, opened if needed, or in place of
     * the item at the path `replaces`. `submit(name)` does the work and returns a
     * message if the name cannot be used: the row stays and shows it. It returns
     * `false` to give up. Resolves to `true` when done, `false` if given up
     * (also Escape, leaving the row, no name).
     *
     * @param {{folder: string, replaces?: string, value?: string, label: string,
     *   icon?: unknown, submit: (name: string) => Promise<string | false | void>}} request
     */
    async askName(request) {
        this._endNaming(false);
        const collapsed = new Set(this._collapsed);
        const segments = request.folder.split("/");
        segments.forEach((_, i) => collapsed.delete(segments.slice(0, i + 1).join("/")));
        this._collapsed = collapsed;
        const back = focusedElement();
        const answer = new Promise((resolve) => (this._naming = { ...request, back, resolve, error: "" }));
        await this.updateComplete;
        const input = this.renderRoot.querySelector(".naming input");
        input?.focus();
        input?.select();
        return answer;
    }

    _endNaming(done) {
        const naming = this._naming;
        if (!naming) return;
        this._naming = null;
        naming.resolve(done);
    }

    async _submitName(value) {
        const naming = this._naming;
        if (!naming || naming.busy) return;
        const name = value.trim();
        if (!name) return this._endNaming(false);
        naming.busy = true;
        const error = await naming.submit(name);
        naming.busy = false;
        if (this._naming !== naming) return;
        if (error === false) this._endNaming(false);
        else if (error) this._naming = { ...naming, error };
        else this._endNaming(true);
    }

    _onNamingKeyDown(e) {
        e.stopPropagation();
        if (e.key === "Enter") {
            e.preventDefault();
            this._submitName(e.target.value);
        } else if (e.key === "Escape") {
            e.preventDefault();
            const { back } = this._naming;
            this._endNaming(false);
            back?.focus();
        }
    }

    _onNamingBlur() {
        // Switching to another window is not leaving the row
        if (document.hasFocus() && !this._naming?.busy) this._endNaming(false);
    }

    _renderNaming(depth) {
        const { value = "", label, icon = fileIcon, error } = this._naming;
        return html`<div style="--depth: ${depth}">
            <div class="naming">
                <span class="spacer-chevron"></span>${icon}<input
                    type="text"
                    value=${value}
                    aria-label=${label}
                    aria-invalid=${!!error}
                    spellcheck="false"
                    @keydown=${this._onNamingKeyDown}
                    @blur=${this._onNamingBlur}
                    @input=${() => {
                        if (this._naming.error) this._naming = { ...this._naming, error: "" };
                    }}
                />
            </div>
            ${error ? html`<div class="naming-error" role="alert">${error}</div>` : ""}
        </div>`;
    }

    /** Whether to show a tree node: another file, or a folder of them, may be
     * left out, unless a name is being asked for inside it. */
    _visible(node) {
        if (this.showOther || !isOther(node)) return true;
        const folder = this._naming?.folder;
        return folder !== undefined && (folder === node.path || folder.startsWith(`${node.path}/`));
    }

    /** The children of a folder: folders, the row asking for a name, files. */
    _renderChildren(folder, depth) {
        const children = folder.children.filter((c) => this._visible(c));
        const render = (type) => children.filter((c) => c.type === type).map((c) => this._renderNode(c, depth));
        return html`<ul>
            ${render("folder")}${this._naming?.folder === folder.path && !this._naming.replaces
                ? html`<li>${this._renderNaming(depth)}</li>`
                : ""}${render("file")}
        </ul>`;
    }

    /** A button of the header. No node: the command chooses from the current item. */
    _headerButton(id, label, icon) {
        return html`<button
            class="icon-button"
            title=${label}
            aria-label=${label}
            @click=${() => this._fire("tree-command", { id, node: null })}
        >
            ${icon}
        </button>`;
    }

    _renderNode(node, depth) {
        if (node.type === "file" && !isDocument(node.path)) {
            // A link, so that the browser's own ways to open it work too
            return html`<li>
                ${this._renderRow("other", node, depth, html`<a
                    class="item other"
                    style="--depth: ${depth}"
                    href=${documentUrl(node.path)}
                    target="_blank"
                    rel="noopener"
                    title=${node.path}
                >
                    <span class="spacer-chevron"></span>${otherFileIcon}<span class="name">${node.name}</span>
                </a>`)}
            </li>`;
        }
        if (node.type === "file") {
            return html`<li>
                ${this._renderRow("file", node, depth, html`<button
                    class="item"
                    style="--depth: ${depth}"
                    aria-current=${node.path === this.active}
                    title=${node.path}
                    @click=${() => this._fire("open-document", { path: node.path })}
                >
                    <span class="spacer-chevron"></span>${fileIcon}<span class="name">${node.name.replace(/\.texl$/, "")}</span>
                </button>`)}
            </li>`;
        }
        const open = !this._collapsed.has(node.path);
        return html`<li>
            ${this._renderRow("folder", node, depth, html`<button
                class="item ${isOther(node) ? "other" : ""}"
                style="--depth: ${depth}"
                aria-expanded=${open}
                title=${node.path}
                @click=${() => this._toggle(node.path)}
                @dblclick=${() => this._fire("navigate", { root: node.path })}
            >
                <span class="chevron ${open ? "open" : ""}">${chevronIcon}</span>${folderIcon}<span class="name">${node.name}</span>
            </button>`)}
            ${open && node.children ? this._renderChildren(node, depth + 1) : ""}
        </li>`;
    }

    render() {
        const parent = this.root.includes("/") ? this.root.slice(0, this.root.lastIndexOf("/")) : "";
        return html`
            <div class="pane-header">
                <span class="root" title=${"/" + this.root}>/${this.root}</span>
                <span class="spacer"></span>
                ${this._headerButton("new-document", "New document", newFileIcon)}
                ${this._headerButton("tree-new-folder", "New folder", newFolderIcon)}
                ${this._moreButton("pane", this.tree, "More actions for the navigation pane")}
                ${this.root
                    ? html`<button
                          class="icon-button"
                          title="Parent folder"
                          aria-label="Parent folder"
                          @click=${() => this._fire("navigate", { root: parent })}
                      >
                          ${upIcon}
                      </button>`
                    : ""}
            </div>
            <div
                class="tree"
                @contextmenu=${(e) => this._onContextMenu(e, "pane", this.tree)}
                @scroll=${() => (this._menu = null)}
            >
                ${this.error
                    ? html`<div class="error">${this.error}</div>`
                    : !this.tree
                      ? html`<div class="empty">Loading…</div>`
                      : this._naming || this.tree.children?.some((c) => this._visible(c))
                        ? this._renderChildren(this.tree, 0)
                        : html`<div class="empty">No documents here.</div>`}
            </div>
            ${this._menu
                ? html`<context-menu
                      .items=${this._menu.items}
                      .x=${this._menu.x}
                      .y=${this._menu.y}
                      @close=${this._closeMenu}
                      @pick=${(e) => {
                          const { node } = this._menu;
                          this._closeMenu();
                          this._fire("tree-command", { id: e.detail.id, node });
                      }}
                  ></context-menu>`
                : ""}
        `;
    }
}
customElements.define("nav-pane", NavPane);
