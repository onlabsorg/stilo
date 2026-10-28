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
| `src/components/nav-pane.js`   | `<nav-pane>`: the folder tree                       |
| `src/components/commands-pane.js` | `<commands-pane>`: the command list, by group, foldable |
| `src/components/comments-pane.js` | `<comments-pane>`: the comments of each line     |
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
| `_doc`, `_etag`, `_dirty` | The open document's path, its ETag from the last read or write, and whether it has unsaved changes |
| `_status`                | The message in the top bar ("Saved", an error)  |
| `_navOpen`, `_pane`      | Whether the navigation pane is open; which right pane is open (`"commands"`, `"comments"` or `null`) |
| `_comments`, `_commentLine` | The comments of every line, and the line shown in the comments pane |
| `_source`                | The document's text shown read-only in place of the editor (Show source), or `null` |

The editor is created anew for every document (Lit's `keyed`), so value,
undo history and selection start fresh. Its `url` is the document's public
address (`documentUrl`), so relative imports resolve from the document's
folder.

### Methods

The commands call these public methods:

| Method                 | Does                                                  |
|------------------------|-------------------------------------------------------|
| `save()`               | `updateFile` with the editor's value and the ETag; a `412` shows "changed on the server, reload it" |
| `reload()`             | Reads the document again (after confirming, if dirty) |
| `newDocument()`        | Asks for a name, `createFile` in the navigation root, opens it |
| `toggleNav()`, `togglePane(pane)`, `toggleTheme()` | The view commands |
| `toggleSource()`       | Shows the editor's value read-only in place of the editor (which stays, hidden), or goes back to it |
| `runCommand(id)`       | Runs a command of `commands.js` by its id             |
| `sendEditorKey(key, options)` | Sends a key to the editor as a synthetic `keydown` |

### Events

| From            | Event                       | The app                                  |
|-----------------|-----------------------------|------------------------------------------|
| `<texl-editor>` | `change`                    | Sets `_dirty`, updates the comments      |
| `<texl-editor>` | `comments-click`            | Opens the comments pane on that line     |
| `<nav-pane>`    | `open-document`, `navigate` | Opens a document, changes the root       |
| `<top-bar>`     | `toggle-nav`, `toggle-pane` | Toggles a pane                           |
| right pane      | `run-command`, `close-pane` | Runs a command, closes the pane          |
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
- **Editor commands** are the editor's own keys. Clicking one runs
  `app.sendEditorKey(...)`, which sends the key to the editor as a
  synthetic `keydown`. This is a stopgap until the editor has a command API
  (`runCommand(name)`).
- Commands without `run` (copy, paste, the keys while editing) are listed
  for reference: they need a real key press.

`formatKeys(keys)` turns `Mod+S` into the platform's notation.

## The protocol client: `api.js`

| Function                   | Protocol                 | Returns            |
|----------------------------|--------------------------|--------------------|
| `readFile(path)`           | GET a file               | `{text, etag}`     |
| `createFile(path, text)`   | CREATE                   | the ETag           |
| `updateFile(path, text, etag)` | UPDATE with `If-Match` | the new ETag     |
| `readTree(path, depth?)`   | QUERY the tree           | the tree           |
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
themes always work.

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
