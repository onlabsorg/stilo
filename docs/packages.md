# Packages and the Stilo library

*How a document finds the references of its package: `package.texl`, the
home `~`, `references/`, `stilo init`, and Stilo's own library in
`texl-lib/`. Decisions: [S10](../DECISIONS.md), [S21](../DECISIONS.md) (the
name), [S22](../DECISIONS.md) (`references/`).*

## A package and its home

A **package** is a folder that holds a `package.texl` (a *project* with a
`project.texl` up to Stilo 0.5; S21): the tree of files rooted there. A
subfolder with its own `package.texl` is a separate package. Here the word
always means this bundle of Texl files (a *Texl package*), never Stilo's
own Python or npm package. The package is the self-contained unit: its
documents import each other and its **references**, the packages it uses,
kept in its `references/` folder (`lib/` up to Stilo 0.5; S22), so the
folder works as a whole, wherever it is copied. A reference is to a package
what a library is to a software package.

```text
beam/
├─ package.texl          the manifest: this folder is the home
├─ references/
│  └─ stilo/index.texl   a reference: a folder of Texl files
└─ docs/checks/
   └─ beam-check.texl    imports "~/references/stilo/index.texl"
```

The **home** of a folder is the nearest folder at or above it that holds a
`package.texl`. In an import, a path segment `~` stands for the home:

```texl
<% texl.import "~/references/stilo/index.texl" ~> (lib -> bind "stilo" lib.data.stilo) %>
```

The same line works in every document of the package, at any depth.

## How `~` resolves

Texl gives `~` no meaning: it resolves the import as a relative path, so
`docs/checks/beam-check.texl` asks for
`docs/checks/~/references/stilo/index.texl`.
The host then replaces each `~` segment, from the left, with the home of
the folder before it. One rule, in one module,
`src/stilo/server/home.py`, used in two places:

| Where      | How                                                        | Top |
|------------|------------------------------------------------------------|-----|
| Server     | `Storage.expand_home`: a read with `~` is redirected to the real path ([protocol](protocol.md#url-space)); so the web app's editor needs nothing of its own | the served folder |
| CLI        | the file loader of `create_engine()`, which gives the real file as the final URL ([CLI](cli.md#create_engine)) | the user's home directory; the file-system root outside it |

Both give Texl the real path as the document's **final URL** (Texl 0.8): the
server by a redirect, the CLI from its loader. An imported document is
thus the one at its real path, wherever it was imported from: its `uri` and
the base of its relative imports are its real path, and within one
rendering, imports of it by different paths share one document.

The **top** is where the search stops, and the home when no `package.texl`
is found. So without a manifest the two can disagree: in the web
`~/references` is the served folder's `references/`, on the command line
`$HOME/references`. Run
`stilo init` to make them agree.

Rules worth knowing:

- **A reference's own `~`.** A document at `references/a/a.texl` that
  imports `~/references/b/b.texl` asks for
  `references/a/~/references/b/b.texl`, so its `~` resolves from
  `references/a/`: to the reference's own home if it has a `package.texl`,
  else to the package's. A reference meant to import its sibling
  references has no manifest; one that brings its own `references/` has
  one. A path may hold
  several `~` (a client that does not follow redirects asks for them);
  they resolve from the left.
- **Cycles.** A document importing itself through `~` asks again for its
  own real path, so Texl sees an import cycle and the import is undefined
  (`import.cycle`). This is why the Stilo library's own text must not quote its
  import tag: a tag runs wherever it is, even in a Markdown code block.
  More than 16 `~` segments in one path are refused, a safeguard for
  clients that do not follow redirects.
- **`~/..`** cancels the `~`: URL resolution removes both, so
  `~/../x.texl` is a plain relative path.
- **A folder named `~`** is hidden by the server and cannot be created
  through it: in a path, `~` always means the home.
- **A missing reference** is an ordinary failed import: the tag's value is
  undefined. Documents and the editor work without a package.

## `package.texl`

A Texl document, written by `stilo init`: its text is notes, its tags bind
the package's configuration.

```texl
# beam

This folder is a Stilo package. ...

<% package_name = "beam" %>
<% stilo_version = "0.3.0" %>
```

`stilo_version` is the version that created the package, not one it
requires. The server only checks that the file exists; it never renders it.

## `references/` and `stilo init`

A reference is a folder of Texl files under `references/`, nothing more.
There is no package manager: copy a reference in, or clone it with git.
Versions and clashes are the package's business. Stilo gives an old `lib/`
folder no meaning: it is an ordinary folder (S22).

`stilo init [folder] [--name NAME]` writes `package.texl`, creates
`references/`, and copies the library Stilo bundles into
`references/stilo/`, the Stilo library, a reference like any other. It
refuses to run where a `package.texl` exists and never overwrites
`references/stilo/`.

## The Stilo library, `texl-lib/`

`texl-lib/` at the repository root is the source of the library `stilo
init` copies into `references/stilo/`. Its main document, `index.texl`,
binds one name, `stilo`, a
namespace of Swan functions, gathered from one document per function in the
same folder, imported by a relative path:

| Function           | Document         | What it does                         |
|--------------------|------------------|--------------------------------------|
| `stilo.dataframe`  | `dataframe.texl` | A table of data: column names and rows, shown as a Markdown table (the `data` cell writes it) |
| `stilo.charts`     | `charts.texl`    | Charts as SVG images: `stilo.charts.line {x, y, x_label, y_label, title}` (the `chart` cell writes it) |

Each document's text is the function's documentation, readable on GitHub.
A document of the library must not quote an import tag of the library (or
any tag it does not mean to run): tags run everywhere in a Texl document,
code blocks included.

The wheel ships the folder as `stilo/texl-lib` (`force-include` in
`pyproject.toml`); in a checkout the CLI reads `texl-lib/` where it is.
Both paths end in one constant, `TEXL_LIB` (`src/stilo/cli/package.py`).

To add a function: write it in a new document of `texl-lib/`, describe it
in that document's text, and add it to the namespace `index.texl` binds.
Avoid unbounded recursion: Texl has no depth limit yet, and a runaway
recursion crashes the engine instead of giving an undefined value. Test it
with cases in a JSON file under `tests/texl_lib/`, `<function>-cases.json`
(see `dataframe-cases.json`), which both engines run: `tests/texl_lib/` with
`pytexl`, `web/test/texl-lib.test.js` in the browser (add the file's name to
its list). Each case renders as a document of `texl-lib/` after the import
of `index.texl`, and checks its `text`, or parts it `contains` and
`excludes`. Swan texts have no escapes, so a function that writes markup
quotes its attributes with `'` (`charts.texl`).
