import { LitElement, html, css } from "lit";
import { base } from "./shared.js";
import { closeIcon } from "../icons.js";
import { commands, formatKeys } from "../commands.js";

/**
 * Right pane: every user command, grouped, with its shortcut.
 *
 * Fires `run-command` ({id}) when a command is clicked, `close-pane`.
 */
export class CommandsPane extends LitElement {
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
                padding-bottom: 1rem;
            }
            h3 {
                margin: 0.75rem 1rem 0.25rem;
                font-size: 12px;
                font-weight: 500;
                color: var(--text-muted);
            }
            button.command,
            div.command {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                width: 100%;
                min-height: 2rem;
                padding: 0.25rem 1rem;
                border: 0;
                background: none;
                color: var(--text);
                font: inherit;
                text-align: left;
            }
            button.command {
                cursor: pointer;
            }
            button.command:hover {
                background: var(--hover);
            }
            div.command {
                color: var(--text-muted);
            }
            .label {
                flex: 1;
            }
            kbd {
                padding: 0.1rem 0.4rem;
                border: 1px solid var(--border);
                border-radius: 4px;
                background: var(--surface-2);
                color: var(--text-muted);
                font: 11px/1.4 var(--font);
                white-space: nowrap;
            }
        `,
    ];

    _fire(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    _renderCommand(command) {
        const content = html`<span class="label">${command.label}</span>${command.keys
                ? html`<kbd>${formatKeys(command.keys)}</kbd>`
                : ""}`;
        return command.run
            ? html`<button class="command" @click=${() => this._fire("run-command", { id: command.id })}>${content}</button>`
            : html`<div class="command" title="Use the keyboard shortcut">${content}</div>`;
    }

    render() {
        const groups = Map.groupBy(commands, (c) => c.group);
        return html`
            <div class="pane-header">
                <span>Commands</span><span class="spacer"></span>
                <button class="icon-button" aria-label="Close" title="Close" @click=${() => this._fire("close-pane")}>
                    ${closeIcon}
                </button>
            </div>
            <div class="list">
                ${[...groups].map(
                    ([group, list]) => html`<h3>${group}</h3>${list.map((c) => this._renderCommand(c))}`,
                )}
            </div>
        `;
    }
}
customElements.define("commands-pane", CommandsPane);
