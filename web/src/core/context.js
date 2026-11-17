// How the views reach the services: the `stilo` object is provided by Lit
// context (@lit/context), so any element inside its provider, at any depth
// and through shadow roots, gets it.

import { LitElement, html, css } from "lit";
import { createContext, ContextConsumer, ContextProvider } from "@lit/context";

/** The context of the `stilo` object. A string key, so that two copies of
 * this module still share it. */
export const stiloContext = createContext("@onlabsorg/stilo-web:stilo");

/**
 * A controller that gives an element the `stilo` object of its provider, as
 * `controller.stilo`, and renders the element again when one of the services
 * it watches changes.
 *
 *     this._stilo = new StiloController(this, (stilo) => [stilo.errors]);
 */
export class StiloController {
    /**
     * @param {import("lit").ReactiveControllerHost & HTMLElement} host
     * @param {(stilo: object) => import("./service.js").Service[]} [watch] -
     *   The services whose changes render the host again.
     */
    constructor(host, watch = () => []) {
        this.host = host;
        this.stilo = null;
        this._watch = watch;
        this._stops = [];
        host.addController(this);
        this._consumer = new ContextConsumer(host, {
            context: stiloContext,
            subscribe: true,
            callback: (stilo) => this._set(stilo),
        });
    }

    _set(stilo) {
        this._unwatch();
        this.stilo = stilo ?? null;
        if (this.stilo) this._stops = this._watch(this.stilo).map((service) => service.on("change", () => this.host.requestUpdate()));
        this.host.requestUpdate();
    }

    _unwatch() {
        for (const stop of this._stops) stop();
        this._stops = [];
    }

    hostDisconnected() {
        this._unwatch();
    }
}

/**
 * Provides a `stilo` object to the elements inside it, for a front end
 * composed of Stilo's components, and for tests.
 *
 *     <stilo-provider .stilo=${stilo}><nav-pane></nav-pane></stilo-provider>
 */
export class StiloProvider extends LitElement {
    static properties = {
        stilo: { attribute: false },
    };

    static styles = css`
        :host {
            display: contents;
        }
    `;

    constructor() {
        super();
        this.stilo = null;
        this._provider = new ContextProvider(this, { context: stiloContext });
    }

    willUpdate(changed) {
        if (changed.has("stilo")) this._provider.setValue(this.stilo);
    }

    render() {
        return html`<slot></slot>`;
    }
}
if (!customElements.get("stilo-provider")) customElements.define("stilo-provider", StiloProvider);
