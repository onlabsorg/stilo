# Lines and cells

A document is a stack of **cells**, one per line, like the rows of a
spreadsheet. A cell can hold one sentence or a whole page: its line grows to
fit it. The number in the left margin is the line number; people talk about
"line 3".

## Edit a line

1. Select a line and press **Enter** (or double-click it, or press **F2**).
2. Change a word.
3. Press **Ctrl+Enter** to keep your change, or **Escape** to throw it away.

While you edit, **Enter** starts a new line of text inside the same cell.

## Write on an empty line

The numbered lines below the document are empty. Select one, press
**Enter**, write something and press **Ctrl+Enter**: it becomes part of the
document, on that line. The empty lines above it become part of the
document too, so your text stays where you wrote it.

## Insert, move, delete

| Keys                       | What they do                        |
|----------------------------|-------------------------------------|
| Alt+Enter                  | Insert an empty line below          |
| Alt+Shift+Enter            | Insert an empty line above          |
| Alt+↑, Alt+↓               | Move the selected lines             |
| Delete, Backspace          | Delete the selected lines           |
| Shift+↑, Shift+↓, Shift+click | Select several lines             |
| Ctrl+C, Ctrl+X, Ctrl+V     | Copy, cut and paste lines           |
| Ctrl+Z, Ctrl+Shift+Z       | Undo and redo                       |

Try it: select a line, move it up with **Alt+↑**, then press **Ctrl+Z** to
put it back.

- With several lines selected, the commands work on all of them.
- Pasted lines replace the selected ones, as in a spreadsheet. Copied lines
  keep their type, and their comments.
- Ctrl+Z undoes changes to the lines: edits, inserts, deletes, moves,
  pastes and type changes. While you edit a line, Ctrl+Z undoes your typing
  in it.

## Line numbers move

Line numbers are positions, as in a spreadsheet: when you insert a line,
the numbers of the lines below it change. Each cell also has a name in the
file, which never changes, but the editor does not show it (see
[The document format](../file-format.md)).
