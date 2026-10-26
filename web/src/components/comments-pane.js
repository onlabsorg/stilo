import { LitElement, html, css } from "lit";
import { base } from "./shared.js";
import { closeIcon } from "../icons.js";

/**
 * Right pane: the cell comments of the open document, by line.
 * `comments` is `[{line, comments: string[]}]`; `line` highlights one.
 *
 * Fires `close-pane`.
 */
export class CommentsPane extends LitElement {
    static properties = {
        comments: { attribute: false },
        line: { type: Number },
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
            }
            .entry.current {
                border-color: var(--accent);
            }
            .where {
                margin-bottom: 0.25rem;
                font-size: 11px;
                color: var(--text-muted);
            }
            p {
                margin: 0.25rem 0 0;
                white-space: pre-wrap;
                line-height: 1.45;
            }
        `,
    ];

    constructor() {
        super();
        this.comments = [];
        this.line = null;
    }

    updated(changed) {
        if (changed.has("line") && this.line) this.renderRoot.querySelector(".current")?.scrollIntoView({ block: "nearest" });
    }

    render() {
        const entries = this.comments.filter((c) => c.comments.length);
        return html`
            <div class="pane-header">
                <span>Comments</span><span class="spacer"></span>
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
                ${entries.length
                    ? entries.map(
                          ({ line, comments }) => html`<div class="entry ${line === this.line ? "current" : ""}">
                              <div class="where">Line ${line}</div>
                              ${comments.map((text) => html`<p>${text}</p>`)}
                          </div>`,
                      )
                    : html`<div class="empty">No comments in this document. Add one to a cell with Shift+F2 while editing it.</div>`}
            </div>
        `;
    }
}
customElements.define("comments-pane", CommentsPane);
