# The stilo command

`stilo` is Stilo's command line. It has two subcommands:

| Command                       | What it does                                   |
|-------------------------------|------------------------------------------------|
| [`stilo serve`](serve.md)     | Serves a folder of documents with the web editor |
| [`stilo render`](render.md)   | Renders a document to the terminal or a file   |

```sh
stilo serve ~/reports
stilo render ~/reports/beam-check.texl -o beam-check.md
```

Every command takes `-h` (or `--help`) and prints its options:

```sh
stilo serve --help
```

[Getting started](../getting-started.md) installs the command.
`python -m stilo` works too, in an environment where Stilo is installed.

## Exit status

`stilo` exits with status 0 when the command succeeds, 1 when it fails
(for example, a file that cannot be read), and 2 when the command line is
wrong (an unknown command or option). Errors are printed to standard error,
starting with `stilo:`.

```sh
stilo render missing.texl
```

```text
stilo: missing.texl: could not be loaded
```
