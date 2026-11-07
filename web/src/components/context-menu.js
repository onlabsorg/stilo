import { LitElement, html, css } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { base } from "./shared.js";
import { formatKeys } from "../commands.js";

/**
 * A menu at a point of the window, kept inside it. Takes the focus; arrow
 * keys move through the items.
 *
 * `items` holds commands of `commands.js` and `"-"` for a separator. An item
 * with a boolean `checked` is an option, with a check mark when on.
 *
 * Fires `pick` ({id}) when an item is chosen, `close` on Escape, Tab, a press
 * outside the menu, or when the window loses focus or changes size.
 */
export class ContextMenu extends LitElement {
    static properties = {
        items: { attribute: false },
        x: { type: Number },
        y: { type: Number },
    };

    static styles = [
        base,
        css`
            :host {
                position: fixed;
                z-index: 10;
                display: block;
                min-width: 13rem;
                padding: 0.25rem;
                border: 1px solid var(--border);
                border-radius: var(--radius);
                background: var(--surface);
                box-shadow: var(--shadow);
            }
            button {
                display: flex;
                align-items: center;
                gap: 1.5rem;
                width: 100%;
                height: 1.875rem;
                padding: 0 0.625rem;
                border: 0;
                border-radius: 4px;
                background: none;
                color: var(--text);
                font: inherit;
                text-align: left;
                white-space: nowrap;
                cursor: pointer;
            }
            button:hover,
            button:focus {
                background: var(--hover);
                outline: none;
            }
            .label {
                flex: 1;
            }
            .keys {
                font-size: 11px;
                color: var(--text-muted);
            }
            hr {
                margin: 0.25rem 0;
                border: 0;
                border-top: 1px solid var(--border);
            }
        `,
    ];

    constructor() {
        super();
        this.items = [];
        this.x = 0;
        this.y = 0;
        this._close = () => this.dispatchEvent(new CustomEvent("close"));
        this._onPointerDown = (e) => {
            if (!e.composedPath().includes(this)) this._close();
        };
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener("pointerdown", this._onPointerDown);
        window.addEventListener("blur", this._close);
        window.addEventListener("resize", this._close);
    }

    disconnectedCallback() {
        window.removeEventListener("pointerdown", this._onPointerDown);
        window.removeEventListener("blur", this._close);
        window.removeEventListener("resize", this._close);
        super.disconnectedCallback();
    }

    updated() {
        const { width, height } = this.getBoundingClientRect();
        this.style.left = `${Math.max(0, Math.min(this.x, innerWidth - width))}px`;
        this.style.top = `${Math.max(0, Math.min(this.y, innerHeight - height))}px`;
        this.renderRoot.querySelector("button")?.focus();
    }

    _onKeyDown(e) {
        const buttons = [...this.renderRoot.querySelectorAll("button")];
        const index = buttons.indexOf(this.renderRoot.activeElement);
        const target = {
            ArrowDown: buttons[(index + 1) % buttons.length],
            ArrowUp: buttons[(index - 1 + buttons.length) % buttons.length],
            Home: buttons[0],
            End: buttons.at(-1),
        }[e.key];
        if (target) target.focus();
        else if (e.key === "Escape" || e.key === "Tab") this._close();
        else return;
        e.preventDefault();
    }

    render() {
        return html`<div role="menu" @keydown=${this._onKeyDown}>
            ${this.items.map((item) =>
                item === "-"
                    ? html`<hr />`
                    : html`<button
                          role=${item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                          aria-checked=${ifDefined(item.checked)}
                          @click=${() => this.dispatchEvent(new CustomEvent("pick", { detail: { id: item.id } }))}
                      >
                          <span class="label">${item.label}</span>${item.keys
                              ? html`<span class="keys">${formatKeys(item.keys)}</span>`
                              : ""}${item.checked ? html`<span class="keys" aria-hidden="true">✓</span>` : ""}
                      </button>`,
            )}
        </div>`;
    }
}
customElements.define("context-menu", ContextMenu);
