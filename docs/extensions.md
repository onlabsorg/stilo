# Extensions

*Writing an extension for Stilo: a guide, the reference of every hook of
the web app, the server's and the CLI's, and a sketch of the extensions
the API is checked against. The design is in [S17](../DECISIONS.md),
[S18](../DECISIONS.md) (the web app) and [S20](../DECISIONS.md) (the
Python side); the services are described in [The web app](web-app.md).*

Stilo stays a single-user editor of one folder. Anything beyond that is
built outside Stilo, as an **extension**: trusted code, installed by
whoever runs Stilo, that uses Stilo as a dependency and plugs into public
hooks. Documents never load extensions. A hook Stilo lacks is added to
Stilo in general terms ("put a mark on a cell"), never for one consumer.

An extension can have up to three parts, each optional: a **web
extension** (most of this page), a **server extension** and **CLI
commands**, the last two in Python ([Server and CLI
extensions](#server-and-cli-extensions)). Give them one id: the web part
asks `info.hasExtension(id)` whether the server part is there. Loading
them from installed packages at run time, without building a front end,
is for later (S17, phase 6).

## A first extension

```js
// word-count.js: a status item and a panel that follow the open document
export default {
    id: "word-count",
    apiVersion: "1.0",
    activate(stilo) {
        const { html } = stilo;
        const count = () => (stilo.editor.value.match(/\p{L}+/gu) ?? []).length;
        stilo.status.register({ id: "word-count.words", render: () => `${count()} words` });
        stilo.panels.register({
            id: "word-count.panel",
            label: "Word count",
            icon: html`<svg class="icon" viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h6" /></svg>`,
            order: 40,
            render: () => html`<div class="pane-header">Word count</div><p style="padding: 0 1rem">${count()} words</p>`,
        });
        // Render the items again when the document changes
        const again = () => {
            stilo.status.changed();
            stilo.panels.changed();
        };
        stilo.editor.on("edit", again);
        stilo.document.on("open", again);
    },
};
```

Start the app with it:

```js
// main.js of your front end
import { startStilo } from "@onlabsorg/stilo-web";
import wordCount from "./word-count.js";

startStilo({ extensions: [wordCount] });
```

Build with Vite, configured as [the package's page](../web/README.md)
says. Your `index.html` loads `main.js` and has an empty `<body>`:
`startStilo` puts `<stilo-app>` there.

The extension imports nothing from Stilo: everything it needs is on the
`stilo` object it is given. That keeps it working whether it is bundled
into a front end or, later, loaded at run time.

## The extension object

| Field | Is |
|-------|----|
| `id` | Lowercase letters, digits and dashes, starting with a letter. Its commands, panels, views, comment providers and top-bar and status items are named `<id>.<name>` |
| `apiVersion` | The API version it was written for, `"major.minor"`. It works with a Stilo of the same major version and a minor version up to Stilo's (`API_VERSION`, now `"1.0"`) |
| `activate(stilo)` | Registers its contributions. May be async |
| `deactivate()` | Optional: undoes what its registrations do not |

An extension is **skipped**, reported in the console and the status line,
with whatever it registered undone, when it has no `activate`, its id is
not valid or taken, its `apiVersion` does not match, or `activate`
throws (or registers an id outside its own). The app goes on. The
commands pane lists the active extensions, and those not activated with
the reason, in an Extensions group; users of Stilo alone never see it.

## The `stilo` object

`activate` gets a `stilo` object of its own: Stilo's services, through a
proxy that **records every registration**. `stilo.extensions.deactivate(id)`
calls `deactivate()`, then undoes them all, the latest first, so an
extension that forgets a `dispose()` leaves nothing behind. Every
registration also returns its own `dispose()`.

Besides the services, it holds what an element needs:

| Member | Is |
|--------|----|
| `html`, `css`, `svg`, `LitElement` | Lit, the same copy as Stilo's |
| `StiloController` | Gives an element the `stilo` object by context and renders it again when the services it watches change |
| `TexlCell` | The base class of cell types |
| `styles.base` | Stilo's shared styles: `.icon`, `button.icon-button`, `.pane-header` |
| `apiVersion` | Stilo's API version |
| `settings` | The extension's own settings (below) |

An element of your own reaches the services by context, at any depth:

```js
class Counter extends stilo.LitElement {
    constructor() {
        super();
        this._stilo = new stilo.StiloController(this, (s) => [s.document]);
    }
    render() {
        return stilo.html`${this._stilo.stilo?.document.path ?? "No document"}`;
    }
}
customElements.define("word-count-counter", Counter);
stilo.status.register({ id: "word-count.counter", render: () => stilo.html`<word-count-counter></word-count-counter>` });
```

Note: `render(stilo)` of panels, views and bar items gets the app's
`stilo`, not the extension's recording one. Register in `activate`, not
in `render`.

## Hooks

Each hook is a method of a service; [The web app](web-app.md) has the
details of each service.

| To | Use | Returns |
|----|-----|---------|
| Add a command (menus, commands pane, keys) | `commands.register({id, label, group, run, enabled?, checked?})`; `enabled` returns `true` or why not, shown greyed out | `dispose` |
| Bind a key | `keys.bind("Alt+Shift+K", id, {when})`, `when` = `global`, `tree`, `editor` | `dispose` |
| Put a command in a menu | `menus.add("tree/document", id, {group})`; menus `tree/document`, `tree/other`, `tree/folder`, `tree/archive`, `tree/pane` | `dispose` |
| Add a right-pane panel, with its button in the panel rail | `panels.register({id, label, icon, order, render})`; `order` from the top (Stilo's: commands 10, errors 20, comments 30). One element fills the pane; several stack from the top, and the pane scrolls | `dispose` |
| Put a badge on a panel's button, Stilo's too | `panels.setBadge(id, badge)`, `null` to remove it; called as often as needed | `dispose` |
| Replace a panel, Stilo's too | `panels.replace("comments", panel)`; disposing brings the old one back | `dispose` |
| Add to the top bar (a button that runs an action, a user's name) | `topBar.register({id, order, render})` | `dispose` |
| Add to the status line | `status.register({id, order, render})`; the line shows only with items | `dispose` |
| Add a page | `views.register({id, label, render(stilo, params)})`, at `/?view=<id>&…`; `views.open(id, params)` | `dispose` |
| Mark tree items | `tree.decorate(node => ({badge, tooltip, tone, muted}))` | `dispose` |
| Hide tree items | `tree.filter(node => false)` | `dispose` |
| Make items read-only | `tree.readOnly(path => reason)`: the document opens read-only, save, rename, move, delete are disabled | `dispose` |
| Ask the tree's providers again | `tree.invalidate()` | — |
| Mark cells | `editor.decorate(({path, value, cells}) => [{cell, text, tone, title}])`; `editor.invalidate()`; event `mark-click` | `dispose` |
| Get the document as rendered | `await editor.renderedHtml()`: the HTML each cell shows, sanitised, one `<div class="texl-cell" data-cell data-type>` each, hidden cells left out (`{hidden: true}` to keep them) | — |
| Know which cell is selected | `editor.selection`, `{line, cell}`: the line and its cell's name, the anchor of comments and marks; event `selection-change`, with the same | — |
| Add comments from elsewhere | `comments.addProvider({id, label, comments(path)})`, anchored to cells by name; `comments.refresh()` | `dispose` |
| See or change every request | `transport.use((url, init, next) => response)`, Texl imports included; `{outermost: true}` to wrap all the others | `dispose` |
| Keep data in the folder | `transport.readFile(path)`, `transport.createFile(path, text)`, `transport.updateFile(path, text, etag)`: any file, a JSON file too, on a server with `info.has("rewrite")`; a hidden name (`.x`) is not served | promises |
| Know what the server can do | `info.protocol`, `info.has("upload")`, `info.hasExtension(id)`, `info.server`; read before `activate`, when started with `startStilo` | — |
| Add a cell type | `cells.register(CellClass)`, a subclass of `stilo.TexlCell`, with its "Make it …" command | `dispose` (the command; the type stays) |
| Talk to the user | `ui.notify(message, {level})`, `ui.confirm(message, {ok, danger})`, `ui.prompt(message, value)`, `ui.dialog(render)` | promises |
| Keep settings | `settings.get(key, fallback)`, `settings.set(key, value)`, `settings.on("change")`, per browser | — |
| Hear what happens | `document.on("open" \| "save")`, `editor.on("edit" \| "selection-change" \| …)`, `router.on("change")`, any service's `on("change")` | `stop` |

Rules that hold for all of them:

- **Ids** of an extension's commands, panels, views, comment providers and
  bar items start with `<id>.`; a taken id is refused. Stilo's own keep
  their bare names. `replace` takes the id of what it replaces.
- **Keys**: the editor's own keys come first; for the same key and
  context the last binding wins, with a warning, and disposing it brings
  back the one before.
- **No veto on save**: hear `save` after the fact; refuse changes with
  read-only items (and, later, on the server).
- **Providers** (tree, marks, comments) that throw count as saying
  nothing, and are reported in the console.
- **Documents are untrusted**: never insert their text as HTML; Lit's
  `html` escapes it.

## Front ends composed differently

The package also exports what a front end needs to compose Stilo's parts
itself: `createStilo({transport})`, the services without an app;
`<stilo-provider .stilo=${stilo}>`, which provides them to the elements
inside; `stiloContext` and `StiloController`. The panes are not exported
yet (S16).

## Server and CLI extensions

The Python side has two public APIs, `stilo.server.__all__`
([The server](server.md#the-public-api)) and `stilo.cli.__all__`
([The CLI](cli.md#the-public-api)); a package written against them alone
keeps working as Stilo changes.

**A server extension** is a `ServerExtension` given to `create_app()`:

```python
from fastapi import APIRouter, Depends
from stilo.server import ServerExtension, Storage, StorageWrapper, create_app, get_storage

class Recording(StorageWrapper):
    def update(self, path, content, if_match=None):
        tag = super().update(path, content, if_match)   # raises if refused
        record(path, content)                           # after a save only
        return tag

router = APIRouter()

@router.get("/versions/{path:path}")                    # /_api/x/history/versions/...
async def versions(path: str, storage: Storage = Depends(get_storage)):
    storage.read(path)                                  # 404 if there is no such document
    return {"versions": list_versions(path)}

history = ServerExtension("history", router=router, wrap_storage=Recording,
                          capabilities=["versions"], version="0.1.0")
app = create_app("docs", web_dist, extensions=[history])
```

- Its **router** is mounted under `/_api/x/<id>/`; `StorageError`s
  (`NotFound`, `Forbidden`, …) raised there are answered as in the rest
  of the API, `{"error": …}` with their status.
- Its **storage wrapper** wraps the storage every route uses, Stilo's
  own included: an action after every save, a check before it (raise
  `Forbidden` with a reason), or a storage of another kind under it. Any
  object with the methods of `Storage` is a storage.
- `/_api/info` lists it with its **capabilities** and **version**.
- `middleware` of `create_app()` wraps the whole app, e.g. a login.

**CLI commands** are `Command`s in the entry-point group
`stilo.commands` of the package's `pyproject.toml`; `stilo --help` lists
them after Stilo's own ([The CLI](cli.md#commands-from-other-packages)).
A command renders with `create_engine()` as `stilo render` does, and
serves a folder with its server extensions with
`run_server(create_app(folder, WEB_DIST, extensions=[...]), host, port)`.

Until phase 6, `stilo serve` has no server extensions: a package that
has one offers its own command to serve (`stilo history serve`), and
its web part comes in a front end built with `startStilo({extensions})`
(passed to `create_app()` as `web_dist`).

`tests/test_extension_contract.py` writes Validation 3 and 7 below as two
such packages, importing only public names (it checks that from its own
source); a change that breaks one of these hooks breaks it.

## Validation: the extensions the API must allow

Each sketch uses the public API alone.

1. **Word count.** The example above: `status`, `panels`, `editor`'s
   `edit`, `document`'s `open`.
2. **Spell or style checker.** `editor.decorate` returns a mark on each
   cell with findings (`tone: "warning"`, the finding as `title`); a
   panel lists them, a click calls `editor.reveal(line)`; a command
   "Check again" (`commands`, `keys`) recomputes and calls
   `editor.invalidate()`. `mark-click` opens the panel.
3. **Version history.** `info.hasExtension("history")` says whether the
   server has its part; `tree.decorate` marks changed files; `menus.add`
   puts "Show history" on documents; a panel lists versions; a view
   `history.version` (`?view=history.version&path=…&rev=…`) renders
   `<texl-editor readonly>` with the old text, and `history.compare` two
   of them side by side; `document.on("save")` refreshes the panel. On
   the server, a `StorageWrapper` records a
   version after every save (whoever saves: the web app or another
   client), and a router serves them, `/_api/x/history/versions/<path>`
   and `/_api/x/history/version/<n>/<path>`, which the panel and the
   views read through `transport.fetch`; a CLI command `stilo history`
   lists them, and `stilo history serve` serves a folder with the
   extension. All in one `ServerExtension("history", …)`.
4. **Read-only folders.** `tree.readOnly(path =>
   path.startsWith("references/") && "a third-party reference")`, and
   `tree.decorate` for a mark on a reference changed anyway.
5. **A server behind a login.** The server answers `401` with a `login`
   address (protocol v1): Stilo asks the user to sign in and goes there,
   adding `next`. The extension, if the server needs more than its
   cookies: `transport.use` adds a header with the user's token and, on a
   `401`, refreshes the token and repeats the request, so Stilo's own
   question never comes; `topBar.register` shows the user's name and a
   "Sign out" item; `info.server` says which server it is.
6. **Comments from an outside source.** `comments.addProvider` with
   `comments(path)` fetching an issue tracker (through `transport.fetch`
   or the tracker's own API); `panels.setBadge("comments", …)` or a
   `topBar` item for new notifications.
7. **Export to PDF.** A command and a menu entry on documents, offered
   only when `info.hasExtension("pdf")`, post the editor's rendered HTML
   (`editor.renderedHtml()`)
   to `/_api/x/pdf/<path>` and download the answer, `application/pdf`
   with `Content-Disposition: attachment` (the server never runs a
   document itself). A CLI command `stilo pdf <file>` renders it with
   `create_engine()` and converts it.
8. **A dashboard page.** `views.register({id: "dash.board", …})`, its
   content from `tree.tree` and `transport.readFile` for each document;
   links in it to `?view=` or to documents open in the app.
9. **A custom cell type.** A subclass of `stilo.TexlCell` with `type`,
   `label`, `key`, given to `cells.register`; its "Make it …" command
   comes with it.
10. **A replaced panel.** `panels.replace("comments", {…})` with a panel
    of its own over the `comments` service. The navigation pane is part
    of the core: it is extended through `tree` and `menus`, not replaced.

`web/test/contract.test.js` is one extension that uses every hook in a
real app, then is deactivated; a change that breaks a hook breaks it.
