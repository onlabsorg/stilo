// The `info` service: what the server is and can do (protocol v1,
// `GET /_api/info`).

import { Service } from "./service.js";

/**
 * Read once when the app starts (`load`). Until then, and if it cannot be
 * read, the server counts as able to do everything, so nothing is greyed out
 * for nothing; a version 0 server (no `/_api/info`) has the capabilities of
 * version 0 (`Transport.info`).
 */
export class Info extends Service {
    constructor(stilo) {
        super();
        this._stilo = stilo;
        this._info = null;
        this._error = "";
    }

    /** The protocol version the server speaks, or `null` until read. */
    get protocol() {
        return this._info?.protocol ?? null;
    }

    /** The server's software, `{name, version}`, or `null`. */
    get server() {
        return this._info?.server ?? null;
    }

    /** What the server can do, or `null` until read. */
    get capabilities() {
        return this._info?.capabilities ?? null;
    }

    /** The server's extensions, `[{id}]`, with endpoints under `/_api/x/<id>/`. */
    get extensions() {
        return this._info?.extensions ?? [];
    }

    /** Why the info could not be read, or `""`. */
    get error() {
        return this._error;
    }

    /** Whether the server can do `capability` (`true` until the info is read). */
    has(capability) {
        return !this._info || this._info.capabilities.includes(capability);
    }

    /** Whether the server has the extension `id`. */
    hasExtension(id) {
        return this.extensions.some((extension) => extension.id === id);
    }

    /** Read the server's info. A transport without `info` counts as a server
     * that can do everything. */
    async load() {
        const { transport } = this._stilo;
        if (typeof transport.info !== "function") return;
        try {
            const info = await transport.info();
            this._info = { protocol: 0, server: null, extensions: [], ...info, capabilities: info?.capabilities ?? [] };
            this._error = "";
        } catch (error) {
            this._error = error.message;
        }
        this.changed();
    }
}
