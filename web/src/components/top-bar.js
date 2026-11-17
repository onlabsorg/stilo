import { LitElement, html, css } from "lit";
import { base } from "./shared.js";
import { menuIcon } from "../icons.js";
import { StiloController } from "../core/context.js";

/**
 * The title/tool bar: navigation toggle on the left; in the middle the open
 * document's name, with • while it has unsaved changes (`document`), or else
 * the navigation root (`router`), and the status (`ui`); on the right one
 * button per panel of the right pane (`panels`), with its badge.
 */
export class TopBar extends LitElement {

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
            button.icon-button.has-badge {
                width: auto;
                gap: 0.25rem;
                padding: 0 0.375rem;
            }
            button.icon-button.danger {
                color: var(--danger);
            }
            .count {
                font-size: 12px;
                font-weight: 600;
            }
        `,
    ];

    constructor() {
        super();
        this._stilo = new StiloController(this, (stilo) => [stilo.ui, stilo.panels, stilo.document, stilo.router]);
    }

    /** The open document's name, or else the navigation root. */
    _heading({ document, router }) {
        const path = document.path;
        if (!path) return router.root ? `/${router.root}` : "Documents";
        const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.texl$/, "");
        return `${name}${document.dirty ? " •" : ""}`;
    }

    /** The button of a panel, with its badge if it has one. */
    _panelButton(panel) {
        const { ui, panels } = this._stilo.stilo;
        const badge = panels.badge(panel.id);
        const label = badge?.label ?? panel.label;
        return html`<button
            class="icon-button ${badge ? "has-badge" : ""} ${badge?.tone ?? ""}"
            title=${label}
            aria-label=${label}
            aria-pressed=${ui.pane === panel.id}
            @click=${() => ui.togglePane(panel.id)}
        >
            ${panel.icon}${badge ? html`<span class="count">${badge.text}</span>` : ""}
        </button>`;
    }

    render() {
        const stilo = this._stilo.stilo;
        if (!stilo) return "";
        const { ui, panels } = stilo;
        return html`
            <div class="left">
                <button
                    class="icon-button"
                    title="Navigation"
                    aria-label="Toggle navigation"
                    aria-pressed=${ui.navOpen}
                    @click=${() => ui.toggleNav()}
                >
                    ${menuIcon}
                </button>
                <span class="brand">Stilo</span>
            </div>
            <div class="title">
                <span>${this._heading(stilo)}</span>
                ${ui.status ? html`<span class="status">${ui.status}</span>` : ""}
            </div>
            <div class="right">${panels.list().map((panel) => this._panelButton(panel))}</div>
        `;
    }
}
customElements.define("top-bar", TopBar);
