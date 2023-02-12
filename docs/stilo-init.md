
*stilo init* command
=============================================================================

The *init* command sets up a repository in the current working directory; in
extent, it will create a *.stilo* npm package that will serve as repository
configuration.

```
stilo init
```

>   For detailed information about the *.stilo* npm package, see the
>   documentation of the [default .stilo package](../package-template/README.md)

If the current working directory already contains a *.stilo* directory, the
*init* command will quit with a message. In order to re-initialize the repository,
deleting the old *.stilo* package and installing a fresh one, you may use the
*--force* option:

```
stilo init --force
```

Finally,
- the `stilo init --help` option will display a help message
- the `stilo init --verbose` option will display a detailed log of the command


