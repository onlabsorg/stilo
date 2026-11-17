import { LitElement, html, css } from "lit";
import { base } from "./shared.js";
import { closeIcon } from "../icons.js";
import { StiloController } from "../core/context.js";

/**
 * Right pane: the cell comments of the open document, by line, from the
 * `comments` service, the line it points out highlighted, and under each the
 * comments of the providers (an issue tracker, a review), with where they come
 * from and who wrote them; all read-only here. A click on an entry goes to its
 * line (`comments.goTo`).
 */
export class CommentsPane extends LitElement {

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
            .other {
                margin-top: 0.5rem;
                padding-left: 0.5rem;
                border-left: 2px solid var(--border);
            }
            .by {
                margin-top: 0.125rem;
                font-size: 11px;
                color: var(--text-muted);
            }
        `,
    ];

    constructor() {
        super();
        this._stilo = new StiloController(this, (stilo) => [stilo.comments]);
        this._shown = null;
    }

    updated() {
        // Scroll to the line pointed out, when it changes
        const line = this._stilo.stilo?.comments.line ?? null;
        if (line !== this._shown && line) this.renderRoot.querySelector(".current")?.scrollIntoView({ block: "nearest" });
        this._shown = line;
    }

    render() {
        const stilo = this._stilo.stilo;
        const entries = (stilo?.comments.list ?? []).filter((c) => c.comments.length || c.others?.length);
        return html`
            <div class="pane-header">
                <span>Comments</span><span class="spacer"></span>
                <button
                    class="icon-button"
                    aria-label="Close"
                    title="Close"
                    @click=${() => stilo?.ui.openPane(null)}
                >
                    ${closeIcon}
                </button>
            </div>
            <div class="list">
                ${entries.length
                    ? entries.map(
                          ({ line, comments, others = [] }) => html`<div
                              class="entry ${line === stilo.comments.line ? "current" : ""}"
                              title="Go to cell ${line}"
                              @click=${() => stilo.comments.goTo(line)}
                          >
                              <div class="where">Cell ${line}</div>
                              ${comments.map((text) => html`<p>${text}</p>`)}
                              ${others.map(
                                  (c) => html`<div class="other">
                                      <p>${c.text}</p>
                                      <div class="by">${[c.source, c.author, c.date].filter(Boolean).join(" · ")}</div>
                                  </div>`,
                              )}
                          </div>`,
                      )
                    : html`<div class="empty">No comments in this document. Add one to a cell with Shift+F2 while editing it.</div>`}
            </div>
        `;
    }
}
customElements.define("comments-pane", CommentsPane);
