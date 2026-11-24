import { LitElement, html, css } from "lit";
import { base } from "./shared.js";

/**
 * A modal dialog over the window (the `ui` service's `dialog`, `confirm`,
 * `prompt`, `write`): the browser's `<dialog>`, so the focus stays inside and the
 * page behind cannot be used. Shows `content`, a Lit template. Escape fires
 * `cancel`. Styles the forms Stilo's dialogs are made of: `.message`, an
 * input, `.buttons` with `button.primary` (`.danger`) and `button.secondary`.
 */
export class StiloDialog extends LitElement {
    static properties = {
        content: { attribute: false },
    };

    static styles = [
        base,
        css`
            dialog {
                min-width: min(24rem, calc(100vw - 2rem));
                max-width: min(36rem, calc(100vw - 2rem));
                padding: 1.25rem;
                border: 1px solid var(--border);
                border-radius: var(--radius);
                background: var(--surface);
                color: var(--text);
                box-shadow: var(--shadow);
                font: inherit;
            }
            dialog::backdrop {
                background: rgb(0 0 0 / 0.35);
            }
            form {
                margin: 0;
            }
            .message {
                display: block;
                margin: 0 0 1rem;
                line-height: 1.5;
            }
            input {
                display: block;
                width: 100%;
                margin-top: 0.5rem;
                height: 2rem;
                padding: 0 0.5rem;
                border: 1px solid var(--border);
                border-radius: 4px;
                background: var(--bg);
                color: var(--text);
                font: inherit;
            }
            input:focus {
                outline: none;
                border-color: var(--accent);
            }
            /* The rich text editor of ui.write */
            .rich-text {
                min-height: 7rem;
                max-height: 50vh;
                overflow: auto;
                margin-bottom: 1rem;
                border: 1px solid var(--border);
                border-radius: 4px;
                background: var(--bg);
                text-align: left;
            }
            .buttons {
                display: flex;
                justify-content: flex-end;
                gap: 0.5rem;
            }
            .buttons button {
                min-width: 5rem;
                height: 2rem;
                padding: 0 0.875rem;
                border: 1px solid var(--border);
                border-radius: 4px;
                background: var(--surface-2);
                color: var(--text);
                font: inherit;
                cursor: pointer;
            }
            .buttons button:hover {
                background: var(--hover);
            }
            .buttons button.primary {
                border-color: var(--accent);
                background: var(--accent);
                color: var(--surface);
            }
            .buttons button.primary.danger {
                border-color: var(--danger);
                background: var(--danger);
            }
            .buttons button:focus-visible {
                outline: 2px solid var(--accent);
                outline-offset: 2px;
            }
        `,
    ];

    constructor() {
        super();
        this.content = null;
    }

    firstUpdated() {
        const dialog = this.renderRoot.querySelector("dialog");
        // Where the focus was, through shadow roots, to give it back on closing
        let active = document.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        this._before = active;
        // A dialog not in the page (a test that never connects it) stays closed
        if (dialog.isConnected) dialog.showModal();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._before?.focus?.();
        this._before = null;
    }

    _onCancel(e) {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent("cancel"));
    }

    render() {
        return html`<dialog @cancel=${this._onCancel}>${this.content}</dialog>`;
    }
}
customElements.define("stilo-dialog", StiloDialog);
