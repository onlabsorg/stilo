// What the keys and the toolbar of a rich text cell do to its document.

import { baseKeymap, chainCommands, setBlockType, toggleMark, wrapIn, lift } from "prosemirror-commands";
import { undo, redo } from "prosemirror-history";
import { InputRule, inputRules, textblockTypeInputRule, undoInputRule, wrappingInputRule } from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import { NodeSelection } from "prosemirror-state";
import { liftListItem, sinkListItem, splitListItem, wrapInList } from "prosemirror-schema-list";
import { isOneEquation, schema } from "./schema.js";

const { nodes, marks } = schema;

/** Inserts a line break within the paragraph. */
function insertBreak(state, dispatch) {
    const { $from } = state.selection;
    if (!$from.parent.type.contentMatch.matchType(nodes.hard_break)) return false;
    dispatch?.(state.tr.replaceSelectionWith(nodes.hard_break.create()).scrollIntoView());
    return true;
}

/** Whether the selection has a mark, or a new text would get it. */
export function markActive(state, type) {
    const { from, to, empty, $from } = state.selection;
    if (empty) return Boolean(type.isInSet(state.storedMarks ?? $from.marks()));
    return state.doc.rangeHasMark(from, to, type);
}

/** The ancestor of the selection of a type, or null. */
function inNode(state, type) {
    const { $from } = state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).type === type) return $from.node(depth);
    }
    return null;
}

/** What a block looks like in the style menu: "paragraph", "h1", … or "code". */
export function blockStyle(state) {
    const { parent } = state.selection.$from;
    if (parent.type === nodes.heading) return `h${parent.attrs.level}`;
    return parent.type === nodes.code_block ? "code" : "paragraph";
}

/** The command that gives the blocks of the selection a style. */
export function setBlockStyle(style) {
    if (style === "code") return setBlockType(nodes.code_block);
    if (style === "paragraph") return setBlockType(nodes.paragraph);
    return setBlockType(nodes.heading, { level: Number(style.slice(1)) });
}

/** Puts the selection into a list of the type, or takes it out. */
export function toggleList(type) {
    return (state, dispatch, view) => {
        const list = inNode(state, nodes.list_item);
        if (list && inNode(state, type)) return liftListItem(nodes.list_item)(state, dispatch, view);
        return wrapInList(type)(state, dispatch, view);
    };
}

/** Puts the selection into a quote, or takes it out. */
export function toggleQuote(state, dispatch, view) {
    return inNode(state, nodes.blockquote) ? lift(state, dispatch, view) : wrapIn(nodes.blockquote)(state, dispatch, view);
}

export const inList = (state, type) => Boolean(inNode(state, type));

/** Tab in a list indents its item. Elsewhere it stays in the cell and does nothing. */
const indentItem = (state, dispatch, view) => {
    sinkListItem(nodes.list_item)(state, dispatch, view);
    return true;
};
const outdentItem = (state, dispatch, view) => {
    liftListItem(nodes.list_item)(state, dispatch, view);
    return true;
};

/** Keys that leave edit mode belong to the cell: ProseMirror would swallow them. */
const { "Mod-Enter": _commitKey, ...baseKeys } = baseKeymap;

/**
 * The keys and typing shortcuts of the document.
 * @param {object} cell
 * @param {() => boolean} cell.commit - Commits the edit (Mod+Enter).
 * @param {() => boolean} cell.discard - Discards the edit (Escape).
 * @param {() => boolean} cell.openSelected - Edits the formula or equation selected, if any.
 * @param {() => boolean} cell.editTag - Opens the formula field (Mod+E).
 * @param {() => boolean} cell.editLink - Opens the link field (Mod+K).
 * @param {() => boolean} cell.addComment - Opens the comment field (Shift+F2).
 * @param {() => boolean} cell.startTag - `<%` was typed: opens the formula field.
 */
export function richPlugins(cell) {
    const sub = toggleMark(marks.sub);
    const sup = toggleMark(marks.sup);
    return [
        inputRules({
            rules: [
                textblockTypeInputRule(/^(#{1,6})\s$/, nodes.heading, (match) => ({ level: match[1].length })),
                textblockTypeInputRule(/^```$/, nodes.code_block),
                wrappingInputRule(/^\s*>\s$/, nodes.blockquote),
                wrappingInputRule(/^\s*[-+*]\s$/, nodes.bullet_list),
                wrappingInputRule(/^(\d+)\.\s$/, nodes.ordered_list, (match) => ({ start: Number(match[1]) })),
                // As typed: a formula is opened, an equation closed
                new InputRule(/<%$/, (state, _match, start, end) => {
                    const tr = state.tr.delete(start, end);
                    queueMicrotask(cell.startTag);
                    return tr;
                }),
                new InputRule(/(?:^|[^\\$])\$([^$\s](?:[^$]*[^$\s])?)\$$/, (state, match, start, end) => {
                    if (!isOneEquation(match[1])) return null;
                    const from = end - match[1].length - 1;
                    return state.tr.replaceWith(from, end, nodes.math.create({ tex: match[1] }));
                }),
            ],
        }),
        keymap({
            Escape: cell.discard,
            "Mod-Enter": cell.commit,
            "Mod-z": undo,
            "Mod-y": redo,
            "Mod-Shift-z": redo,
            Backspace: undoInputRule,
            "Mod-b": toggleMark(marks.strong),
            "Mod-i": toggleMark(marks.em),
            "Mod-u": toggleMark(marks.underline),
            "Mod-=": sub,
            "Mod-Shift-=": sup,
            "Mod-+": sup,
            "Mod-k": cell.editLink,
            "Mod-e": cell.editTag,
            "Shift-F2": cell.addComment,
            "Mod-Alt-0": setBlockStyle("paragraph"),
            "Mod-Alt-1": setBlockStyle("h1"),
            "Mod-Alt-2": setBlockStyle("h2"),
            "Mod-Alt-3": setBlockStyle("h3"),
            "Shift-Enter": insertBreak,
            Tab: indentItem,
            "Shift-Tab": outdentItem,
            Enter: chainCommands(cell.openSelected, splitListItem(nodes.list_item)),
        }),
        keymap(baseKeys),
    ];
}

/** The node selected as a whole, or null. */
export function selectedNode(state) {
    return state.selection instanceof NodeSelection ? state.selection.node : null;
}
