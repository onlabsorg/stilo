# The web app

*`web/`: the user interface around the editor. Lit 3 web components in
plain JavaScript, bundled by Vite. The editor itself, `web/src/editor/`, has
its own page: [The editor](editor.md).*

## Modules

| Module                         | Role                                                 |
|--------------------------------|------------------------------------------------------|
| `src/main.js`                  | Entry point: loads the theme CSS, the editor and the app; exports `startStilo` and `API_VERSION` |
| `src/start.js`                 | `startStilo()`: starts the app with extensions ([below](#extensions-startstilo-and-extensions)) |
| `src/components/stilo-app.js`  | `StiloApp`, `<stilo-app>`: the shell. Creates and provides the services, the layout, link clicks |
| `src/components/top-bar.js`    | `<top-bar>`: the document's name, the status (`ui`), a button per panel (`panels`) |
| `src/components/nav-pane.js`   | `<nav-pane>`: the tree of folders and files (`tree`), its menus (`menus`) and keys (`keys`) |
| `src/components/context-menu.js` | `<context-menu>`: a menu at a point of the window |
| `src/components/move-dialog.js` | `<move-dialog>`: Move to…, choosing a folder       |
| `src/components/commands-pane.js` | `<commands-pane>`: the command list, by group, foldable |
| `src/components/comments-pane.js` | `<comments-pane>`: the comments of each line (`comments`) |
| `src/components/errors-pane.js` | `<errors-pane>`: the errors of the document (`errors`) |
| `src/components/shared.js`     | Shared styles (`base`) and icons for the components |
| `src/core/`                    | The core services (S17): `createStilo()`, `Service`, `StiloController`, `<stilo-provider>`; `commands`, `keys`, `menus`, `ui`, `panels`, `errors`, `comments`, `editor`, `document`, `router`, `tree` |
| `src/builtins/`                | Stilo's own contributions, registered through the services: `commands.js` (commands, keys, menus), `panels.js` (the right pane's panels), `go-to.js` (going to a place the errors or comments pane points to), `files.js` (the commands on files and folders); `index.js` (`activateBuiltins`) |
| `src/api.js`                   | The protocol client, `Transport`: the only module that talks to the server |
| `src/route.js`                 | Browser address ↔ `{root, doc}`                     |
| `src/theme.js`, `src/theme.css` | Light and dark theme, design tokens               |

## The core: `src/core/`

The app's state and behaviour live in **core services**
([S17](../DECISIONS.md)); the components only show them and call them.
Stilo's own commands and panels are registered through the services, as
an extension's will be, so the services are complete: nothing of Stilo
goes around them. Extensions reach them through `startStilo` and the
`extensions` service ([below](#extensions-startstilo-and-extensions)); the
extension API is being built (phase 3), so the hooks open to extensions are
still few.

- `createStilo({transport?})` (`core/index.js`) builds the `stilo` object,
  the services of one app: `transport` (a `Transport`, below),
  `commands`, `keys` and `menus` (see [Commands](#commands-keys-and-menus)),
  `ui` and `panels` (see [The window](#the-window-ui-and-panels)), `errors`
  (see [Errors](#errors-errors)), `comments` (see
  [Comments](#comments-comments)), `editor`, `document` and `router` (see
  [The document](#the-document-editor-document-and-router)), `tree` (see
  [The tree](#the-tree-tree)), `extensions` (see
  [Extensions](#extensions-startstilo-and-extensions)), and `apiVersion`.
  Some listen
  to others (the errors to the editor, for instance), so `createStilo`
  makes them in order.
- Stilo's own contributions are in `src/builtins/`, as `activate(stilo)`
  functions that register them through the services, as an extension
  would; `<stilo-app>` runs them once on its `stilo` object
  (`activateBuiltins`).
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

## Extensions: `startStilo` and `extensions`

An **extension** is a plain object (S17):

```js
export default {
    id: "word-count",          // lowercase letters, digits, dashes
    apiVersion: "1.0",         // the API version it was written for
    activate(stilo) {          // may be async
        stilo.commands.register({ id: "word-count.count", label: "Count words", group: "Document", run: () => {} });
    },
    deactivate() {},           // optional: what dispose() does not undo
};
```

`startStilo({target, extensions, transport})` (`src/start.js`, exported by
the package) creates the services (`createStilo`), activates Stilo's own
contributions, then the extensions in order, and appends a `<stilo-app>`
to `target` (`document.body` by default); it resolves to the app. Stilo's
own `index.html` calls `startStilo()`.

The **`extensions`** service (`core/extensions.js`) does the work:

| Member             | Is or does                                          |
|--------------------|-----------------------------------------------------|
| `activate(ext)`    | Checks and activates an extension; resolves to whether it was |
| `deactivate(id)`   | Its `deactivate()`, then undoes every registration it made |
| `list()`, `get(id)` | The active extensions (Stilo's own contributions are not listed) |
| `failures`         | `{id, reason}` of each extension not activated     |

An extension is skipped, reported in the console and the status, with
whatever it registered undone, when it has no `activate`, its id is not
valid or taken, its `apiVersion` does not match (`API_VERSION`, now
`"1.0"`: the same major version, a minor version up to this one), or its
`activate` throws.

`activate` gets a **scoped `stilo`**: the same services, through a proxy
that records each registration (the table `REGISTRATIONS`: `commands.register`,
`keys.bind`, `menus.add`, `panels.register`, and every service's `on`),
so `deactivate(id)` undoes all of them, the latest first; a `dispose()`
the extension calls itself is not undone twice. The ids of its commands
and panels must start with `<id>.`; another is refused (and an `activate`
that does it fails). The object also holds what an element needs, so an
extension imports nothing from Stilo: `html`, `css`, `svg`, `LitElement`,
`styles.base` (the shared styles of `components/shared.js`) and
`apiVersion`.

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
`settled()` resolves when the window shows the latest state, e.g. the
navigation pane after `setNavOpen(true)` or the editor after
`setSource(null)`; the app that renders the window sets how
(`setSettle`).

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
`goTo` on a click. `builtins/go-to.js` handles `go-to`: it selects that
line, opening the other document first if needed.

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
scrolls to `line`, and calls `goTo` on a click. `builtins/go-to.js`
handles `go-to`: it selects the line, back in the editor view, and
focuses the editor.

## The document: `editor`, `document` and `router`

**`editor`** stands for the open document's `<texl-editor>`. A new one is
made for every document (Lit's `keyed` in `<stilo-app>`), so value, undo
history and selection start fresh; after every rendering the app
attaches the current one (`attach(element)`). The service passes on
the editor's events as its own: `edit` (the editor's `change`),
`comments-click`, `errors-change`, `error-click`, `selection-change`.

| Member             | Is or does                                          |
|--------------------|-----------------------------------------------------|
| `element`, `value`, `editing` | The element (or `null`), its text, whether a cell is being edited |
| `whenReady()`      | The editor once attached; `null` if another document comes first |
| `settled()`        | The editor once the window shows the latest state (`ui.settled`) |
| `reveal(line)`     | Back in the editor view, selects the line and focuses it |
| `runCommand(name)` | Back in the editor view, runs an editor command (`docs/component/api.md`) |
| `reset()`          | Lets go of the editor: a new document is coming      |

**`document`** is the open document: `path`, `error` (why it could not be
read), `dirty` (unsaved changes), `unsaved` (the same, or a cell being
edited). An edit makes it dirty and clears the status.

| Method       | Does                                                       |
|--------------|------------------------------------------------------------|
| `load(path)` | Resets the status, comments, errors and source view, reads the file, waits for the new editor and gives it the text; fires `open` (`{path, text}`). Used by the router |
| `save()`     | Commits the cell being edited, then `updateFile` with the editor's value and the ETag of the last read or write; a cell that refuses its edit stops the save, a `412` shows "changed on the server, reload it". Fires `save` (`{path}`) |
| `reload()`   | Reads the document again, after confirming if dirty         |
| `discard()`  | Forgets the unsaved changes (the document is going away)    |

**`router`** follows the browser's address ([Routing](#routing-routejs)):
`root` is the navigation root. `go(route)` adds a history entry, after
confirming if the document is dirty and another one would open;
`replace(route)` changes the current entry without asking (after a move or
a delete, when the old address is gone); `start()`, called by the app when
it connects, applies the address and follows the back and forward buttons.
A route whose document is not the open one opens it (`document.load`).

## The shell: `StiloApp`

`<stilo-app>` holds no state of its own. It creates the services (or takes
a `stilo` object set as its property before it connects), provides them by
context, activates Stilo's own contributions on them (`activateBuiltins`),
and tells `ui` how to wait for its rendering (`ui.setSettle`). It lays out
the window in a CSS grid (top bar; navigation, main area, right pane) and
renders:

- the editor of the open document (its `url` is the document's public
  address, so relative imports resolve from the document's folder),
  attached to the `editor` service after every rendering, or the source
  view, whose close button runs Show source again;
- the open panel (`panels`, `ui.pane`) in the right pane;
- `<move-dialog>` while `tree.moving` is set: its `choose` event goes to
  `tree.chooseMove`, `close` to `tree.endMove`.

It also listens on the window: shortcuts bound `when: "global"` run their
commands (not while the Move to… dialog is open), and a page with unsaved
changes asks before it is left. A click on a link in the main area
resolves the link from the open document's address: a `.texl` document on
this server opens in the app (`router.go`); anything else over HTTP,
another file or another site, opens in a new tab; other schemes (`mailto:`)
stay with the browser. `runCommand(id, node?)` runs a command, on a tree
node if given.

## The tree: `tree`

The `tree` service holds what the navigation pane shows:

| Member              | Is or does                                          |
|---------------------|-----------------------------------------------------|
| `root`, `tree`, `error` | The navigation root (`router.root`), its tree (a node of the protocol's QUERY, `null` while read), why it could not be read |
| `refresh()`         | Reads the tree again; the old one stays until the new one is there. A new root reads its tree by itself |
| `current`, `setCurrent(path)` | The item last focused or right-clicked in the pane; found again in a new tree |
| `target`            | What a tree command acts on without a node: `current`, or else the open document |
| `folderFor(node?)`  | Where a new item goes: `node` if a folder, the folder of `node` if a file; without `node` likewise from `current`, else the root |
| `showInTree(path)`  | Reads the tree again, then makes `path` the current item |
| `showOther`, `setShowOther(on)`, `toggleShowOther()` | Whether other files show (default on); the toggle remembers it in the browser |
| `askName(request)`  | Asks for a name in the pane, opened if needed (above) |
| `moving`, `startMove`, `chooseMove`, `failMove`, `endMove` | The Move to… dialog: the item and the whole tree, a folder chosen, a failure shown in the dialog, closing it |

`checkName(typed, folder, type)` checks a name typed for a document, another
file or a folder against the protocol's rules for paths; `findNode`,
`parentFolder` and `baseName` help with tree nodes and paths.

The commands on files and folders are in `builtins/files.js`, one function
each, taking the services and a node: `newDocument`, `duplicate`,
`newFolder`, `upload` (the browser's file dialog; a name that exists or
cannot be used is skipped, and the status lists it), `rename` (the name is
asked in the item's row; a document's without `.texl`, another file's with
its extension, which cannot become `.texl`), `moveTo` (the dialog carries
the warning about links), `deleteItem` (closes the open document if it was
deleted; for a folder the question counts the documents and other files
that go with it), `copyLink` (relative to the open document, `relativeLink`
in `route.js`) and `openAsRoot`.

## Routing: `route.js`

The browser address decides what the app shows, so every view can be
bookmarked and the back button works (the `router` service):

```text
/                            root = the server root, no document open
/projects/beam/check.texl    root = the server root, check.texl open
/projects/beam/check.texl?root=projects
                             root = projects, check.texl open
```

`readRoute(url)` returns `{root, doc}` for an address; `routeUrl({root,
doc})` builds the address. `router.go` pushes a history entry when it
opens a document, and the router applies the route again on `popstate`.

The editor's events go to the services directly: an edit makes the
document dirty and the comments are read again; `errors-change` and
`error-click` go to `errors`, `comments-click` to `comments`.

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
  `editor.runCommand(id)`, back in the editor view.
- Commands without `run` (Mod+E and Shift+F2 inside a cell's text
  editor) are listed for reference: they belong to the cell.
- **Navigation pane commands** (ids `tree-*`, and New document) act on a
  tree node, the functions of `builtins/files.js`. From a menu or a key of
  `<nav-pane>` the node is the item's (`commands.run(id, {node})`). From
  the commands pane they act on `tree.target`: the item last focused or
  right-clicked in the tree, or else the open document. Their keys, F2 and
  Delete (⌫ too on macOS), are bound `when: "tree"`: `<nav-pane>` runs
  them only when one of its items has the focus, since Delete also
  deletes cells in the editor.

**Other files.** The tree lists every file. Files that are not documents
(`isDocument`) are muted (`--text-faint`, their own icon), and so are
folders holding files but no document at any depth; an empty folder is not
muted, being a place for documents. Another file's row is a link to its
public URL with `target="_blank"` and `rel="noopener"`, so a click or
Enter opens it in a new tab, where the server sandboxes what could run
scripts. With `showOther` off (Show other files, in the pane's menu)
`<nav-pane>` leaves the muted items out.

`<nav-pane>` is the `tree` service's view for names: `tree.askName(request)`
opens the pane if needed and calls the pane's `askName({folder, replaces,
value, label, icon, submit})`, which opens a row in the folder, or in place of
the item at `replaces`, and resolves to whether it was done. `submit(name)` does the work; it returns a
message if the name cannot be used, and the row stays and shows it, or `false` to
give up. Enter submits; Escape, leaving the row or an empty name give up.

**Moving what is open.** Before a rename or a move of an item holding the open
document, `files.js` offers to save unsaved changes (`saveFirst`); declining
stops the command. Afterwards it follows the item with the open document and the
navigation root (`afterMove`, with `router.replace`), replacing the history entry, since the old address is gone. The
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
the module.

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
- State and behaviour go in a service (`src/core/`); a component is a
  view: it reads the services through a `StiloController`, renders again
  when they change, and calls them. It keeps only what is its own to show
  (a folded group, an open menu, the row asking for a name).
- Stilo's own commands, keys, menus and panels are registered through the
  services (`src/builtins/`), never wired around them: what Stilo needs,
  an extension will be able to use too.
- The app talks to the server only through the transport (`api.js`,
  `stilo.transport`).
- Colors only through the tokens of `theme.css`; check both themes.
