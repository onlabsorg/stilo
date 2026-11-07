# The web app

*`web/`: the user interface around the editor. Lit 3 web components in
plain JavaScript, bundled by Vite. The editor itself, `web/src/editor/`, has
its own page: [The editor](editor.md).*

## Modules

| Module                         | Role                                                 |
|--------------------------------|------------------------------------------------------|
| `src/main.js`                  | Entry point: loads the theme CSS, the editor and the app |
| `src/components/stilo-app.js`  | `StiloApp`, `<stilo-app>`: the shell. Layout, state, routing, commands, editor events |
| `src/components/top-bar.js`    | `<top-bar>`: the document's name, the status, the pane buttons |
| `src/components/nav-pane.js`   | `<nav-pane>`: the folder tree, its menus and keys   |
| `src/components/context-menu.js` | `<context-menu>`: a menu at a point of the window |
| `src/components/move-dialog.js` | `<move-dialog>`: Move to…, choosing a folder       |
| `src/components/commands-pane.js` | `<commands-pane>`: the command list, by group, foldable |
| `src/components/comments-pane.js` | `<comments-pane>`: the comments of each line     |
| `src/components/errors-pane.js` | `<errors-pane>`: the errors of the document       |
| `src/components/shared.js`     | Shared styles (`base`) and icons for the components |
| `src/commands.js`              | The command list, with shortcuts                    |
| `src/api.js`                   | The protocol client: the only module that talks to the server |
| `src/route.js`                 | Browser address ↔ `{root, doc}`                     |
| `src/theme.js`, `src/theme.css` | Light and dark theme, design tokens               |

## The shell: `StiloApp`

`<stilo-app>` lays out the window in a CSS grid (top bar; navigation,
main area, right pane) and **holds all the state**. The other components
receive what they show as properties and report what the user does with
events; they keep no state of their own beyond what is visible (a folded
group, a collapsed folder).

| State                    | Meaning                                         |
|--------------------------|-------------------------------------------------|
| `_root`, `_tree`         | The navigation root (a folder path) and its tree |
| `_showEmpty`             | Whether the tree shows folders without documents (default on, remembered per browser) |
| `_doc`, `_etag`, `_dirty` | The open document's path, its ETag from the last read or write, and whether it has unsaved changes |
| `_status`                | The message in the top bar ("Saved", an error)  |
| `_moving`                | The item being moved, with the whole tree, while `<move-dialog>` is open |
| `_navOpen`, `_pane`      | Whether the navigation pane is open; which right pane is open (`"commands"`, `"comments"`, `"errors"` or `null`) |
| `_comments`, `_commentLine` | The comments of every line, and the line shown in the comments pane |
| `_errors`, `_currentError` | The errors of the document, and the key of the one highlighted in the errors pane |
| `_source`                | The document's text shown read-only in place of the editor (Show source), or `null` |

The editor is created anew for every document (Lit's `keyed`), so value,
undo history and selection start fresh. Its `url` is the document's public
address (`documentUrl`), so relative imports resolve from the document's
folder.

### Methods

The commands call these public methods:

| Method                 | Does                                                  |
|------------------------|-------------------------------------------------------|
| `save()`               | Commits the cell being edited, then `updateFile` with the editor's value and the ETag; a cell that refuses its edit stops the save, a `412` shows "changed on the server, reload it" |
| `reload()`             | Reads the document again (after confirming, if dirty) |
| `newDocument(node?)`   | Asks for a name in the tree, `createFile`, opens it. The folder is `node`, or the folder of the document `node`; without `node`, likewise from the item last used in the tree, else the navigation root |
| `newFolder(node?)`     | Asks for a name in the tree, `createFolder`, in a folder chosen as for `newDocument`; makes it the current item |
| `duplicate(node)`      | Copies a document next to it under a name asked for in the tree, opens the copy. Documents only |
| `rename(node)`         | Asks for the new name in the item's row, warns about links, `moveItem` |
| `moveTo(node)`         | Opens `<move-dialog>`, which carries the warning about links; then `moveItem` |
| `deleteItem(node)`     | Confirms, then `deleteFile` or `deleteFolder`; closes the open document if it was deleted. The status says if a folder stayed because it holds other files |
| `copyLink(node)`       | Puts a document's link on the clipboard, relative to the open document (`relativeLink` in `route.js`) |
| `openAsRoot(node)`     | Makes the folder, or the document's folder, the navigation root |
| `refreshTree()`        | Reads the tree again; the old one stays until the new one is there |
| `toggleEmptyFolders()` | Shows or hides folders without documents              |
| `toggleNav()`, `togglePane(pane)`, `toggleTheme()` | The view commands |
| `toggleSource()`       | Shows the editor's value read-only in place of the editor (which stays, hidden), or goes back to it |
| `runCommand(id, node?)` | Runs a command of `commands.js` by its id, on a tree node if given |
| `runEditorCommand(name)` | Runs a command of the editor (`editor.runCommand(name)`) and focuses it |

### Events

| From            | Event                       | The app                                  |
|-----------------|-----------------------------|------------------------------------------|
| `<texl-editor>` | `change`                    | Sets `_dirty`, updates the comments      |
| `<texl-editor>` | `comments-click`            | Opens the comments pane on that line     |
| `<texl-editor>` | `errors-change`             | Updates the errors and the count in the top bar |
| `<texl-editor>` | `error-click`               | Opens the errors pane on that error      |
| `<nav-pane>`    | `open-document`, `navigate` | Opens a document, changes the root       |
| `<nav-pane>`    | `tree-command`              | Runs a command on a tree node (`runCommand(id, node)`) |
| `<move-dialog>` | `choose`, `close`           | Moves the item to that folder, or closes the dialog; a name already there shows in the dialog |
| `<top-bar>`     | `toggle-nav`, `toggle-pane` | Toggles a pane                           |
| right pane      | `run-command`, `close-pane` | Runs a command, closes the pane          |
| `<comments-pane>` | `comment-click`           | Selects that line in the editor (`select(line)`) and focuses it |
| `<errors-pane>` | `go-to`                     | Selects that line, opening another document first if the error was made there |
| main area       | click on a link             | Opens a link to a `.texl` document under the root in the app, resolved from the open document's address |

## Routing: `route.js`

The browser address decides what the app shows, so every view can be
bookmarked and the back button works:

```text
/                            root = the server root, no document open
/projects/beam/check.texl    root = the server root, check.texl open
/projects/beam/check.texl?root=projects
                             root = projects, check.texl open
```

`readRoute(url)` returns `{root, doc}` for an address; `routeUrl({root,
doc})` builds the address. The app pushes a history entry when it opens a
document (`_go`) and applies the route again on `popstate`.

## Commands: `commands.js`

`commands` is the list shown in the commands pane:

```js
{
    id: "save",
    label: "Save",
    keys: "Mod+S",            // shown as Ctrl+S, or ⌘S on macOS
    group: "File",
    match: (e) => ...,         // the app's shortcut, if it has one
    run: (app) => app.save(),
}
```

- **App commands** have `run` and `match`: the app's `keydown` listener
  finds them with `matchCommand(e)`.
- **Editor commands** have the id of an editor command
  (`docs/component/api.md`, Commands) and its key as shortcut. Clicking
  one runs `app.runEditorCommand(id)`, which calls the editor's
  `runCommand`; the editor handles the key itself.
- Commands without `run` (Mod+E and Shift+F2 inside a cell's text
  editor) are listed for reference: they belong to the cell.
- **Navigation pane commands** (ids `tree-*`) act on a tree node. From a
  menu or a key of `<nav-pane>` the node comes with the `tree-command`
  event. From the commands pane they act on the app's `treeTarget`: the
  item last focused or right-clicked in the tree, or else the open
  document. Their keys, F2 and Delete, have no `match`: `<nav-pane>`
  handles them, only when one of its items has the focus, because Delete
  also deletes cells in the editor. `treeMenus` lists which commands each
  menu shows (on a file, on a folder, on the pane).

`<nav-pane>` asks for names itself: `askName({folder, replaces, value, label,
icon, submit})` opens a row in the folder, or in place of the item at `replaces`,
and resolves to whether it was done. `submit(name)` does the work; it returns a
message if the name cannot be used, and the row stays and shows it, or `false` to
give up. Enter submits; Escape, leaving the row or an empty name give up.

**Moving what is open.** Before a rename or a move of an item holding the open
document, `_saveFirst` offers to save unsaved changes; declining stops the
command. Afterwards `_afterMove` follows the item with the open document and the
navigation root, replacing the history entry, since the old address is gone. The
document is read again in a new editor, so its undo history starts afresh.

`formatKeys(keys)` turns `Mod+S` into the platform's notation.

## The protocol client: `api.js`

| Function                   | Protocol                 | Returns            |
|----------------------------|--------------------------|--------------------|
| `readFile(path)`           | GET a file               | `{text, etag}`     |
| `createFile(path, text)`   | CREATE                   | the ETag           |
| `updateFile(path, text, etag)` | UPDATE with `If-Match` | the new ETag     |
| `readTree(path, depth?)`   | QUERY the tree           | the tree           |
| `createFolder(path)`       | CREATE a folder          | —                  |
| `moveItem(path, to)`       | MOVE                     | —                  |
| `deleteFile(path)`         | DELETE a document        | —                  |
| `deleteFolder(path)`       | DELETE a folder          | `{deleted, removed}` |
| `documentUrl(path)`        | —                        | the public address |
| `documentPath(url)`        | —                        | the path of a public address, or `null` |

Failed requests throw an `ApiError`, whose `status` is the HTTP status, and
whose message is the server's `error`. Paths are relative to the server
root, without a leading `/`.

## Theme: `theme.css` and `theme.js`

`theme.css` defines the design tokens as CSS custom properties (colors,
fonts, sizes), in a light and a dark variant, chosen by the `data-theme`
attribute of `<html>`. It also maps them onto the editor's `--texl-*`
properties. Components use colors only through these tokens, so both
themes always work. `main.js` imports the document fonts (Literata and
Source Sans 3, from `@fontsource-variable/*`), which the build bundles with
the app, so Stilo needs no network for them.

`theme.js` switches the theme (`toggleTheme`) and remembers it in the
browser. The default is dark; `index.html` applies the saved theme before
the first paint.

## Rules for the web app

- Declare a component's reactive properties in `static properties` and
  initialize them in the constructor, never as class fields: in plain
  JavaScript, class fields hide Lit's accessors.
- Components fire events (`bubbles: true, composed: true`); the app holds
  the state.
- The app talks to the server only through `api.js`.
- Colors only through the tokens of `theme.css`; check both themes.
