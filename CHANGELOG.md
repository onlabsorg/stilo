# Changelog

All notable changes to Stilo are listed here, newest first. Versions follow
[semantic versioning](https://semver.org/); before 1.0, any version may
change the interfaces.

## Unreleased

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
