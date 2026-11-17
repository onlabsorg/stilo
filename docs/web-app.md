# The web app

*`web/`: the user interface around the editor. Lit 3 web components in
plain JavaScript, bundled by Vite. The editor itself, `web/src/editor/`, has
its own page: [The editor](editor.md).*

## Modules

| Module                         | Role                                                 |
|--------------------------------|------------------------------------------------------|
| `src/main.js`                  | Entry point: loads the theme CSS, the editor and the app |
| `src/components/stilo-app.js`  | `StiloApp`, `<stilo-app>`: the shell. Layout, state, routing, commands, editor events |
| `src/components/top-bar.js`    | `<top-bar>`: the document's name, the status (`ui`), a button per panel (`panels`) |
| `src/components/nav-pane.js`   | `<nav-pane>`: the tree of folders and files, its menus and keys |
| `src/components/context-menu.js` | `<context-menu>`: a menu at a point of the window |
| `src/components/move-dialog.js` | `<move-dialog>`: Move to…, choosing a folder       |
| `src/components/commands-pane.js` | `<commands-pane>`: the command list, by group, foldable |
| `src/components/comments-pane.js` | `<comments-pane>`: the comments of each line (`comments`) |
| `src/components/errors-pane.js` | `<errors-pane>`: the errors of the document (`errors`) |
| `src/components/shared.js`     | Shared styles (`base`) and icons for the components |
| `src/core/`                    | The core services (S17), being built: `createStilo()`, `Service`, `StiloController`, `<stilo-provider>`; `commands`, `keys`, `menus`, `ui`, `panels`, `errors`, `comments` |
| `src/builtins/`                | Stilo's own contributions, registered through the services: `commands.js` (commands, keys, menus), `panels.js` (the right pane's panels); `index.js` (`activateBuiltins`) |
| `src/api.js`                   | The protocol client, `Transport`: the only module that talks to the server |
| `src/route.js`                 | Browser address ↔ `{root, doc}`                     |
| `src/theme.js`, `src/theme.css` | Light and dark theme, design tokens               |

## The core: `src/core/`

The app's state and behaviour are moving out of `StiloApp` into **core
services** ([S17](../DECISIONS.md)), which the panes only show. Until
that work is done, most state is still in `StiloApp` (below).

- `createStilo({transport?})` (`core/index.js`) builds the `stilo` object,
  the services of one app. So far: `transport` (a `Transport`, below),
  `commands`, `keys` and `menus` (see [Commands](#commands-keys-and-menus)),
  `ui` and `panels` (see [The window](#the-window-ui-and-panels)), `errors`
  (see [Errors](#errors-errors)), `comments` (see
  [Comments](#comments-comments)).
- Stilo's own contributions are in `src/builtins/`, as `activate(stilo)`
  functions that register them through the services, as an extension
  would; `<stilo-app>` runs them once on its `stilo` object
  (`activateBuiltins`). Until the state has moved, the commands reach the
  app through `stilo._app`, a temporary bridge.
- `Service` (`core/service.js`) is their base: an `EventTarget` with
  `on(name, listener)`, which returns a function that stops listening,
  `emit(name, detail)`, and `changed()`, which fires `change` after every
  change of state.
- `<stilo-app>` creates the `stilo` object (or takes one set as its `stilo`
  property before it connects) and provides it by Lit context
  (`@lit/context`, `stiloContext` in `core/context.js`). An element inside,
  at any depth and through shadow roots, gets it with a `StiloController`:

  ```js
  this._stilo = new StiloController(this, (stilo) => [stilo.errors]);
  // this._stilo.stilo is the object; a change of stilo.errors renders again
  ```

- `<stilo-provider .stilo=${stilo}>` provides a `stilo` object to what is
  inside it, without the app: for tests and for front ends composed of
  Stilo's components.

## The window: `ui` and `panels`

**`ui`** holds what the window shows around the document, each with a
getter, and changes it in its methods:

| State     | Meaning                                   | Changed by |
|-----------|-------------------------------------------|------------|
| `status`  | The message in the top bar ("Saved", an error), or `""` | `notify(message)` |
| `navOpen` | Whether the navigation pane is open       | `setNavOpen(open)`, `toggleNav()` |
| `pane`    | The id of the panel open in the right pane, or `null` | `openPane(id)`, `togglePane(id)` |
| `source`  | The document's text shown read-only in place of the editor (Show source), or `null` | `setSource(text)` |

`confirm(message)` asks the user and resolves to the answer (the browser's
dialog for now; asynchronous, so a dialog of Stilo's own can replace it).

**`panels`** holds the panels of the right pane:

```js
stilo.panels.register({
    id: "comments",                      // an extension's: "<extension-id>.<name>"
    label: "Comments",                   // the button's name
    icon: commentsIcon,                  // a Lit template (SVG)
    order: 20,                           // buttons left to right
    render: (stilo) => html`<comments-pane></comments-pane>`,
});                                      // returns dispose(); a taken id throws
stilo.panels.setBadge("errors", { text: "2", label: "2 errors", tone: "danger" });
```

`<top-bar>` shows a button per panel, with its badge, in `order`; a click
toggles it (`ui.togglePane`). `<stilo-app>` renders the open panel's
`render(stilo)` in the right pane. Stilo's panels are registered by
`builtins/panels.js`: errors (10), comments (20), commands (30); the
errors badge is their count, which `builtins/panels.js` sets whenever
it changes.

## Errors: `errors`

The `errors` service holds the errors of the open document's latest
rendering, the editor's `DocumentError`s ([API](component/api.md)):

| Member          | Is or does                                             |
|-----------------|--------------------------------------------------------|
| `list`          | The errors, as the editor gives them                   |
| `count`         | How many undefined values were returned, all together  |
| `current`       | The key of the error pointed out, or `null`            |
| `set(list)`     | Takes the errors of a new rendering (the editor's `errors-change`) |
| `clear()`       | Forgets them, when another document opens               |
| `show(key)`     | Points one out and opens the errors panel (the editor's `error-click`) |
| `goTo(place)`   | Fires `go-to` with `{line}` in the open document, or `{uri, line}` in another |

`<errors-pane>` shows `list`, highlights and scrolls to `current`, and calls
`goTo` on a click. The app handles `go-to` (it holds the open document, for
now): it selects that line, opening the other document first if needed.

## Comments: `comments`

The `comments` service holds the cell comments of the open document, read
from its text (`<!--[ ... ]-->` in each cell):

| Member          | Is or does                                             |
|-----------------|--------------------------------------------------------|
| `list`          | `[{line, comments}]`: every line (from 1) with the texts of its comments, maybe none |
| `line`          | The line pointed out, or `null`                        |
| `read(text)`    | Reads them again, on opening the document and on every change |
| `clear()`       | Forgets them, when another document opens              |
| `show(line)`    | Points out a line and opens the comments panel (the editor's `comments-click`) |
| `goTo(line)`    | Points out a line and fires `go-to` with `{line}`       |

`<comments-pane>` shows the lines that have comments, highlights and
scrolls to `line`, and calls `goTo` on a click. The app handles `go-to`:
it selects the line, back in the editor view, and focuses the editor.

## The shell: `StiloApp`

`<stilo-app>` lays out the window in a CSS grid (top bar; navigation,
main area, right pane) and **holds all the state**. The other components
receive what they show as properties and report what the user does with
events; they keep no state of their own beyond what is visible (a folded
group, a collapsed folder).

| State                    | Meaning                                         |
|--------------------------|-------------------------------------------------|
| `_root`, `_tree`         | The navigation root (a folder path) and its tree |
| `_showOther`             | Whether the tree shows other files, and folders holding only other files (default on, remembered per browser) |
| `_doc`, `_etag`, `_dirty` | The open document's path, its ETag from the last read or write, and whether it has unsaved changes |
| `_moving`                | The item being moved, with the whole tree, while `<move-dialog>` is open |

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
| `upload(node?)`        | Opens the browser's file dialog (several files allowed) and `uploadFile`s each into a folder chosen as for `newDocument`. A name that exists or cannot be used is skipped; the status lists what was not uploaded |
| `duplicate(node)`      | Copies a document next to it under a name asked for in the tree, opens the copy. Documents only |
| `rename(node)`         | Asks for the new name in the item's row, warns about links, `moveItem`. A document's name is asked without `.texl`; another file's with its extension, which cannot become `.texl` |
| `moveTo(node)`         | Opens `<move-dialog>`, which carries the warning about links; then `moveItem` |
| `deleteItem(node)`     | Confirms, then `deleteFile` or `deleteFolder`; closes the open document if it was deleted. For a folder the question counts the documents and other files that go with it |
| `copyLink(node)`       | Puts a file's link on the clipboard, relative to the open document (`relativeLink` in `route.js`) |
| `openAsRoot(node)`     | Makes the folder, or the document's folder, the navigation root |
| `refreshTree()`        | Reads the tree again; the old one stays until the new one is there |
| `toggleOtherFiles()`   | Shows or hides other files, and folders holding only other files |
| `toggleTheme()`        | Switches the light and dark theme                     |
| `toggleSource()`       | Shows the editor's value read-only in place of the editor (which stays, hidden), or goes back to it |
| `runCommand(id, node?)` | Runs a command of the `commands` service by its id, on a tree node if given |
| `runEditorCommand(name)` | Runs a command of the editor (`editor.runCommand(name)`) and focuses it |

### Events

| From            | Event                       | The app                                  |
|-----------------|-----------------------------|------------------------------------------|
| `<texl-editor>` | `change`                    | Sets `_dirty`, `comments.read`           |
| `<texl-editor>` | `comments-click`            | `comments.show`: the comments pane on that line |
| `<texl-editor>` | `errors-change`             | `errors.set` (the badge follows)         |
| `<texl-editor>` | `error-click`               | `errors.show`: the errors pane on that error |
| `<nav-pane>`    | `open-document`, `navigate` | Opens a document, changes the root       |
| `<nav-pane>`    | `tree-command`              | Runs a command on a tree node (`runCommand(id, node)`) |
| `<move-dialog>` | `choose`, `close`           | Moves the item to that folder, or closes the dialog; a name already there shows in the dialog |
| `comments` service | `go-to`                  | Selects that line in the editor (`select(line)`) and focuses it |
| `errors` service | `go-to`                    | Selects that line, opening another document first if the error was made there |
| main area       | click on a link             | Resolves the link from the open document's address. A `.texl` document on this server opens in the app; anything else over HTTP, another file or another site, opens in a new tab; other schemes (`mailto:`) stay with the browser |

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

## Commands, keys and menus

Three services (`src/core/`); Stilo's own entries are registered by
`src/builtins/commands.js`.

**`commands`** holds every command, by id:

```js
stilo.commands.register({
    id: "save",                         // unique; an extension's: "<extension-id>.<name>"
    label: "Save",
    group: "File",                      // its heading in the commands pane
    run: (stilo, { node }) => ...,      // node: the tree item, if called on one
    checked: (stilo) => ...,            // for an option: on or off, in menus
});                                     // returns dispose(); a taken id throws
stilo.commands.run("save", { node });
stilo.commands.list();                  // in the order added: the commands pane
```

**`keys`** binds shortcuts to commands:
`bind("Mod+S", "save", {when, show})`, which returns `dispose()`. `Mod` is
Ctrl, or ⌘ on macOS (`formatKeys` shows it). `when` says where it applies:

- `global`, the default: the app's `keydown` listener on the window runs
  it (`match(e, "global")`), unless something inside, such as the editor,
  already handled the key (`defaultPrevented`).
- `tree`: when an item of the navigation pane has the focus (F2 and
  Delete, since Delete also deletes cells in the editor).
- `editor`: the editor's own keys. The editor handles them itself, before
  anyone else; they are bound only to be listed.

A letter with Alt matches by its place on the keyboard (`e.code`), since
Alt changes the character on macOS. Modifiers must match exactly. For the
same keys and place the last binding wins, with a warning in the console;
disposing it brings back the one before. `keysFor(id)` is the shortcut
shown for a command; `show: false` keeps a binding out of the lists (⌫ as
Delete on macOS).

**`menus`** says what each menu offers: `add(menu, commandId, {group,
order})`, returning `dispose()`; `items(menu)` gives the command ids with
`"-"` between groups. The navigation pane's menus are `tree/document`,
`tree/other`, `tree/folder` and `tree/pane`.

Stilo's own commands:

- **Editor commands** have the id of an editor command
  (`docs/component/api.md`, Commands). Running one calls
  `app.runEditorCommand(id)`, which calls the editor's `runCommand`.
- Commands without `run` (Mod+E and Shift+F2 inside a cell's text
  editor) are listed for reference: they belong to the cell.
- **Navigation pane commands** (ids `tree-*`) act on a tree node. From a
  menu or a key of `<nav-pane>` the node comes with the `tree-command`
  event. From the commands pane they act on the app's `treeTarget`: the
  item last focused or right-clicked in the tree, or else the open
  document. `<nav-pane>` still handles F2 and Delete itself, and reads
  its menus from `builtins/commands.js`, until it reads the services.

**Other files.** The tree lists every file. Files that are not documents
(`isDocument`) are muted (`--text-faint`, their own icon), and so are
folders holding files but no document at any depth; an empty folder is not
muted, being a place for documents. Another file's row is a link to its
public URL with `target="_blank"` and `rel="noopener"`, so a click or
Enter opens it in a new tab, where the server sandboxes what could run
scripts. With `showOther` off (Show other files, in the pane's menu)
`<nav-pane>` leaves the muted items out.

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

`formatKeys(keys)` (`core/keys.js`) turns `Mod+S` into the platform's
notation.

## The protocol client: `api.js`

`Transport` is the protocol client; the app's one is `stilo.transport`. Its
`origin` is the server's, the page's by default. Every request goes through
its `fetch(url, init)`, which throws an `ApiError` for a failed one; its
methods:

| Method                     | Protocol                 | Returns            |
|----------------------------|--------------------------|--------------------|
| `readFile(path)`           | GET a file               | `{text, etag}`     |
| `createFile(path, text)`   | CREATE                   | the ETag           |
| `uploadFile(path, file)`   | CREATE, with the bytes of a `File` | —        |
| `updateFile(path, text, etag)` | UPDATE with `If-Match` | the new ETag     |
| `readTree(path, depth?)`   | QUERY the tree           | the tree           |
| `createFolder(path)`       | CREATE a folder          | —                  |
| `moveItem(path, to)`       | MOVE                     | —                  |
| `deleteFile(path)`         | DELETE a file            | —                  |
| `deleteFolder(path)`       | DELETE a folder          | `{deleted}`        |
| `documentUrl(path)`        | —                        | the public address |
| `documentPath(url)`        | —                        | the path of a public address on this server, or `null` |
| `contentUrl(path)`, `treeUrl(path)` | —               | a file's or a folder's address in the API |

`ApiError`'s `status` is the HTTP status, and its message the server's
`error`. Paths are relative to the server root, without a leading `/`.
`isDocument(path)`, whether a path ends in `.texl`, is a plain function of
the module. So are `documentUrl` and `documentPath` for the page's own
server, kept only until the panes read the transport from the services.

## Theme: `theme.css` and `theme.js`

`theme.css` defines the design tokens as CSS custom properties (colors,
fonts, sizes), in a light and a dark variant, chosen by the `data-theme`
attribute of `<html>`. It also maps them onto the editor's `--texl-*`
properties. Components use colors only through these tokens, so both
themes always work. `main.js` imports the document font (Atkinson
Hyperlegible Next, from `@fontsource-variable/*`), which the build bundles
with the app, so Stilo needs no network for it.

`theme.js` switches the theme (`toggleTheme`) and remembers it in the
browser. The default is dark; `index.html` applies the saved theme before
the first paint.

The tab icon is `web/public/favicon.svg`, linked from `index.html`: the
OnLabs.org mark, two concentric circles, the outer one with a sharp corner
at the bottom left, in Stilo's blue with an orange centre. Vite copies `public/` into the build as it is,
so the server serves it at `/_app/favicon.svg`.

## Rules for the web app

- Declare a component's reactive properties in `static properties` and
  initialize them in the constructor, never as class fields: in plain
  JavaScript, class fields hide Lit's accessors.
- Components fire events (`bubbles: true, composed: true`); the app holds
  the state.
- The app talks to the server only through the transport (`api.js`,
  `stilo.transport`).
- Colors only through the tokens of `theme.css`; check both themes.
