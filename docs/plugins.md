# olojs plugins

> This article assumes that you are already familiar with the
> [olojs library](https://github.com/onlabsorg/olojs).

An olojs plugin is a NodeJS package installable via npm. The main export of the
plugin package may contain the followin objects:

* `routes`: an object defining new store mounting points
* `commands`: an object defining new commands executable via `olojs run cmd`.

In an existing olojs document package, a plugin can be installed via the
command `olojs install <package-name>` and uninstalled via the command
`olojs uninstall <package-name>`.


### Adding custom stores
If present, the `routes` main export should be an object containing path-store
pairs, where `store` should be a `olojs.Store` instance:

```js
exports.routes = {
    "/path/to/custom/store": store,
    ...
}
```

Each store will be mounted to the olojs document package store at the given
path.


### Adding custom commands
If present, the `commands` main export should be an object containing one or
more NodeJS functions that take an olojs Store as first parameters and an
options object as second parameter:

```js
exports.commands = {
    "my-custom-command": async (store, options) => { /*...*/ },
    /* ... */
}
```

When the command `olojs run my-custom-command key1=val1 key2=val2 ...` is executed,
the function `commands["my-custom-command"]` will be called with the document
package store as first argument and the object `{key1:val1, key2:val2, ...}` as
second argument.
