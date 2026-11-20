import { LitElement, html, css } from "lit";
import { base } from "./shared.js";
import { StiloController } from "../core/context.js";

/**
 * The panel rail: a narrow bar at the right edge of the window, always
 * shown, with one button per panel of the right pane (`panels`), in
 * `order` from the top, each with its badge (the count under the icon). A
 * click opens the panel, or closes it if it is the one open
 * (`ui.togglePane`); the open panel's button is pressed. Buttons that run
 * other actions go in the top bar (`topBar`), never here.
 */
export class PanelRail extends LitElement {

    static styles = [
        base,
        css`
            :host {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.25rem;
                width: var(--rail-width);
                padding: 0.5rem 0;
                background: var(--surface);
                border-left: 1px solid var(--border);
            }
            button.icon-button {
                position: relative;
                flex-direction: column;
                height: auto;
                min-height: 2rem;
                padding: 0.4rem 0;
            }
            /* The open panel: a bar on the edge that faces it */
            button.icon-button[aria-pressed="true"]::before {
                content: "";
                position: absolute;
                left: calc(-0.5rem - 1px);
                top: 0.25rem;
                bottom: 0.25rem;
                width: 2px;
                border-radius: 1px;
                background: var(--accent);
            }
            button.icon-button.danger {
                color: var(--danger);
            }
            .count {
                margin-top: 0.125rem;
                font-size: 11px;
                font-weight: 600;
                line-height: 1;
            }
        `,
    ];

    constructor() {
        super();
        this._stilo = new StiloController(this, (stilo) => [stilo.ui, stilo.panels]);
    }

    connectedCallback() {
        super.connectedCallback();
        this.setAttribute("role", "toolbar");
        this.setAttribute("aria-orientation", "vertical");
        this.setAttribute("aria-label", "Panels");
    }

    /** The button of a panel, with its badge if it has one. */
    _button(panel) {
        const { ui, panels } = this._stilo.stilo;
        const badge = panels.badge(panel.id);
        const label = badge?.label ?? panel.label;
        return html`<button
            class="icon-button ${badge?.tone ?? ""}"
            data-id=${panel.id}
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
        return stilo.panels.list().map((panel) => this._button(panel));
    }
}
customElements.define("panel-rail", PanelRail);
