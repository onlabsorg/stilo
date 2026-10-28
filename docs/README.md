# Stilo developer documentation

*For programmers who want to change Stilo, embed its editor, or write a
server that speaks its protocol. Plain Markdown, read on GitHub.*

The user manual (getting started, the web editor, the `stilo` command, the
document format) is not here: it is part of the OnLabs.org manual, linked
from the repository's [README](../README.md).

## Contents

- [Architecture](architecture.md): the three parts, the contract between
  them, what runs where, the extension points. Start here.
- [Development setup](setup.md): build, run, test and release.
- [The server](server.md): `Storage` and `create_app()`.
- [The CLI](cli.md): `Command` and `COMMANDS`.
- [The web app](web-app.md): the shell around the editor.
- [The editor](editor.md): `<texl-editor>`, cells, rendering.
- [Editor design](editor-design.md): the editing model and its open points.
- [Texl primer](texl-primer.md): the Texl you need to work on the editor.
- [Protocol v0](protocol.md): documents over plain HTTP, the contract
  between the web app and the server.
- [The editor component](component/README.md): using `<texl-editor>` in
  your own page or app.
  - [Embedding the editor](component/guide.md): a step-by-step tutorial.
  - [API reference](component/api.md): every property, event, class and
    function.
- [Style guide](STYLE.md): how to write these pages, docstrings and
  comments.

At the repository root: [CONTRIBUTING.md](../CONTRIBUTING.md) and
[CHANGELOG.md](../CHANGELOG.md).

## How the documentation is organized

- **Developer docs** live here, next to the code, and change in the same
  commit as the code they describe. There is no build and no site.
- **The user manual** is built from the `onlabsorg.github.io` repository
  and kept current from Stilo's commits and these docs. Stilo does not link
  to it, except from its README. So state user-visible changes (editor
  features, keys, `stilo` options, the file format, install) plainly in
  commit messages and in `CHANGELOG.md`.
