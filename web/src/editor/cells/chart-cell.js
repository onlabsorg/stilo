import { html } from "lit";
import { FormCell } from "./form-cell.js";
import { STILO_IMPORT, STILO_LIBRARY } from "./data-cell.js";

/**
 * A chart: one formula, `<% stilo.charts.line {x: ..., y: ..., x_label:
 * "...", y_label: "...", title: "..."} %>`, written one member per line,
 * and shown as the SVG image that the Stilo library draws
 * (`texl-lib/charts.texl`), across the width of the cell.
 *
 * In edit mode, a form (`FormCell`): the chart type, in a drop-down (only
 * Line for now), then its fields. The X and Y values are formulas that give
 * a list, typically a column of a data table: `loads.column "x (m)"`. The
 * axis labels and the title are plain text, and optional.
 *
 * The editor adds the import of the Stilo library at the top of the
 * document when a chart is first written (`requires`).
 */
export class ChartCell extends FormCell {
    static type = "chart";

    static label = "Chart";

    static key = "c";

    static icon = html`<svg viewBox="0 0 24 24">
        <path d="M4 4v16h16" />
        <path d="M7 15l4-5 3 3 5-6" />
    </svg>`;

    static needs = "a chart";

    static requires = { url: STILO_LIBRARY, source: STILO_IMPORT };

    static kindLabel = "Chart type";

    static forms = [
        {
            call: "stilo.charts.line",
            label: "Line",
            fields: [
                { key: "x", label: "X values", type: "expression", required: true, placeholder: 'A list, e.g. loads.column "x (m)"' },
                { key: "y", label: "Y values", type: "expression", required: true, placeholder: 'A list, e.g. loads.column "M (kNm)"' },
                { key: "x_label", label: "X axis label", type: "text", placeholder: "None" },
                { key: "y_label", label: "Y axis label", type: "text", placeholder: "None" },
                { key: "title", label: "Title", type: "text", placeholder: "None" },
            ],
        },
    ];
}
