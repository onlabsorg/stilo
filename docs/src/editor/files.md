# Files and folders

## Save

**Ctrl+S** saves the document to its file. A dot (•) after the name in the
top bar means that there are unsaved changes; after saving, the top bar
says *Saved*.

A line that you are still editing is saved only after you leave it with
**Ctrl+Enter**.

If the file changed on disk since you opened it (another window, or another
program, saved it), Stilo does not overwrite it: the top bar says *Not
saved: changed on the server, reload it*. Copy your changes, run **Reload
document** from the commands pane, and apply them again.

Before you open another document or close the page with unsaved changes,
the browser asks you to confirm.

## The navigation pane

- Click a document to open it. Documents are listed without the `.texl`
  extension.
- Click a folder to fold or unfold it. Double-click it to show only that
  folder; the arrow at the top of the pane goes back up.
- **Ctrl+B** hides or shows the pane.

Each document has its own address in the browser, so you can bookmark it,
and the browser's back button goes to the document you had open before.

## New documents

**New document…** (**Alt+N**) asks for a name and creates the document in
the folder shown at the top of the navigation pane. The name gets `.texl`
if it does not have it. Stilo does not overwrite an existing document.

## Commands

**F1**, or the commands button in the top bar, opens the list of all the
commands, grouped and with their shortcuts. Click a command to run it;
click a group's name to fold it.

**Alt+T** switches between the dark and the light theme. The browser
remembers your choice.

## The file

Every document is a plain text file, which any text editor can open. Each
line of the sheet starts with a marker, as `<!--{ bek4 : markdown }-->`,
with its name and its type. [The document format](../file-format.md)
describes it.
