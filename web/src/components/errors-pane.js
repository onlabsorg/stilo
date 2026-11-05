import { LitElement, html, css } from "lit";
import { base } from "./shared.js";
import { closeIcon } from "../icons.js";
import { excerptAt } from "../editor/index.js";
import { documentPath } from "../api.js";

/** A document's name for the pane: its path on this server, or its URL. */
function documentName(uri) {
    if (uri === null) return "Parsed code";
    return documentPath(new URL(uri)) ?? uri;
}

/** A description, with the parts between backticks as code. */
function describe(description) {
    return description.split("`").map((part, i) => (i % 2 ? html`<code>${part}</code>` : part));
}

/**
 * Right pane: the errors of the open document. `errors` are the editor's
 * (`DocumentError`); `current` is the key of the one to highlight.
 *
 * Fires `close-pane`, and `go-to` with `{line}` (in the open document) or
 * `{uri, line}` (in another document) when an error or a location is clicked.
 */
export class ErrorsPane extends LitElement {
    static properties = {
        errors: { attribute: false },
        current: { type: String },
    };

    static styles = [
        base,
        css`
            :host {
                display: flex;
                flex-direction: column;
                min-height: 0;
            }
            .list {
                flex: 1;
                overflow: auto;
                padding: 0 0.75rem 1rem;
            }
            .entry {
                margin-bottom: 0.5rem;
                padding: 0.625rem 0.75rem;
                border: 1px solid var(--border);
                border-radius: var(--radius);
                background: var(--surface-2);
                cursor: pointer;
            }
            .entry:hover {
                border-color: var(--text-muted);
            }
            .entry.current {
                border-color: var(--danger);
            }
            p {
                margin: 0;
                line-height: 1.45;
                overflow-wrap: anywhere;
            }
            code,
            pre {
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                font-size: 0.92em;
            }
            pre {
                margin: 0.5rem 0;
                padding: 0.375rem 0.5rem;
                /* Wrapped, so the marked position is always in view */
                white-space: pre-wrap;
                overflow-wrap: anywhere;
                border-radius: 4px;
                background: var(--surface);
            }
            mark {
                background: none;
                color: var(--danger);
                font-weight: 600;
                border-bottom: 2px solid var(--danger);
            }
            .where {
                margin-top: 0.375rem;
                font-size: 11px;
                color: var(--text-muted);
            }
            .cause {
                margin-top: 0.5rem;
                padding-top: 0.5rem;
                border-top: 1px solid var(--border);
            }
            .label {
                display: block;
                font-size: 11px;
                color: var(--text-muted);
            }
            button.link {
                padding: 0;
                border: 0;
                background: none;
                font: inherit;
                color: var(--accent);
                cursor: pointer;
            }
            button.link:hover {
                text-decoration: underline;
            }
        `,
    ];

    constructor() {
        super();
        this.errors = [];
        this.current = null;
    }

    updated(changed) {
        if (changed.has("current") && this.current) this.renderRoot.querySelector(".current")?.scrollIntoView({ block: "nearest" });
    }

    _goTo(target) {
        this.dispatchEvent(new CustomEvent("go-to", { detail: target, bubbles: true, composed: true }));
    }

    /** A link to a cell of the open document, by its number. */
    _cellLink(line) {
        return html`<button
            class="link"
            @click=${(e) => {
                e.stopPropagation();
                this._goTo({ line });
            }}
        >
            ${line}
        </button>`;
    }

    /** Where an error was made, as a link if the place can be opened. */
    _location({ uri, local, line, textLine }) {
        const name = documentName(uri);
        if (uri === null || (!local && name === uri)) return name;
        const cell = `ell ${line}${textLine ? `, line ${textLine}` : ""}`;
        return html`<button
            class="link"
            @click=${(e) => {
                e.stopPropagation();
                this._goTo(local ? { line } : { uri, line });
            }}
        >
            ${local ? `C${cell}` : `${name}, c${cell}`}
        </button>`;
    }

    /** The cells that returned the error, unless that is where it was made. */
    _shownAt({ lines, location }) {
        if (location.local && lines.length === 1 && lines[0] === location.line) return "";
        const label = lines.length === 1 ? "Shown in cell" : "Shown in cells";
        return html`<div class="where">
            ${label}
            ${lines.map((line, i) => html`${i ? ", " : ""}${this._cellLink(line)}`)}
        </div>`;
    }

    _renderError(error) {
        const { before, at, after } = excerptAt(error.location.source, error.location.pos);
        return html`<div
            class="entry ${error.key === this.current ? "current" : ""}"
            title="Go to cell ${error.lines[0]}"
            @click=${() => this._goTo({ line: error.lines[0] })}
        >
            <p>${describe(error.description)}</p>
            <pre>${before}<mark>${at}</mark>${after}</pre>
            <div class="where">${this._location(error.location)}</div>
            ${this._shownAt(error)}
            ${error.causes.map(
                ({ description, location }) => html`<div class="cause">
                    <span class="label">Caused by</span>
                    <p>${describe(description)}</p>
                    ${location ? html`<div class="where">${this._location(location)}</div>` : ""}
                </div>`,
            )}
        </div>`;
    }

    render() {
        return html`
            <div class="pane-header">
                <span>Errors</span><span class="spacer"></span>
                <button
                    class="icon-button"
                    aria-label="Close"
                    title="Close"
                    @click=${() => this.dispatchEvent(new CustomEvent("close-pane", { bubbles: true, composed: true }))}
                >
                    ${closeIcon}
                </button>
            </div>
            <div class="list">
                ${this.errors.length
                    ? this.errors.map((error) => this._renderError(error))
                    : html`<div class="empty">No errors in this document.</div>`}
            </div>
        `;
    }
}
customElements.define("errors-pane", ErrorsPane);
