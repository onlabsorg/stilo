# Projects and the Stilo library

*How a document finds the libraries of its project: `project.texl`, the
home `~`, `lib/`, `stilo init`, and Stilo's own library in `texl-lib/`.
Decision: [S10](../DECISIONS.md).*

## A project and its home

A **project** is a folder that holds a `project.texl`. The project is the
self-contained unit: its documents import each other and the libraries in
its `lib/` folder, so the folder works as a whole, wherever it is copied.

```text
beam/
├─ project.texl          the manifest: this folder is the home
├─ lib/
│  └─ stilo/stilo.texl   a library: a folder of Texl files
└─ docs/checks/
   └─ beam-check.texl    imports "~/lib/stilo/stilo.texl"
```

The **home** of a folder is the nearest folder at or above it that holds a
`project.texl`. In an import, a path segment `~` stands for the home:

```texl
<% texl.import "~/lib/stilo/stilo.texl" ~> (lib -> bind "stilo" lib.data.stilo) %>
```

The same line works in every document of the project, at any depth.

## How `~` resolves

Texl gives `~` no meaning: it resolves the import as a relative path, so
`docs/checks/beam-check.texl` asks for `docs/checks/~/lib/stilo/stilo.texl`.
The host then replaces each `~` segment, from the left, with the home of
the folder before it. One rule, in one module,
`src/stilo/server/home.py`, used in two places:

| Where      | How                                                        | Top |
|------------|------------------------------------------------------------|-----|
| Server     | `Storage.expand_home`, on every read ([protocol](protocol.md#url-space)); so the web app's editor needs nothing of its own | the served folder |
| CLI        | the file loader of `create_engine()` ([CLI](cli.md#create_engine)) | the user's home directory; the file-system root outside it |

The **top** is where the search stops, and the home when no `project.texl`
is found. So without a manifest the two can disagree: in the web `~/lib` is
the served folder's `lib/`, on the command line `$HOME/lib`. Run
`stilo init` to make them agree.

Rules worth knowing:

- **Several `~`.** A library's URL keeps its `~`
  (`.../~/lib/a/a.texl`), so a library importing `~/lib/b/b.texl` asks for
  `.../~/lib/a/~/lib/b/b.texl`. The second `~` resolves from `lib/a/`:
  to the library's own home if it has a `project.texl`, else to the
  project's. A library meant to import its sibling libraries has no
  manifest; one that brings its own `lib/` has one.
- **Cycles.** Texl tells an import cycle by its URLs, and those of a cycle
  through `~` grow at every turn. A path with more than 16 `~` segments is
  refused, so such a cycle ends in a failed import instead of running
  forever. This is why the library's own text must not quote its import
  tag: a tag runs wherever it is, even in a Markdown code block.
- **`~/..`** cancels the `~`: URL resolution removes both, so
  `~/../x.texl` is a plain relative path.
- **A folder named `~`** is hidden by the server and cannot be created
  through it: in a path, `~` always means the home.
- **A missing library** is an ordinary failed import: the tag's value is
  undefined. Documents and the editor work without a project.

## `project.texl`

A Texl document, written by `stilo init`: its text is notes, its tags bind
the project's configuration.

```texl
# beam

This folder is a Stilo project. ...

<% project_name = "beam" %>
<% stilo_version = "0.3.0" %>
```

`stilo_version` is the version that created the project, not one it
requires. The server only checks that the file exists; it never renders it.

## `lib/` and `stilo init`

A library is a folder of Texl files under `lib/`, nothing more. There is no
package manager: copy a library in, or clone it with git. Versions and
clashes are the project's business.

`stilo init [folder] [--name NAME]` writes `project.texl`, creates `lib/`,
and copies the library Stilo bundles into `lib/stilo/`. It refuses to run
where a `project.texl` exists and never overwrites `lib/stilo/`.

## The Stilo library, `texl-lib/`

`texl-lib/` at the repository root is the source of the library `stilo
init` copies. Its main document, `stilo.texl`, binds one name, `stilo`, a
namespace of Swan functions. For now it is a placeholder (`stilo.greet`);
the first real function, `stilo.dataframe`, comes with the data cell.

The wheel ships the folder as `stilo/texl-lib` (`force-include` in
`pyproject.toml`); in a checkout the CLI reads `texl-lib/` where it is.
Both paths end in one constant, `TEXL_LIB` (`src/stilo/cli/project.py`).

To add a function: add it to the namespace in `stilo.texl` and describe it
in the document's text, which is the library's documentation. Test it in
`tests/cli/test_project.py` through a document that imports the library.
