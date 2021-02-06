# olojs CLI

```
Usage: olojs [options] [command]

Options:
  -v --version                  output the version number
  -h, --help                    display help for command

Commands:
  init                          Initializes the current directory as the root
                                of an olojs document package
  install <plugin>              Installs a plugin
  uninstall <plugin>            Uninstalls a plugin
  read <path>                   Fetches a document source and prints it to
                                the stdout
  render <path> [args...]       Render a document and prints it to the stdout
  list [path]                   Lists the content of a directory
  run <command-name> [args...]  Runs one of the plugged-in commands
  help [command]                display help for command
```

## olojs init
This command creates a `.olojs` sub-directory inside the current directory.
The `.olojs` directory is a npm package that exports a `config` object:

* `config.routes` contains the routes that will be passed to `olojs.Router`
  to create the document package store. The root path `/` maps to a file-store
  rooted in the directory that contains `.olojs`.
* `config.servers` is an object containing a set of store servers. Each server
  is a function that takes an olojs store as parameter and returns an NodeJS
  `http.Server` object. The default server constructor is
  `olojs.HTTPServer.createServer`.

The `config` object can be manually modified by editing `.olojs/config.js`, but
the master way to customize the document package is via [plugins](./plugins.md).


## olojs render <path> [args]
Renders the document mapped to the passed path and prints the rendered content
to screen.

The path can be also relative to the current working directory. For example,
let's assume that the package root is `/path/to/my-package` and that you
run `olojs render ./doc` from `/path/to/my-package/dir/`; in this case the
document mapped to `/dir/doc` will be rendered.

The `args` parameter is a space-separated list of `key=value` pairs. The
parameters will be parsed into a javascript object that will be added to the
document namespace as `argns` before rendering it.


## olojs read <path>
Fetches the document mapped to the passed path and prints its raw content
to screen.

The path can be relative to the current working directory (see render command).


## olojs list [path]
Lists the items (container names and document names) contained under the given
path.

The path can be relative to the current working directory (see render command)
and, if omitted, it defaults to `.`.


## olojs run <command-name> [options]
Runs a plugged-in command with the give options (see [plugins](./plugins.md)).

The only default command is `http-static-server` that takes an optional
`port=XXXX` parameters and starts the olojs HTTPServer.


## olojs install <plugin-name>
Installs a plugin as a dependency of the `.olojs` npm package.

A plugin is any npm package that exports a `plugin` object containing a custom
`plugin.routes` and `plugin.servers` object. Those objects will be mixed-in with
the main `config.routes` and `config.servers` objects respectively.

In other words:
* if the plugin exports a `plugin.routes['/path/to/store']` store, that store
  will be mounted to the main store under the path `/path/to/store`.
* if the plugin exports a `plugin.servers['my-server']`, that server can be
  used to serve the document package store over HTTP by using the command
  `olojs start my-server`.


## olojs uninstall <plugin-name>
Removes a previously installed plugin.
