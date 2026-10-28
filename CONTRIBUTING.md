# Contributing to Stilo

Thank you for helping. Stilo is young, and every bug report, idea and fix
counts.

## Report a bug or ask for a feature

Open an issue on <https://github.com/onlabsorg/stilo/issues>. For a bug,
say what you did, what you expected and what happened, and attach the
smallest document that shows it, if there is one.

Remember who Stilo is for: engineers, finance people and other Word and
Excel users. A feature request that makes Stilo feel more familiar to them
is welcome; one that makes it feel like a programmer's tool needs a good
reason.

## Propose a change

1. Fork the repository and create a branch from `main`.
2. Set up the development environment: see
   [Development setup](docs/setup.md).
3. Make the change, with tests:
   - the server and the CLI: `tests/server/`, `tests/cli/`, run with
     `uv run pytest` at the root;
   - the editor: `web/test/`, run with `npm test` in `web/`.
4. Update the documentation that the change affects (see below).
5. Add a line to the *Unreleased* section of `CHANGELOG.md` if users will
   notice the change.
6. Open a pull request. Explain what it changes and why. The continuous
   integration runs all the tests.

Keep a pull request to one topic. For a large change, open an issue first
to discuss it.

## Rules of the code

- **Three parts, one contract.** The web app talks to the server only
  through the protocol (`web/src/api.js`). A protocol change goes into
  `docs/protocol.md` first, then into `src/stilo/server/` and the web app.
- **One place per extension point**: cell types only through the registry
  (`web/src/editor/registry.js`), CLI commands only through `COMMANDS`
  (`src/stilo/cli/commands.py`), the server only through `create_app()`.
- **The editor owns the document.** Cells are views of their Texl source
  and report changes by events.
- **Documents are untrusted.** Sanitize rendered HTML; the server never
  executes documents.
- **Plain JavaScript** (ES modules, JSDoc types) with Lit: declare reactive
  properties in `static properties` and initialize them in the
  constructor, never as class fields.
- **Colors only through the theme tokens** (`web/src/theme.css`); check
  the light and the dark theme.
- Python: 3.11 or later, Google-style docstrings.

The [developer documentation](docs/README.md) explains the architecture
and the modules.

## Documentation

The developer documentation is in `docs/`, plain Markdown read on GitHub.
When a change affects developers, update the matching page in the same pull
request. The style guide is `docs/STYLE.md`.

The user manual lives in the OnLabs.org manual, outside this repository,
and is updated from Stilo's commits. When a change affects users (editor
features, keys, `stilo` options, the file format, install), say so plainly
in the commit message and in `CHANGELOG.md`.

## License

Stilo is released under the [MIT license](https://github.com/onlabsorg/stilo/blob/main/LICENSE). By contributing, you
agree that your contributions are released under the same license.
