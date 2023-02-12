
*stilo run* command
============================================================================

The `run` command executes a custom stilo command exported by the local
.stilo package. For a list of the commands available in the current package,
enter:

```
stilo run --help
```

In the default implementation of the .stilo npm package, the custom
commands can be either defined in `.stilo/bin/` as scripts exporting a
command function, or by plugins. See the
[degault package documentation](../package-template/README.md)
for more information.


