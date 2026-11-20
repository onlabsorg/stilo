import { LitElement, html, css } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { ContextProvider } from "@lit/context";
import { base } from "./shared.js";
import { closeIcon } from "../icons.js";
import { createStilo, stiloContext } from "../core/index.js";
import { readRoute } from "../route.js";
import { activateBuiltins } from "../builtins/index.js";
import "./top-bar.js";
import "./panel-rail.js";
import "./nav-pane.js";
import "./move-dialog.js";
import "./stilo-dialog.js";

/**
 * The app shell: top bar, navigation pane, editor, right pane. Creates and
 * provides the services (`stilo`, S17), activates Stilo's own contributions
 * on them, and lays out the window: the editor of the open document (or the
 * source view, or a view of `views` addressed by `?view=`), the open panel, the status line (`status`, only while it
 * has items), the Move to… dialog and the dialogs of `ui`. The state lives in the
 * services; the parts read it through context.
 */
export class StiloApp extends LitElement {
    static properties = {
        stilo: { attribute: false },
    };

    static styles = [
        base,
        css`
            :host {
                display: grid;
                grid-template-rows: var(--bar-height) 1fr auto;
                grid-template-columns: auto 1fr auto auto;
                grid-template-areas:
                    "bar bar bar bar"
                    "nav main pane rail"
                    "status status status status";
                height: 100vh;
                overflow: hidden;
            }
            top-bar {
                grid-area: bar;
            }
            panel-rail {
                grid-area: rail;
            }
            nav-pane {
                grid-area: nav;
                width: var(--nav-width);
            }
            main {
                grid-area: main;
                display: flex;
                flex-direction: column;
                min-width: 0;
                min-height: 0;
                padding: 1.5rem 1.5rem 0;
            }
            texl-editor {
                flex: 1;
                min-height: 0;
                width: 100%;
                max-width: 56rem;
                margin: 0 auto;
                border-radius: var(--radius) var(--radius) 0 0;
                box-shadow: var(--shadow);
                background: var(--texl-paper, var(--surface));
                color: var(--text);
            }
            .source {
                flex: 1;
                min-height: 0;
                width: 100%;
                max-width: 56rem;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                border-radius: var(--radius) var(--radius) 0 0;
                box-shadow: var(--shadow);
                background: var(--texl-paper, var(--surface));
                color: var(--text);
            }
            .source pre {
                flex: 1;
                margin: 0;
                padding: 0.5rem 1rem 1rem;
                overflow: auto;
                font-family: var(--texl-mono, ui-monospace, monospace);
                font-size: 13px;
                line-height: 1.5;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
                user-select: text;
            }
            .view {
                flex: 1;
                min-height: 0;
                width: 100%;
                max-width: 56rem;
                margin: 0 auto;
                overflow: auto;
                border-radius: var(--radius) var(--radius) 0 0;
                box-shadow: var(--shadow);
                background: var(--texl-paper, var(--surface));
                color: var(--text);
            }
            .placeholder {
                margin: auto;
                max-width: 24rem;
                text-align: center;
                color: var(--text-muted);
                line-height: 1.6;
            }
            .placeholder.error {
                color: var(--danger);
            }
            aside {
                grid-area: pane;
                display: flex;
                flex-direction: column;
                width: var(--pane-width);
                min-height: 0;
                overflow-y: auto;
                background: var(--surface);
                border-left: 1px solid var(--border);
            }
            /* A panel of one element fills the pane (and may scroll inside,
               as Stilo's own do); a panel of several elements stacks them
               from the top, and the pane scrolls */
            aside > * {
                flex: none;
            }
            aside > :only-child {
                flex: 1;
                min-height: 0;
            }
            footer {
                grid-area: status;
                display: flex;
                justify-content: flex-end;
                align-items: center;
                gap: 1rem;
                min-height: 1.75rem;
                padding: 0 0.75rem;
                background: var(--surface);
                border-top: 1px solid var(--border);
                color: var(--text-muted);
                font-size: 12px;
            }
            footer > .item {
                display: inline-flex;
                align-items: center;
            }
            [hidden] {
                display: none !important;
            }
            @media (max-width: 720px) {
                nav-pane,
                aside {
                    position: absolute;
                    top: var(--bar-height);
                    bottom: 0;
                    z-index: 1;
                    box-shadow: var(--shadow);
                }
                nav-pane {
                    left: 0;
                }
                aside {
                    right: var(--rail-width);
                    width: min(var(--pane-width), calc(100vw - var(--rail-width)));
                }
                main {
                    grid-column: 1 / 4;
                    padding: 0.75rem 0.75rem 0;
                }
            }
        `,
    ];

    constructor() {
        super();
        /** The services (S17), provided to the elements inside by context.
         * Created here unless set before the app is connected. */
        this.stilo = createStilo();
        this._provider = new ContextProvider(this, { context: stiloContext, initialValue: this.stilo });
        this._useStilo();
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onBeforeUnload = (e) => {
            if (this.stilo.document.dirty) e.preventDefault();
        };
    }

    willUpdate(changed) {
        if (changed.has("stilo")) {
            this._useStilo();
            this._provider.setValue(this.stilo);
        }
    }

    /** Activate Stilo's own contributions on the services, and render again
     * when what the shell shows changes. */
    _useStilo() {
        activateBuiltins(this.stilo);
        this.stilo.ui.setSettle(() => this.updateComplete);
        this.stilo.ui.setDialogView(this);
        this._unwatch?.();
        const { ui, panels, status, document, tree, router, views } = this.stilo;
        const stops = [ui, panels, status, document, tree, router, views].map((service) => service.on("change", () => this.requestUpdate()));
        this._unwatch = () => stops.forEach((stop) => stop());
    }

    get _doc() {
        return this.stilo.document.path;
    }

    get _transport() {
        return this.stilo.transport;
    }

    get _ui() {
        return this.stilo.ui;
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener("keydown", this._onKeyDown);
        window.addEventListener("beforeunload", this._onBeforeUnload);
        this.stilo.info.load(); // once: startStilo has read it already
        this.stilo.router.start();
    }

    disconnectedCallback() {
        if (this.stilo.ui.dialogView === this) this.stilo.ui.setDialogView(null);
        window.removeEventListener("keydown", this._onKeyDown);
        window.removeEventListener("beforeunload", this._onBeforeUnload);
        this.stilo.router.stop();
        super.disconnectedCallback();
    }

    /** After every rendering: attach the editor made for the open document. */
    updated() {
        const editor = this.renderRoot.querySelector("texl-editor");
        if (editor !== this.stilo.editor.element) this.stilo.editor.attach(editor);
    }

    /** The shortcuts bound anywhere in the window (`keys`, `when: "global"`),
     * unless something inside handled the key, or a dialog is open. */
    _onKeyDown(e) {
        if (e.defaultPrevented || this.stilo.tree.moving || this.stilo.ui.currentDialog) return;
        const id = this.stilo.keys.match(e, "global");
        if (!this.stilo.commands.get(id)?.run) return;
        e.preventDefault();
        this.stilo.commands.run(id);
    }

    /** Run a command by its id, on a tree node if given. */
    runCommand(id, node) {
        return this.stilo.commands.run(id, { node });
    }

    // -- the main area -------------------------------------------------------

    /** A click on a link to a document on this server opens it in the app;
     * a link to anything else on the web, another file or another site, opens
     * in a new tab, with the document left as it is. The link resolves from
     * the open document, as its imports do. Other schemes (mailto:) stay with
     * the browser. */
    _onLinkClick(e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const link = e.composedPath().find((node) => node instanceof HTMLAnchorElement && node.hasAttribute("href"));
        if (!link || link.target) return;
        // From a view, links resolve from the page's address
        const base = this._doc ? this._transport.documentUrl(this._doc) : location.href;
        const url = new URL(link.getAttribute("href"), base);
        const path = this._transport.documentPath(url);
        if (url.origin === new URL(this._transport.origin ?? location.origin).origin && url.searchParams.get("view")) {
            // A link to a view of this app
            e.preventDefault();
            this.stilo.router.go(readRoute(url));
        } else if (path) {
            e.preventDefault();
            this.stilo.router.go({ root: this.stilo.router.root, doc: path });
        } else if (url.protocol === "http:" || url.protocol === "https:") {
            e.preventDefault();
            // Documents are untrusted: the new tab gets no hold on this one.
            window.open(url.href, "_blank", "noopener");
        }
    }

    // -- render --------------------------------------------------------------

    /** A view (`router.view`) in place of the editor. */
    _renderView() {
        const { router, views } = this.stilo;
        const view = views.get(router.view);
        if (!view) return html`<div class="placeholder error">This page is not available: no view “${router.view}”.</div>`;
        return html`<div class="view" data-view=${view.id}>${view.render(this.stilo, router.params)}</div>`;
    }

    _renderMain() {
        if (this.stilo.router.view) return this._renderView();
        const { error } = this.stilo.document;
        if (error) return html`<div class="placeholder error">${error}</div>`;
        if (!this._doc)
            return html`<div class="placeholder">
                Open a document from the navigation pane, or create one with
                <b>New document</b> (Alt+N).
            </div>`;
        // The editor renders the document as the document at `url`: relative
        // imports resolve from its folder, and imports are fetched again on
        // every rendering. A new editor per document still resets value, undo
        // history and dirty state.
        // The source view hides the editor, so its state survives.
        return html`${keyed(
                this._doc,
                html`<texl-editor
                    ?hidden=${this._ui.source !== null}
                    url=${this._transport.documentUrl(this._doc)}
                    .loader=${this._transport.loader}
                    ?readonly=${this.stilo.document.readOnly !== null}
                ></texl-editor>`,
            )}
            ${this._ui.source !== null
                ? html`<div class="source">
                      <div class="pane-header">
                          Source (read-only)
                          <span class="spacer"></span>
                          <button class="icon-button" title="Back to the editor" aria-label="Back to the editor" @click=${() => this.stilo.commands.run("show-source")}>
                              ${closeIcon}
                          </button>
                      </div>
                      <pre>${this._ui.source}</pre>
                  </div>`
                : ""}`;
    }

    render() {
        const { ui, panels, status, tree } = this.stilo;
        const panel = ui.pane ? panels.get(ui.pane) : null;
        const dialog = ui.currentDialog;
        const items = status.list();
        const moving = tree.moving;
        return html`
            <top-bar></top-bar>
            <nav-pane ?hidden=${!ui.navOpen}></nav-pane>
            <main @click=${this._onLinkClick}>${this._renderMain()}</main>
            <aside ?hidden=${!panel}>${panel?.render(this.stilo) ?? ""}</aside>
            <panel-rail></panel-rail>
            ${items.length
                ? html`<footer>${items.map((item) => html`<span class="item" data-id=${item.id}>${item.render(this.stilo)}</span>`)}</footer>`
                : ""}
            ${moving
                ? html`<move-dialog
                      .tree=${moving.tree}
                      .node=${moving.node}
                      .error=${moving.error}
                      @choose=${(e) => tree.chooseMove(e.detail.folder)}
                      @close=${() => tree.endMove()}
                  ></move-dialog>`
                : ""}
            ${dialog
                ? keyed(dialog, html`<stilo-dialog .content=${dialog.render()} @cancel=${() => dialog.close(undefined)}></stilo-dialog>`)
                : ""}
        `;
    }
}
customElements.define("stilo-app", StiloApp);
