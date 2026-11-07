import { LitElement, html, css } from "lit";
import { base } from "./shared.js";
import { folderIcon } from "../icons.js";

/**
 * The Move to… dialog: choose a folder from the whole tree. The item's own
 * folder, and for a folder the folder itself and those inside it, cannot be
 * chosen.
 *
 * Fires `choose` ({folder}) when the user confirms, `close` when the user gives
 * up. The app closes it by removing it.
 */
export class MoveDialog extends LitElement {
    static properties = {
        tree: { attribute: false },
        node: { attribute: false },
        error: { type: String },
        _folder: { state: true },
    };

    static styles = [
        base,
        css`
            :host {
                display: contents;
            }
            dialog {
                width: min(28rem, calc(100vw - 2rem));
                max-height: calc(100vh - 4rem);
                padding: 0;
                border: 1px solid var(--border);
                border-radius: var(--radius);
                background: var(--surface);
                color: var(--text);
                box-shadow: var(--shadow);
            }
            dialog[open] {
                display: flex;
                flex-direction: column;
            }
            dialog::backdrop {
                background: rgb(0 0 0 / 0.4);
            }
            h2 {
                margin: 0;
                padding: 1rem 1rem 0.5rem;
                font-size: 15px;
                font-weight: 600;
                overflow-wrap: anywhere;
            }
            .warning {
                margin: 0;
                padding: 0 1rem 0.75rem;
                font-size: 12px;
                line-height: 1.5;
                color: var(--text-muted);
            }
            .folders {
                flex: 1;
                min-height: 8rem;
                overflow: auto;
                border-block: 1px solid var(--border);
                padding: 0.25rem 0;
            }
            .folder {
                display: flex;
                align-items: center;
                gap: 0.375rem;
                width: 100%;
                height: 1.875rem;
                padding: 0 1rem 0 calc(1rem + var(--depth) * 0.875rem);
                border: 0;
                background: none;
                color: var(--text);
                font: inherit;
                text-align: left;
                white-space: nowrap;
                cursor: pointer;
            }
            .folder:hover:not(:disabled) {
                background: var(--hover);
            }
            .folder[aria-pressed="true"] {
                background: var(--active);
                color: var(--accent);
            }
            .folder:disabled {
                color: var(--text-muted);
                cursor: default;
                opacity: 0.6;
            }
            .folder .icon {
                width: 16px;
                height: 16px;
            }
            .error {
                margin: 0;
                padding: 0.5rem 1rem 0;
                font-size: 12px;
                color: var(--danger);
            }
            .buttons {
                display: flex;
                justify-content: flex-end;
                gap: 0.5rem;
                padding: 0.75rem 1rem;
            }
            .buttons button {
                height: 2rem;
                padding: 0 0.875rem;
                border: 1px solid var(--border);
                border-radius: var(--radius);
                background: none;
                color: var(--text);
                font: inherit;
                cursor: pointer;
            }
            .buttons button:hover:not(:disabled) {
                background: var(--hover);
            }
            .buttons button.primary {
                border-color: var(--accent);
                color: var(--accent);
            }
            .buttons button:disabled {
                opacity: 0.5;
                cursor: default;
            }
        `,
    ];

    constructor() {
        super();
        this.tree = null;
        this.node = null;
        this.error = "";
        this._folder = null;
    }

    firstUpdated() {
        this.renderRoot.querySelector("dialog").showModal();
    }

    _fire(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail }));
    }

    /** Whether the item can go in `folder`. */
    _allowed(folder) {
        const { path, type } = this.node;
        const here = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
        if (folder === here) return false;
        return !(type === "folder" && (folder === path || folder.startsWith(`${path}/`)));
    }

    _renderFolder(node, depth) {
        return html`<button
                class="folder"
                style="--depth: ${depth}"
                ?disabled=${!this._allowed(node.path)}
                aria-pressed=${this._folder === node.path}
                @click=${() => (this._folder = node.path)}
            >
                ${folderIcon}<span>${node.name || "/"}</span>
            </button>
            ${(node.children ?? []).filter((c) => c.type === "folder").map((c) => this._renderFolder(c, depth + 1))}`;
    }

    render() {
        const name = this.node.name?.replace(/\.texl$/, "") ?? this.node.path;
        const what = this.node.type === "folder" ? "the documents in it" : "it";
        return html`<dialog
            aria-label="Move ${name} to a folder"
            @cancel=${(e) => {
                e.preventDefault();
                this._fire("close");
            }}
        >
            <h2>Move ${name} to…</h2>
            <p class="warning">
                Links from other documents to ${what}, and relative links in ${what} to documents elsewhere, will stop
                working.
            </p>
            <div class="folders">${this._renderFolder(this.tree, 0)}</div>
            ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : ""}
            <div class="buttons">
                <button @click=${() => this._fire("close")}>Cancel</button>
                <button class="primary" ?disabled=${this._folder === null} @click=${() => this._fire("choose", { folder: this._folder })}>
                    Move
                </button>
            </div>
        </dialog>`;
    }
}
customElements.define("move-dialog", MoveDialog);
