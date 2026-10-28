import { LitElement, html, css } from "lit";
import { base } from "./shared.js";
import { menuIcon, commandsIcon, commentsIcon } from "../icons.js";

/**
 * The title/tool bar: navigation toggle on the left, title in the middle,
 * one button per right-pane type on the right.
 *
 * Fires `toggle-nav` and `toggle-pane` ({pane}).
 */
export class TopBar extends LitElement {
    static properties = {
        heading: { type: String },
        status: { type: String },
        navOpen: { type: Boolean, attribute: "nav-open" },
        pane: { type: String },
    };

    static styles = [
        base,
        css`
            :host {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                align-items: center;
                height: var(--bar-height);
                padding: 0 0.5rem;
                background: var(--surface);
                border-bottom: 1px solid var(--border);
            }
            .left,
            .right {
                display: flex;
                align-items: center;
                gap: 0.25rem;
            }
            .right {
                justify-content: flex-end;
            }
            .brand {
                margin-left: 0.25rem;
                font-weight: 600;
                letter-spacing: -0.01em;
            }
            .title {
                display: flex;
                align-items: baseline;
                gap: 0.5rem;
                min-width: 0;
                max-width: 50vw;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                font-weight: 500;
            }
            .status {
                font-size: 12px;
                color: var(--text-muted);
            }
        `,
    ];

    constructor() {
        super();
        this.heading = "";
        this.status = "";
        this.navOpen = true;
        this.pane = null;
    }

    _fire(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    _paneButton(pane, label, icon) {
        return html`<button
            class="icon-button"
            title=${label}
            aria-label=${label}
            aria-pressed=${this.pane === pane}
            @click=${() => this._fire("toggle-pane", { pane })}
        >
            ${icon}
        </button>`;
    }

    render() {
        return html`
            <div class="left">
                <button
                    class="icon-button"
                    title="Navigation"
                    aria-label="Toggle navigation"
                    aria-pressed=${this.navOpen}
                    @click=${() => this._fire("toggle-nav")}
                >
                    ${menuIcon}
                </button>
                <span class="brand">Stilo</span>
            </div>
            <div class="title">
                <span>${this.heading}</span>
                ${this.status ? html`<span class="status">${this.status}</span>` : ""}
            </div>
            <div class="right">
                ${this._paneButton("comments", "Comments", commentsIcon)}
                ${this._paneButton("commands", "Commands", commandsIcon)}
            </div>
        `;
    }
}
customElements.define("top-bar", TopBar);
