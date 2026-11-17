// The `cells` service: cell types, through the editor's registry, with
// their command in the app (S17).

import { Service } from "./service.js";
import { registerCell, cellTypes, editorCommands } from "../editor/index.js";

/**
 * Registers cell types for the editor (`registerCell`) and adds their
 * "Make it …" command (`make-<type>`) to the app's commands, with its key,
 * as Stilo's own types have. Disposing the registration removes the
 * command; the type stays known to the editor, since a custom element
 * cannot be undefined, so documents that use it still show.
 */
export class Cells extends Service {
    constructor(stilo) {
        super();
        this._stilo = stilo;
    }

    /** The registered cell types. */
    types() {
        return cellTypes();
    }

    /**
     * Register a cell type: a subclass of `TexlCell` with a static `type`
     * (docs/component/api.md). Returns the function that removes its command.
     * @param {typeof import("../editor/texl-cell.js").TexlCell} cellClass
     * @param {string} [tagName]
     * @returns {() => void}
     */
    register(cellClass, tagName) {
        registerCell(cellClass, tagName);
        const { commands, keys } = this._stilo;
        const id = `make-${cellClass.type}`;
        const disposers = [];
        if (!commands.get(id)) {
            const command = editorCommands().find((c) => c.name === id);
            disposers.push(
                commands.register({
                    id,
                    label: command.label,
                    group: command.group,
                    run: (stilo) => stilo.editor.runCommand(id),
                    enabled: (stilo) => stilo.document.readOnly ?? true,
                }),
            );
            if (command.keys) disposers.push(keys.bind(command.keys, id, { when: "editor" }));
        }
        this.changed();
        return () => {
            disposers.reverse().forEach((dispose) => dispose());
            this.changed();
        };
    }
}
