import { LitElement, html, css } from "lit";
import { base } from "./shared.js";
import { menuIcon } from "../icons.js";
import { StiloController } from "../core/context.js";

/**
 * The title/tool bar: navigation toggle and the brand on the left ("Stilo",
 * or what `topBar.setBrand` renders, inside `.brand`); in the middle the open
 * document's name, with • while it has unsaved changes (`document`), or else
 * the navigation root (`router`), "Read-only" with the reason if the
 * document is (`document.readOnly`), and the status (`ui`); on the right the
 * items of the `topBar` service. The panels' buttons are in the panel rail
 * (`<panel-rail>`), at the right edge of the window.
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
                display: inline-flex;
                align-items: center;
                gap: 0.375rem;
                margin-left: 0.25rem;
                font-weight: 600;
                letter-spacing: -0.01em;
            }
            .brand a {
                color: inherit;
                text-decoration: none;
            }
            .brand a:hover {
                text-decoration: underline;
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
            .status.warning {
                color: var(--warning);
            }
            .status.error {
                color: var(--danger);
            }
            .read-only {
                padding: 0 0.375rem;
                border: 1px solid var(--border);
                border-radius: 4px;
                font-size: 11px;
                font-weight: 500;
                color: var(--text-muted);
            }
            .item {
                display: inline-flex;
                align-items: center;
            }
        `,
    ];

    constructor() {
        super();
        this._stilo = new StiloController(this, (stilo) => [stilo.ui, stilo.topBar, stilo.document, stilo.router, stilo.tree, stilo.views]);
    }

    /** The open view's label, or the open document's name, or else the navigation root. */
    _heading({ document, router, views }) {
        if (router.view) return views.get(router.view)?.label ?? router.view;
        const path = document.path;
        if (!path) return router.root ? `/${router.root}` : "Documents";
        const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.texl$/, "");
        return `${name}${document.dirty ? " •" : ""}`;
    }

    render() {
        const stilo = this._stilo.stilo;
        if (!stilo) return "";
        const { ui, topBar } = stilo;
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
                <span class="brand">${topBar.brand ? topBar.brand(stilo) : "Stilo"}</span>
            </div>
            <div class="title">
                <span>${this._heading(stilo)}</span>
                ${stilo.document.readOnly !== null
                    ? html`<span class="read-only" title=${stilo.document.readOnly}>Read-only</span>`
                    : ""}
                ${ui.status ? html`<span class="status ${ui.level}">${ui.status}</span>` : ""}
            </div>
            <div class="right">
                ${topBar.list().map((item) => html`<span class="item" data-id=${item.id}>${item.render(stilo)}</span>`)}
            </div>
        `;
    }
}
customElements.define("top-bar", TopBar);
