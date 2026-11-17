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
| `src/components/top-bar.js`    | `<top-bar>`: the document's name, the status (`ui`), the items of `topBar`, a button per panel (`panels`) |
| `src/components/nav-pane.js`   | `<nav-pane>`: the tree of folders and files (`tree`), its menus (`menus`) and keys (`keys`) |
| `src/components/context-menu.js` | `<context-menu>`: a menu at a point of the window |
| `src/components/move-dialog.js` | `<move-dialog>`: Move to…, choosing a folder       |
| `src/components/stilo-dialog.js` | `<stilo-dialog>`: a modal dialog (the `ui` service's `dialog`, `confirm`, `prompt`) |
| `src/components/commands-pane.js` | `<commands-pane>`: the command list, by group, foldable; the Extensions group |
| `src/components/comments-pane.js` | `<comments-pane>`: the comments of each line (`comments`) |
| `src/components/errors-pane.js` | `<errors-pane>`: the errors of the document (`errors`) |
| `src/components/shared.js`     | Shared styles (`base`) and icons for the components |
| `src/core/`                    | The core services (S17): `createStilo()`, `Service`, `StiloController`, `<stilo-provider>`; `commands`, `keys`, `menus`, `ui`, `panels`, `topBar`, `status` (`registry.js`), `errors`, `comments`, `editor`, `document`, `router`, `tree`, `extensions` |
| `src/builtins/`                | Stilo's own contributions, registered through the services: `commands.js` (commands, keys, menus), `panels.js` (the right pane's panels), `go-to.js` (going to a place the errors or comments pane points to), `files.js` (the commands on files and folders); `index.js` (`activateBuiltins`) |
| `src/api.js`                   | The protocol client, `Transport`: the only module that talks to the server |
| `src/builtins/server.js`       | What the server says, applied through the services: its read-only items (a `tree.readOnly` provider) and its asking for a login (a transport middleware) |
| `src/route.js`                 | Browser address ↔ `{root, doc}`                     |
| `src/theme.js`, `src/theme.css` | Light and dark theme, design tokens               |

## The core: `src/core/`

The app's state and behaviour live in **core services**
([S17](../DECISIONS.md)); the components only show them and call them.
Stilo's own commands and panels are registered through the services, as
an extension's will be, so the services are complete: nothing of Stilo
goes around them. Extensions reach them through `startStilo` and the
`extensions` service ([below](#extensions-startstilo-and-extensions));
[Extensions](extensions.md) is the guide and the reference of every
hook.

- `createStilo({transport?})` (`core/index.js`) builds the `stilo` object,
  the services of one app: `transport` (a `Transport`, below),
  `commands`, `keys` and `menus` (see [Commands](#commands-keys-and-menus)),
  `ui`, `panels`, `topBar` and `status` (see
  [The window](#the-window-ui-panels-topbar-and-status)), `errors`
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
`keys.bind`, `menus.add`, `register` and `replace` of `panels`, `topBar`
and `status`, `transport.use`, `decorate`, `filter` and `readOnly` of
`tree`, `editor.decorate`, `comments.addProvider`, the listeners of its
`settings`, `views.register` and `views.replace`, and every service's `on`), so
`deactivate(id)` undoes all
of them, the latest first; a `dispose()` the extension calls itself is not
undone twice. The ids of its commands, panels, views, comment providers and top-bar
and status items
must start with `<id>.`; another is refused (and an `activate` that does
it fails). `replace` may take the place of one of Stilo's own.

The commands pane ends with an **Extensions** group, listing the active
extensions and, in the danger colour with the reason as tooltip, those
not activated; it shows only while there is one, so nothing changes for
users of Stilo alone. The object also holds what an element needs, so an
extension imports nothing from Stilo: `html`, `css`, `svg`, `LitElement`,
`StiloController`, `TexlCell`, `styles.base` (the shared styles of
`components/shared.js`), `apiVersion`, and its own `settings`.

**`cells`** registers cell types (`register(CellClass)`, through the
editor's `registerCell`) with their "Make it …" command and key; disposing
removes the command, while the type stays known to the editor (a custom
element cannot be undefined). `types()` lists them.

## The window: `ui`, `panels`, `topBar` and `status`

**`ui`** holds what the window shows around the document, each with a
getter, and changes it in its methods:

| State     | Meaning                                   | Changed by |
|-----------|-------------------------------------------|------------|
| `status`, `level` | The message in the top bar ("Saved", an error), or `""`; how it reads, `info`, `warning` or `error` (coloured) | `notify(message, {level})` |
| `navOpen` | Whether the navigation pane is open       | `setNavOpen(open)`, `toggleNav()` |
| `pane`    | The id of the panel open in the right pane, or `null` | `openPane(id)`, `togglePane(id)` |
| `source`  | The document's text shown read-only in place of the editor (Show source), or `null` | `setSource(text)` |

**Dialogs.** `<stilo-app>` shows the dialogs of `ui` (it is their view,
`setDialogView`), modal, over the window, one at a time (the latest on
top, `currentDialog`); the window's shortcuts are off while one is open,
and closing it gives the focus back.

- `dialog(render)` shows `render(close)`, a Lit template, and resolves to
  the value given to `close(value)`; Escape closes it with `undefined`.
  Without a view for dialogs, it rejects.
- `confirm(message, {ok, cancel, danger})` asks a question with two
  buttons ("OK" and "Cancel" unless named; `danger` colours OK) and
  resolves to whether the user agreed; Enter agrees, Escape does not.
  Stilo's own: "Discard", "Delete" (danger), "Save", "Rename".
- `prompt(message, value, {ok, cancel})` asks for a text and resolves to
  it, or `null`.

Without a view for dialogs (a front end that shows none), `confirm` and
`prompt` use the browser's. The dialogs' forms take the styles of
`<stilo-dialog>`: `.message`, an input, `.buttons` with `button.primary`
(`.danger`) and `button.secondary`.
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

`panels`, `topBar` and `status` are **registries** (`Registry`,
`core/registry.js`): items by id, listed by `order`, then in the order
added. `register(item)` refuses a taken id; `replace(id, item)` puts
another item in the place of one (an extension's panel instead of
Stilo's comments panel, say). An id holds a stack: the latest shows,
and the `dispose()` of each registration or replacement takes it out,
bringing back the one before.

```js
stilo.topBar.register({ id: "login.user", order: 10, render: (stilo) => html`Ada` });
stilo.status.register({ id: "word-count.words", render: () => `${words} words` });
stilo.status.changed();                  // render the items again
```

**`topBar`** items show in the top bar, left of the panels' buttons.
**`status`** items show in the **status line** at the bottom of the
window, right-aligned, as in Word; the line shows only while it has
items, so without extensions the window is as before. An item's
`render(stilo)` is called again when its registry changes (`changed()`),
or it renders an element that follows the services itself.

## The server: `info`

The `info` service holds what the server is and can do (protocol v1),
read once when the app connects (`load`):

| Member | Is or does |
|--------|------------|
| `protocol` | The protocol version the server speaks (0 for a server without `/_api/info`), `null` until read |
| `server` | `{name, version}`, or `null` |
| `capabilities`, `has(name)` | What it can do (`files`, `tree`, `folders`, `move`, `upload`, `trash`, `home`); `has` is `true` until the info is read, or if it cannot be (`error`), so nothing is greyed out for nothing |
| `extensions`, `hasExtension(id)` | The server's extensions, with endpoints under `/_api/x/<id>/` |

Stilo's commands that need a capability are greyed out without it, with
the reason: New folder… and deleting a folder (`folders`), Upload files…
(`upload`), Rename and Move to… (`move`). The server's read-only items
(`readOnly` in the tree) are a read-only provider of the `tree` service
(`builtins/server.js`), so they get the lock, the disabled commands and
the read-only editor like any other. An item outside the navigation root
is not in the tree: the server still refuses it, with `403`.

## Settings: `settings`

`settings` keeps settings in the browser (`localStorage`), as JSON, by
namespace: `get(key, fallback)`, `set(key, value)`, `remove(key)`,
`keys()`; `change` (`{key, value}`) after a change, also one made in
another tab. The app's is the namespace `stilo`; an extension's
`stilo.settings` is its own, named by its id (`scope(id)`; stored as
`stilo.ext.<id>.<key>`), and its listeners stop when it is deactivated.
Where the browser keeps nothing, settings last as long as the page.
Settings stored in the folder are left for later (S17).

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
from its text (`<!--[ ... ]-->` in each cell), and the comments of
**providers**, from outside the document (an issue tracker, a review):

| Member          | Is or does                                             |
|-----------------|--------------------------------------------------------|
| `list`          | `[{line, comments, others}]`: every line (from 1) with the texts of its comments, maybe none, and the providers' comments on it (`{text, author?, date?, source, provider}`) |
| `line`          | The line pointed out, or `null`                        |
| `addProvider(provider)` | Adds a provider; returns `dispose()`. A taken id is refused |
| `refresh()`     | Asks the providers again for the open document's comments (also when it opens) |
| `read(text)`    | Reads them again, on opening the document and on every change, and places the providers' comments |
| `clear()`       | Forgets them, when another document opens              |
| `show(line)`    | Points out a line and opens the comments panel (the editor's `comments-click`) |
| `goTo(line)`    | Points out a line and fires `go-to` with `{line}`       |

A provider is `{id, label, comments(path)}`: `comments` returns, or
resolves to, the comments of the document at `path`,
`[{cell, text, author?, date?}]`, each anchored to a cell **by its name**
(compared without case), the only stable anchor in a document: they
follow their cell when it moves, and a comment whose cell is not there is
left out. They are read-only. A provider that fails is reported in the
console and left out; answers for a document no longer open are ignored.
The service gives the editor their texts by cell name (`extraComments`),
so the margin counts them with the file's own.

`<comments-pane>` shows the lines that have comments, highlights and
scrolls to `line`, and calls `goTo` on a click; under the file's comments
of a line come the providers', each with its source, author and date.
`builtins/go-to.js` handles `go-to`: it selects the line, back in the
editor view, and focuses the editor.

## The document: `editor`, `document` and `router`

**`editor`** stands for the open document's `<texl-editor>`. A new one is
made for every document (Lit's `keyed` in `<stilo-app>`), so value, undo
history and selection start fresh; after every rendering the app
attaches the current one (`attach(element)`). The service passes on
the editor's events as its own: `edit` (the editor's `change`),
`comments-click`, `errors-change`, `error-click`, `selection-change`,
`mark-click`.

**Marks.** `decorate(provider)` adds a mark provider (a checker, say) and
returns `dispose()`: `provider({path, value, cells})` returns the marks of
the open document, `[{cell, text, tone?, title?}]`, each on a cell by its
name, shown in the cell's right margin in the colours of errors and
comments (`tone`: `accent`, `warning`, `danger`), `title` as hover text.
`cells` are the cells as the file format reads them, with their `line`.
The service asks the providers when a document opens, after every edit,
and on `invalidate()`, and gives the editor the result (`marks`). A click
on a mark fires `mark-click` (`{line, cell, mark}`). A provider that
throws is reported in the console and left out.

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
edited), `readOnly` (why it cannot be changed, from the `tree` service's
read-only providers, or `null`). An edit makes it dirty and clears the
status. A read-only document opens in the editor's read-only mode
(`<stilo-app>` sets `readonly`), the top bar shows "Read-only" with the
reason as hover text, and `save` refuses it.

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
`view` and `params` are the view shown in place of a document, if any
(below); `route` is the route shown now, `{root, doc, view, params}`.

**`views`** holds the pages that are not a document (S17): a dashboard, a
comparison of two versions, a settings page. It is a registry, like
`panels`:

```js
stilo.views.register({
    id: "dash.board",                     // an extension's: "<extension-id>.<name>"
    label: "Dashboard",                   // shown in the top bar while it is open
    render: (stilo, params) => html`…`,   // shown in place of the editor
});                                       // returns dispose()
stilo.views.open("dash.board", { folder: "projects" }); // router.go, a history entry
```

A view has an address, `/?view=<id>`, with the navigation root and its
parameters in the query string ([Routing](#routing-routejs)), so it can
be bookmarked and the back button works; never a path, since every path
is a file's public URL. Opening one closes the document, after asking if
it has unsaved changes. `<stilo-app>` renders the view in the main area,
on a sheet like the editor's; an address naming a view that is not
registered (its extension is not installed) shows "This page is not
available". A link in a view or a document to `?view=` on this server
opens the view in the app.

## The shell: `StiloApp`

`<stilo-app>` holds no state of its own. It creates the services (or takes
a `stilo` object set as its property before it connects), provides them by
context, activates Stilo's own contributions on them (`activateBuiltins`),
and tells `ui` how to wait for its rendering (`ui.setSettle`). It lays out
the window in a CSS grid (top bar; navigation, main area, right pane;
status line) and
renders:

- the view of the address, if any (`router.view`, `views`), or else
- the editor of the open document (its `url` is the document's public
  address, so relative imports resolve from the document's folder),
  attached to the `editor` service after every rendering, or the source
  view, whose close button runs Show source again;
- the open panel (`panels`, `ui.pane`) in the right pane;
- the status line (`status`), only while it has items;
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

**Providers.** Extensions (and Stilo) add to the tree through providers,
each added by a method that returns `dispose()`; `invalidate()` says that
what they return has changed, so the views ask again. A provider that
throws counts as saying nothing.

| Method | The provider | Read with |
|--------|--------------|-----------|
| `decorate(provider)` | `(node) => {badge?, tooltip?, tone?, muted?}` or nothing: a short text after the name, a line of hover text, the badge's colour (`accent`, `warning`, `danger`), the item muted | `decoration(node)`: `{badges, tooltip, muted}` of all of them, or `null` |
| `filter(provider)` | `(node) => false` leaves the node, and what is in it, out of the pane | `shows(node)` |
| `readOnly(provider)` | `(path) =>` why the item cannot be changed (a text, or `true`), or nothing | `readOnlyReason(path)`: the first reason (`true` reads "Read-only"), or `null`; `lockedReason(node)`: the same, or for a folder "It holds read-only items" |

`<nav-pane>` shows a lock after a read-only item's name, the decorations'
badges after it, their tooltips and the read-only reason in its hover
text, and leaves filtered items out. The Move to… dialog refuses a
read-only folder (`chooseMove`).

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
/?view=dash.board&root=projects&folder=a
                             the view dash.board, params {folder: "a"}
```

`readRoute(url)` returns `{root, doc, view, params}` for an address (with
a view, no document; `params` are the query's other parameters);
`routeUrl({root, doc, view, params})` builds the address. `router.go` pushes a history entry when it
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
    enabled: (stilo, { node }) => ...,  // true, or why it does not apply now
});                                     // returns dispose(); a taken id throws
stilo.commands.run("save", { node });
stilo.commands.disabledReason("save", { node }); // null, or the reason ("" if none)
stilo.commands.list();                  // in the order added: the commands pane
```

A command whose `enabled` returns a text (the reason) or `false` does not
apply now: menus and the commands pane show it greyed out, with the reason
as hover text, and `run` does not run it but says in the status "Save is
not available: …". Stilo's own: Save and the editor commands that change
the document (`changes` in `editorCommands()`) do not apply to a read-only
document; Rename, Move to… and Delete not to a read-only item, nor to a
folder holding one (`tree.lockedReason`); New document…, New folder…,
Upload files… and Duplicate not where the new item would go in a read-only
folder.

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

- **Editor commands** come from the editor itself, with their labels,
  keys and groups (`editorCommands()`, `docs/component/api.md`, Commands);
  their id is the editor command's name. Running one calls
  `editor.runCommand(id)`, back in the editor view. They are read once,
  when the built-ins are activated: a cell type registered later gets no
  `make-<type>` command in the list.
- Commands without `run` (Mod+E and Shift+F2 inside a cell's text
  editor, `cell` in `editorCommands()`) are listed for reference: they
  belong to the cell.
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
its `fetch(url, init)`, which throws an `ApiError` for a failed one.

**Middleware.** `use((url, init, next) => response)` adds a function that
every request goes through, the Texl imports included; it returns
`dispose()` (an extension's is undone when it is deactivated). It may
change the request (a header, credentials), call `next(url, init)` and
change the response, or answer itself (a `401` that sends the user to a
login page). The one added last is the outermost. `send(url, init)` is the
request through the middleware, failed or not; `fetch` checks it.

A middleware added with `use(middleware, {outermost: true})` wraps all the
others, so it sees what they made of the response: Stilo's own handling
of a login is one (below), and an extension's ordinary middleware can
handle a `401` before it.

**Errors.** A failed request throws an `ApiError`: `status`, the message
(the server's `error`) and `body`, the whole error body (`login` with a
`401`). A `403` shows its reason where the request was made ("Not
saved: …").

**Login** (`builtins/server.js`). A response `401` with a `login` address
asks the user, in a dialog ("Sign in to continue", the server's `error`,
with a Sign in button), and if they agree goes to the login page, adding
`next=<the page's address>` (`loginUrl`); the request fails as it would.
Requests that fail together ask once.

**Server info.** `info()` reads `GET /_api/info`; a `404` gives a version 0
server: protocol 0, the capabilities of version 0, no extensions.

**Imports.** `load(url)` reads a Texl document through the middleware:
`{url, source}`, the URL being the final one after redirects (a `~` in an
import's path is a redirect). `loader` is `load` bound to the transport:
`<stilo-app>` gives it to the editor (`loader`), so every `texl.import` of
the open document goes through the transport.

Its methods:

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
