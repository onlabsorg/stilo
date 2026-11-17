// The base of the core services (S17): an event target that says when its
// state changed.

/**
 * A core service. It keeps its state behind getters, changes it only in its
 * methods, and fires `change` after every change, so that the views showing
 * it render again (`StiloController`). Moments that are not a change of state
 * (a document opened, saved) are events of their own.
 */
export class Service extends EventTarget {
    /**
     * Listen to an event of the service. Returns the function that stops
     * listening.
     * @param {string} name
     * @param {(detail: any, event: CustomEvent) => void} listener
     * @returns {() => void}
     */
    on(name, listener) {
        const handler = (event) => listener(event.detail, event);
        this.addEventListener(name, handler);
        return () => this.removeEventListener(name, handler);
    }

    /** Fire the event `name` with `detail`. */
    emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail }));
    }

    /** Say that the state changed. */
    changed() {
        this.emit("change");
    }
}
