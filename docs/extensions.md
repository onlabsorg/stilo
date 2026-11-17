# Extensions

*Writing an extension for Stilo's web app: a guide, the reference of every
hook, and a sketch of the extensions the API is checked against. The design
is in [S17](../DECISIONS.md) and [S18](../DECISIONS.md); the services are
described in [The web app](web-app.md).*

Stilo stays a single-user editor of one folder. Anything beyond that is
built outside Stilo, as an **extension**: trusted code, installed by
whoever runs Stilo, that uses Stilo as a dependency and plugs into public
hooks. Documents never load extensions. A hook Stilo lacks is added to
Stilo in general terms ("put a mark on a cell"), never for one consumer.

This page covers the web app. Server endpoints for extensions, a
`Storage` given to `create_app()` and CLI commands from other packages
are planned (S17) and not there yet.

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
| Put a command in a menu | `menus.add("tree/document", id, {group})`; menus `tree/document`, `tree/other`, `tree/folder`, `tree/pane` | `dispose` |
| Add a right-pane panel | `panels.register({id, label, icon, order, render})`; `panels.setBadge(id, badge)` | `dispose` |
| Replace a panel, Stilo's too | `panels.replace("comments", panel)`; disposing brings the old one back | `dispose` |
| Add to the top bar | `topBar.register({id, order, render})` | `dispose` |
| Add to the status line | `status.register({id, order, render})`; the line shows only with items | `dispose` |
| Add a page | `views.register({id, label, render(stilo, params)})`, at `/?view=<id>&…`; `views.open(id, params)` | `dispose` |
| Mark tree items | `tree.decorate(node => ({badge, tooltip, tone, muted}))` | `dispose` |
| Hide tree items | `tree.filter(node => false)` | `dispose` |
| Make items read-only | `tree.readOnly(path => reason)`: the document opens read-only, save, rename, move, delete are disabled | `dispose` |
| Ask the tree's providers again | `tree.invalidate()` | — |
| Mark cells | `editor.decorate(({path, value, cells}) => [{cell, text, tone, title}])`; `editor.invalidate()`; event `mark-click` | `dispose` |
| Add comments from elsewhere | `comments.addProvider({id, label, comments(path)})`, anchored to cells by name; `comments.refresh()` | `dispose` |
| See or change every request | `transport.use((url, init, next) => response)`, Texl imports included | `dispose` |
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

## Validation: the extensions the API must allow

Each sketch uses the public API alone. Parts that need the server or the
CLI wait for phases 4 and 5 of S17.

1. **Word count.** The example above: `status`, `panels`, `editor`'s
   `edit`, `document`'s `open`.
2. **Spell or style checker.** `editor.decorate` returns a mark on each
   cell with findings (`tone: "warning"`, the finding as `title`); a
   panel lists them, a click calls `editor.reveal(line)`; a command
   "Check again" (`commands`, `keys`) recomputes and calls
   `editor.invalidate()`. `mark-click` opens the panel.
3. **Version history.** `tree.decorate` marks changed files; `menus.add`
   puts "Show history" on documents; a panel lists versions; a view
   `history.version` (`?view=history.version&path=…&rev=…`) renders
   `<texl-editor readonly>` with the old text, and `history.compare` two
   of them side by side; `document.on("save")` records a version. Reading
   versions needs a server endpoint (`/_api/x/history/`, phase 4) and the
   folder's history a `Storage` wrapper or a CLI command (phase 5).
4. **Read-only folders.** `tree.readOnly(path => path.startsWith("lib/") &&
   "a third-party library")`, and `tree.decorate` for a mark on a library
   changed anyway.
5. **A server behind a login.** `startStilo({transport})` with the
   server's origin; `transport.use` adds credentials and, on a `401`,
   sends the user to the login page; `topBar.register` shows the user's
   name and a "Sign out" item. How the server answers `401` is part of
   the protocol (phase 4).
6. **Comments from an outside source.** `comments.addProvider` with
   `comments(path)` fetching an issue tracker (through `transport.fetch`
   or the tracker's own API); `panels.setBadge("comments", …)` or a
   `topBar` item for new notifications.
7. **Export to PDF.** A command and a menu entry on documents that
   download from a server endpoint (`/_api/x/pdf/`, phase 4); a CLI
   command (phase 5).
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
