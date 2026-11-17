import { LitElement, html, css } from "lit";
import { base } from "./shared.js";
import { closeIcon, chevronIcon } from "../icons.js";
import { StiloController } from "../core/context.js";
import { formatKeys } from "../core/keys.js";

/** The key of the Extensions group among the folded ones, apart from the
 * commands' groups, which may have any name. */
const EXTENSIONS = Symbol("extensions");

/**
 * Right pane: every command of the `commands` service, by group, with its
 * shortcut from the `keys` service. A click runs it.
 *
 * Groups fold and unfold on a click on their heading.
 *
 * Its close button closes the right pane (`ui`).
 *
 * Last, an Extensions group lists the extensions that are active
 * (`extensions`) and those that could not be activated, with why; only
 * while there is one.
 */
export class CommandsPane extends LitElement {
    static properties = {
        _collapsed: { state: true },
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
                padding-bottom: 1rem;
            }
            h3 {
                margin: 0.5rem 0 0;
                font-size: 12px;
                font-weight: 500;
            }
            button.group {
                display: flex;
                align-items: center;
                gap: 0.25rem;
                width: 100%;
                padding: 0.25rem 1rem 0.25rem 0.5rem;
                border: 0;
                background: none;
                color: var(--text-muted);
                font: inherit;
                text-align: left;
                cursor: pointer;
            }
            button.group:hover {
                color: var(--text);
            }
            .chevron {
                display: flex;
                transition: transform var(--transition);
            }
            .chevron .icon {
                width: 14px;
                height: 14px;
            }
            .chevron.open {
                transform: rotate(90deg);
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
            div.command.failed {
                color: var(--danger);
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

    constructor() {
        super();
        this._collapsed = new Set();
        this._stilo = new StiloController(this, (stilo) => [stilo.commands, stilo.keys, stilo.extensions]);
    }

    _toggle(group) {
        const collapsed = new Set(this._collapsed);
        collapsed.has(group) ? collapsed.delete(group) : collapsed.add(group);
        this._collapsed = collapsed;
    }

    _renderGroup(group, list) {
        const open = !this._collapsed.has(group);
        return html`<h3>
                <button class="group" aria-expanded=${open} @click=${() => this._toggle(group)}>
                    <span class="chevron ${open ? "open" : ""}">${chevronIcon}</span>${group}
                </button>
            </h3>
            ${open ? list.map((c) => this._renderCommand(c)) : ""}`;
    }

    _renderCommand(command) {
        const { commands, keys } = this._stilo.stilo;
        const shortcut = keys.keysFor(command.id);
        const content = html`<span class="label">${command.label}</span>${shortcut ? html`<kbd>${formatKeys(shortcut)}</kbd>` : ""}`;
        return command.run
            ? html`<button class="command" @click=${() => commands.run(command.id)}>${content}</button>`
            : html`<div class="command" title="Use the keyboard shortcut">${content}</div>`;
    }

    /** The Extensions group: the active extensions, then the failed ones. */
    _renderExtensions() {
        const extensions = this._stilo.stilo?.extensions;
        const active = extensions?.list() ?? [];
        const failed = extensions?.failures ?? [];
        if (!active.length && !failed.length) return "";
        const open = !this._collapsed.has(EXTENSIONS);
        return html`<h3 class="extensions">
                <button class="group" aria-expanded=${open} @click=${() => this._toggle(EXTENSIONS)}>
                    <span class="chevron ${open ? "open" : ""}">${chevronIcon}</span>Extensions
                </button>
            </h3>
            ${open
                ? html`${active.map((e) => html`<div class="command extension"><span class="label">${e.id}</span></div>`)}
                  ${failed.map(
                      (f) => html`<div class="command extension failed" title=${f.reason}>
                          <span class="label">${f.id}: not activated</span>
                      </div>`,
                  )}`
                : ""}`;
    }

    render() {
        const groups = Map.groupBy(this._stilo.stilo?.commands.list() ?? [], (c) => c.group);
        return html`
            <div class="pane-header">
                <span>Commands</span><span class="spacer"></span>
                <button class="icon-button" aria-label="Close" title="Close" @click=${() => this._stilo.stilo?.ui.openPane(null)}>
                    ${closeIcon}
                </button>
            </div>
            <div class="list">
                ${[...groups].map(([group, list]) => this._renderGroup(group, list))}
                ${this._renderExtensions()}
            </div>
        `;
    }
}
customElements.define("commands-pane", CommandsPane);
