# olojs plugins

> This article assumes that you are already familiar with the
> [olojs library](https://github.com/onlabsorg/olojs).

An olojs plugin is a NodeJS package installable via npm. The main export of the
plugin package may contain the followin objects:

* `routes`: an object defining new store mounting points
* `servers`: an object defining new store servers

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


### Adding custom servers
If present, the `servers` main export should be an object containing one or
more NodeJS http.Server constructors:

```js
exports.servers = {
    "my-custom-server": store => MyCustomServer(store),
    ...
}
```

Each server constructor is a function that takes the olojs document package
store as parameter and returns a NodeJS `http.Server` object which is
supposed to serve the store over HTTP.

Each custom server can be started from the command line as follows:

```
olojs start my-custom-server
```
