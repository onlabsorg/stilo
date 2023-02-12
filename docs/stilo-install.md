
*stilo install* command
=============================================================================

The *install* command installs a plugin in the active repository.

```
stilo install <plugin-id>
```

where *plugin-id* is any valid *npm* package exporting a `stilo` object that
contains a *stilo.routes* object and a *stilo.commands* object.

After installing the plugin npm package, the *install* command will call the
`.stilo.afterInstall` function passing the name of the installed package,
allowing the repository package to perform custom initialization actions.

> For more information about stilo plugins, see the
> [package documentation](../package-template/README.md).

Finally,
- the `--help` option will display a help message
- the `--verbose` option will display a detailed log of the command


