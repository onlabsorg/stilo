# Changelog

All notable changes to Stilo are listed here, newest first. Versions follow
[semantic versioning](https://semver.org/); before 1.0, any version may
change the interfaces.

## Unreleased

- **Saving includes the cell being edited.** Ctrl+S (or Save in the commands
  pane) now commits a cell in edit mode before saving, instead of leaving its
  edit out of the file. If the cell refuses the edit, it stays in edit mode
  with its message and nothing is saved.
- Editor API: new read-only property `editing`.
- **Comments pane**: each comment now says "Cell 3" instead of "Line 3", as the
  Errors pane does.
- **The web editor shows errors.** A value a formula returned as undefined is
  highlighted in its cell, with the reason as hover text, and the right margin
  shows the number of errors on each line. A new button in the top bar shows
  the document's total and opens the Errors pane: each error's description,
  its source line with the failing position marked, its causes and where it
  was made and shows, as "Cell 3, line 12" (the line is left out when the cell
  has only one). A click on a highlighted value or a margin count opens that
  error; a click on an entry selects its line; a link opens the imported
  document where the error was made. A double click still edits the cell. Only
  a value returned by a formula counts, directly or as an item of a tuple: not
  an assignment, not a value inside a list or namespace.
- **`stilo render` reports undefined values.** When a document returns
  undefined values, one line on standard error says how many; the output is
  unchanged. `-d` / `--debug` explains each one on standard error (location,
  source line, description, causes) and numbers them in the output as
  `[[Undefined #1]]`. `--strict` exits with status 1 if there are any. Only a
  value returned by a formula counts, directly or as an item of a tuple: not
  an assignment, not a value inside a list or namespace.
- **Texl 0.6** (`pytexl` and `@onlabsorg/texl`). A broken link is now visible:
  a formula whose `texl.import` fails shows `[[Undefined]]`; before, it showed
  nothing. `stilo render` says why a document cannot be loaded, e.g. `stilo:
  report.texl: could not be loaded: FileNotFoundError: ...`.
- **Texl 0.5** (`pytexl` and `@onlabsorg/texl`). Formulas are stricter: text
  left over after an expression, such as a stray `)`, now makes the whole
  formula show `[[Undefined]]`; before, it was ignored. A formula whose
  promise ends in an error also shows `[[Undefined]]`; before, it showed
  nothing. In documents, the rendered text of an imported document is now
  `lib.text`, no longer `lib.rendering`.
- **Table cell: column alignment**. Three buttons above the grid, as in
  Word, align the column of the current field left, centred or right; the
  pressed one shows the column's alignment, and the fields line up the
  same way. The table cell is now ready for use: each field shows its
  table cell's Texl source, and outside editing the cell shows the
  rendered table.
- **Commands pane**: Copy, Cut, Paste, Commit and Discard now run from
  the pane too (the browser may ask before pasting), and every command
  there does exactly what its key does.
- **Comments pane**: clicking a comment selects its line in the document.
- Editor API: `runCommand(name)` runs any editor command by name (the
  list is in `commands`), and `select(line)` selects a line; the app uses
  them instead of simulating key presses.
- **Type keys**: on a selected line, `=` makes it a Formula cell and
  starts editing, as `=` starts a formula in Excel; `t` does the same for
  Text, `m` for Markdown and Shift+T for Table. On a line that already has
  that type, the key just starts editing, as Enter does. If the line
  cannot take the type, it stays as it is and a message says why ("Needs
  a table"), as in the type menu, which now shows each type's key.
- **Formula cells**: a line that is a single formula can be a Formula
  cell, edited as the expression alone, `q * L ^ 2 / 8`, without the
  `<% %>` around it, and shown as its result.
  Comments around the formula are kept. A formula that contains `%>` is
  not saved: the cell says why, and Escape discards the change.
- **Changing a cell's type only offers types that fit**: in the type
  menu (Mod+/), Table is offered only for a cell that is a table or
  empty, Formula only for a cell that is one formula or empty; other
  types are greyed out with the reason ("Needs a table"). Blank lines and
  comments never count against a type. Text and Markdown are always
  offered.
- **A table or formula cell refuses an invalid edit**: Ctrl+Enter keeps
  the cell in edit mode with a message instead of saving something that
  is no longer a table or a formula.
- Table cells now accept blank lines and comments before and after the
  table and inside its rows, and an empty table cell starts a new
  two-column table.
- **Table cells** (first version): a table is a Markdown table edited as a
  grid, one field per table cell, formulas allowed in each. Tab and
  Shift+Tab move between fields, Tab in the last one adds a row; buttons
  insert and delete rows and columns. A Markdown cell holding a table can
  change to Table and back without loss.
- **New document typography**: text in Literata, headings and table
  headers in Source Sans 3; tables full width with equal columns, ruled
  as in a printed report, with numbers lined up in columns; sub- and superscripts no longer open up the
  line. The fonts ship with Stilo, so no network is needed.
- **Show source** (Alt+U, View): shows the document's text, read-only,
  in place of the editor, unsaved changes included; Alt+U again or the
  close button goes back to the editor.
- The button that opens the commands pane is now a menu icon (⋮), the
  last one on the right of the top bar.
- `examples/sample.texl` imports its library from the right folder.
- The user manual (getting started, the web editor, the `stilo` command,
  the document format) moved to the OnLabs.org manual,
  <https://www.onlabs.org/manual/>. This repository keeps the developer
  documentation, as plain Markdown in `docs/`; the site on
  <https://www.onlabs.org/stilo/> is no longer built.

## 0.1.0 — 2026-10-27

First release on PyPI, as `stilo-cli` (`pip install stilo-cli`; the
command and the Python package are still `stilo`).

Stilo restarted as the editor for Texl documents
(<https://github.com/onlabsorg/stilo>), bringing together:

- the web app: navigation pane, the editor, commands and comments panes,
  light and dark theme;
- the editor, formerly the `texl-editor` package (0.2.0, Texl 0.4): a
  document as a stack of `text` and `markdown` cells, live rendering, cell
  comments;
- the server, `stilo-server`: one folder of documents over plain HTTP
  (protocol v0);
- the command line, `stilo`, with `render` and `serve`.

The earlier, olojs-based Stilo is kept under the tag `olojs-v0.19.4`.

Since the restart:

- One package, `stilo`, with the command line (`stilo.cli`), the server
  (`stilo.server`, formerly `stilo_server`) and the web app (`stilo/web`):
  one Python project at the root of the repository, sources in
  `src/stilo/`, tests in `tests/`; the web app builds into the package.
  Built with `uv build` after the web build, installed from a checkout
  with `uv tool install .`. `python -m stilo_server` is gone: use
  `stilo serve`.
- Documentation site, built and published by GitHub Actions on
  <https://www.onlabs.org/stilo/>: getting started, the `stilo` command,
  the web editor, the document format, the protocol, the editor component
  and a developer guide.
- Web app: links to other documents open in the app, resolved from the open
  document.
- Commands pane: the command groups fold.
- The package builds without the web app (it is then left out), so that
  `uv run` works in a fresh checkout; the release checks that it is in.
- Releases: a pushed tag `vX.Y.Z` publishes the package on PyPI and
  creates the GitHub release (`.github/workflows/release.yml`).
