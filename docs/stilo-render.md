
*stilo render* command
============================================================================

Given a document path, the *render* command fetches a document from the
repository, renders it and prints its rendered text to the stdout.

```
stilo render <path>
```

If the *path* argument is an absolute path, it will be considered relative
to the repository root. If, instead, the *path* argument is a relative
path it will be considered relative to the current working directory.

In order to write the rendered document to a file, the `--output` option can
be used:

```
stilo render <path> --output <file-path>
```

Finally,
- the `--help` option will display a help message
- the `--verbose` option will display a detailed log of the command


