
*stilo read* command
============================================================================

Given a document path, the *read* command fetches a document from the
repository and prints it to the stdout.

```
stilo read <path>
```

If the *path* argument is an absolute path, it will be considered relative
to the repository root. If, instead, the *path* argument is a relative
path it will be considered relative to the current working directory.

In order to write the feched source to a file, the `--output` option can
be used:

```
stilo read <path> --output <file-path>
```

Finally,
- the `--help` option will display a help message
- the `--verbose` option will display a detailed log of the command


