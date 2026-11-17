// Every entry point of the package, as a consumer imports it.
import "@onlabsorg/stilo-web"; // the whole app: fonts, theme, <stilo-app>
import "@onlabsorg/stilo-web/theme.css";
import { TexlCell, registerCell, parseDocument, createEngine } from "@onlabsorg/stilo-web/editor";

class NoteCell extends TexlCell {
    static type = "note";
}
registerCell(NoteCell);

console.log(parseDocument("<!--{ note }-->\nHello").length, typeof createEngine);
