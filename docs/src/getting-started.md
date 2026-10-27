# Getting started

This page installs Stilo, opens the sample documents in the editor and
renders one from the command line.

## Install

Stilo is not on PyPI yet: you build it from a copy of its source code. You
need:

- [git](https://git-scm.com/),
- [uv](https://docs.astral.sh/uv/), which also installs Python 3.11 or
  later if you do not have it,
- [Node.js](https://nodejs.org/) 22 or later, to build the web editor.

Get the code, build the web editor and install the `stilo` command:

```sh
git clone https://github.com/onlabsorg/stilo.git
cd stilo
cd web && npm install && npm run build && cd ..
uv tool install --python ">=3.11" .
```

The last line builds the package `stilo`, with the web editor inside, and
puts the `stilo` command on your path. If uv says that its folder is not on
your path, run `uv tool update-shell` and open a new terminal. Check it:

```sh
stilo --help
```

```text
usage: stilo [-h] {render,serve} ...

Edit and render a folder of linked Texl documents.
```

To update Stilo later, run `git pull`, build the web editor again and add
`--reinstall` to the `uv tool install` line.

## Open the sample documents

Stilo comes with a folder of sample documents, `examples`. Serve it:

```sh
stilo serve examples
```

```text
Stilo: serving /home/ada/stilo/examples at http://127.0.0.1:8000/
```

Open <http://127.0.0.1:8000/projects/beam/beam-check.texl> in your browser.
You see a beam calculation: text, inputs, a design load and a table, all on
numbered lines. The navigation pane on the left lists the documents of the
folder.

Try it:

1. Press ↓ until line 2, *Input*, is selected, and press Enter to edit it.
2. Change the span, `L = 6`, to `L = 7`.
3. Press Ctrl+Enter (⌘+Enter on a Mac). The design load and the bending
   check below follow.
4. Press Ctrl+S to save the document.

Press Ctrl+C in the terminal to stop the server.

## Render a document

`stilo render` prints a document with its formulas computed:

```sh
stilo render examples/projects/beam/beam-check.texl
```

The output is the document's text, with every `<% %>` formula replaced by
its value. The beam check imports the section properties from
`examples/library/steel.texl`, and `stilo render` follows that import too.

## Next steps

- Learn the editor: [The web editor](editor/index.md).
- Serve your own folder: [stilo serve](cli/serve.md).
- Learn the formula language in the
  [Texl manual](https://www.onlabs.org/texl/book/).
