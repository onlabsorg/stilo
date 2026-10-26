import { LitElement, html, css } from "lit";
import { base } from "./shared.js";
import { folderIcon, fileIcon, chevronIcon, upIcon } from "../icons.js";

/**
 * The navigation pane: the tree of folders and Texl files under the
 * navigation root (a tree node from the protocol's QUERY).
 *
 * Fires `open-document` ({path}) and `navigate` ({root}) to move the root.
 */
export class NavPane extends LitElement {
    static properties = {
        tree: { attribute: false },
        root: { type: String },
        active: { type: String },
        error: { type: String },
        _collapsed: { state: true },
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
    }

    _fire(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    _toggle(path) {
        const collapsed = new Set(this._collapsed);
        collapsed.has(path) ? collapsed.delete(path) : collapsed.add(path);
        this._collapsed = collapsed;
    }

    _renderNode(node, depth) {
        if (node.type === "file") {
            return html`<li>
                <button
                    class="item"
                    style="--depth: ${depth}"
                    aria-current=${node.path === this.active}
                    title=${node.path}
                    @click=${() => this._fire("open-document", { path: node.path })}
                >
                    <span class="spacer-chevron"></span>${fileIcon}<span class="name">${node.name.replace(/\.texl$/, "")}</span>
                </button>
            </li>`;
        }
        const open = !this._collapsed.has(node.path);
        return html`<li>
            <button
                class="item"
                style="--depth: ${depth}"
                aria-expanded=${open}
                title=${node.path}
                @click=${() => this._toggle(node.path)}
                @dblclick=${() => this._fire("navigate", { root: node.path })}
            >
                <span class="chevron ${open ? "open" : ""}">${chevronIcon}</span>${folderIcon}<span class="name">${node.name}</span>
            </button>
            ${open && node.children ? html`<ul>${node.children.map((c) => this._renderNode(c, depth + 1))}</ul>` : ""}
        </li>`;
    }

    render() {
        const parent = this.root.includes("/") ? this.root.slice(0, this.root.lastIndexOf("/")) : "";
        return html`
            <div class="pane-header">
                <span class="root" title=${"/" + this.root}>/${this.root}</span>
                <span class="spacer"></span>
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
            <div class="tree">
                ${this.error
                    ? html`<div class="error">${this.error}</div>`
                    : !this.tree
                      ? html`<div class="empty">Loading…</div>`
                      : this.tree.children?.length
                        ? html`<ul>${this.tree.children.map((c) => this._renderNode(c, 0))}</ul>`
                        : html`<div class="empty">No documents here.</div>`}
            </div>
        `;
    }
}
customElements.define("nav-pane", NavPane);
