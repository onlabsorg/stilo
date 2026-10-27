# The web editor

The web editor is where you write documents. `stilo serve` starts it on a
folder; open the address it prints in your browser.

This part of the manual teaches the editor, one topic per page. It is best
read with Stilo open beside it, so you can try each step:

1. Serve the sample documents, as in [Getting started](../getting-started.md):

    ```sh
    stilo serve ../examples
    ```

2. Open <http://127.0.0.1:8000/projects/beam/beam-check.texl>, or press
   **Alt+N** to create a practice document of your own.

On a Mac, use **⌘** where this manual says **Ctrl**, except for
**Ctrl+Space**, and **⌥** (Option) for **Alt**.

## The window

```text
┌──────────────────────────────────────────────────────────────────┐
│ ☰  Stilo          beam-check •         [Commands] [Comments]     │  top bar
├────────────┬────────────────────────────────────────┬────────────┤
│ /          │ 1 │ Beam check                         │ Commands   │
│ ▾ library  │ 2 │ Input                              │  File      │
│     steel  │   │ - Span: 6 m                        │   Save     │
│ ▾ projects │ 3 │ Design load                    2   │   …        │
│   ▾ beam   │ 4 │                                    │            │
│     beam-… │ 5 │                                    │            │
│            │                                        │            │
│ navigation │ the sheet                              │ right pane │
└────────────┴────────────────────────────────────────┴────────────┘
```

| Part            | What it shows                                              |
|-----------------|------------------------------------------------------------|
| Top bar         | The name of the open document, with a dot (•) while it has unsaved changes, and a message after saving. The buttons on the right open the commands and the comments. |
| Navigation pane | The documents of the folder. Click a document to open it. Double-click a folder to show only that folder; the arrow at the top goes back up. Ctrl+B shows or hides the pane. |
| The sheet       | The open document, as numbered lines on paper. Each line is a cell. The left margin shows the line number and the cell's type; the right margin shows how many comments a cell has. |
| Right pane      | Either the **commands**, with their shortcuts (F1), or the **comments** of a line (Alt+C). |

## Your first steps

1. Press **↓** to select the next line, and **↑** to go back. You can also
   click a line.
2. Press **Enter** on a line: you see the text it is written with.
3. Press **Escape** to leave the line without changes.

The next pages go further:

- [Lines and cells](lines.md): edit, insert, move and delete lines.
- [Writing text](writing.md): headings, lists, tables and links.
- [Formulas](formulas.md): values that compute themselves.
- [Cell types](cell-types.md): how a line is edited and shown.
- [Comments](comments.md): notes on a line.
- [Linking documents](linking.md): use the values of another document.
- [Files and folders](files.md): save, create, and find documents.
- [Keyboard shortcuts](keys.md): all of them, on one page.
