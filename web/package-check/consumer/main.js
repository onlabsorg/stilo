// Every entry point of the package, as a consumer imports it.
import { startStilo, API_VERSION, createStilo, stiloContext, StiloController, StiloProvider } from "@onlabsorg/stilo-web";
import "@onlabsorg/stilo-web/theme.css";
import { TexlCell, registerCell, parseDocument, createEngine, editorCommands } from "@onlabsorg/stilo-web/editor";

class NoteCell extends TexlCell {
    static type = "note";
}
registerCell(NoteCell);

/** An extension that imports nothing from Stilo (docs/extensions.md). */
const hello = {
    id: "hello",
    apiVersion: API_VERSION,
    activate(stilo) {
        stilo.commands.register({ id: "hello.say", label: "Say hello", group: "Hello", run: () => stilo.ui.notify("Hello") });
        stilo.status.register({ id: "hello.status", render: () => stilo.html`Hello` });
    },
};

startStilo({ extensions: [hello] });

console.log(
    parseDocument("<!--{ note }-->\nHello").length,
    typeof createEngine,
    editorCommands().length,
    typeof createStilo,
    typeof stiloContext,
    typeof StiloController,
    typeof StiloProvider,
);
