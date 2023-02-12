
*stilo uninstall* command
=============================================================================

The *uninstall* command removes a plugin from the active repository.

```
stilo uninstall <plugin-id>
```

where *plugin-id* is any valid *npm* package exporting a `stilo` object that
contains a *stilo.routes* object and a *stilo.commands* object.

Before uninstalling the plugin npm package, the *uninstall* command will
call the `.stilo.beforeUninstall` function passing the name of the plugin,
allowing the repository package to perform custom tear down actions.

> For more information about stilo plugins, see the
> [package documentation](../package-template/README.md).

Finally,
- the `--help` option will display a help message
- the `--verbose` option will display a detailed log of the command


