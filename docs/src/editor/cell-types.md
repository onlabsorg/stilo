# Cell types

Every line has a **type**, which decides how it is edited and shown. The
icon in the left margin, before the line number, shows it.

| Type     | Shows                                                         |
|----------|---------------------------------------------------------------|
| Markdown | Formatted text: headings, lists, tables ([Writing text](writing.md)). New lines are Markdown. |
| Text     | The text without Markdown formatting: `**bold**` stays as it is written. HTML tags, as `<b>bold</b>`, still work. |

Formulas work in both types.

## Change the type

1. Click the icon in the left margin, or select the line and press
   **Ctrl+/**. A small menu of the types opens, with the current one
   checked.
2. Pick a type with the mouse, or with **↑**, **↓** and **Enter**. You can
   also press the first letter of a type.

With several lines selected, all of them change. **Escape** closes the menu
without a change.

The text of the line stays the same: only the way it is shown changes. So
changing the type loses nothing, and **Ctrl+Z** undoes it. Try it: write
`**bold**` on a line, make it Text, and the stars stay; make it Markdown
again, and the word turns bold.

## Unknown types

A document written with a newer Stilo, or another program, may use a type
that your editor does not know. Such a line is edited and shown as Text,
and keeps its type when you save.

More types are coming soon, tables first.
