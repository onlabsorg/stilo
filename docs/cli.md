# olojs CLI

```
Usage: olojs [options] [command]

Options:
  -v --version             output the version number
  -h, --help               display help for command

Commands:
  init                     Initializes the current directory as the root of
                           an olojs document package
  install <plugin>         Installs a plugin
  uninstall <plugin>       Uninstalls a plugin
  read <path>              Fetches a document source and prints it to the
                           stdout
  render <path> [args...]  Render a document and prints it to the stdout
  list [path]              Lists the content of a directory
  start [port]             Serves the current package over HTTP
  help [command]           display help for command
```

## olojs init
This command creates a `.olojs` sub-directory inside the current directory.
The `.olojs` directory is a npm package that exports a `config` object:

* `config.routes` contains the routes that will be passed to `olojs.Router`
  to create the document package store. The root path `/` maps to a file-store
  rooted in the directory that contains `.olojs`.
* `config.protocols` contains the protocol schemes that will be passed to `olojs.Router`
  to create the document package store. The protocols `http` and `https` are
  defined by default.
* `config.middlewares` is an object mapping paths to express middleware constructors. 
  The `olojs start` create a HTTP serve and mount all the middleware to their
  paths. Each middleware will be created by passign the package store as argument.  

The `config` object can be manually modified by editing `.olojs/config.js`, but
the master way to customize the document package is via [plugins](./plugins.md).


## olojs render &lt;path&gt; [args]
Renders the document mapped to the passed path and prints the rendered content
to screen.

The path can be also relative to the current working directory. For example,
let's assume that the package root is `/path/to/my-package` and that you
run `olojs render ./doc` from `/path/to/my-package/dir/`; in this case the
document mapped to `/dir/doc` will be rendered.

The `args` parameter is a space-separated list of `key=value` pairs. The
parameters will be parsed into a javascript object that will be added to the
document namespace as `argns` before rendering it.


## olojs read &lt;path&gt;
Fetches the document mapped to the passed path and prints its raw content
to screen.

The path can be relative to the current working directory (see render command).


## olojs list [path]
Lists the items (container names and document names) contained under the given
path.

The path can be relative to the current working directory (see render command)
and, if omitted, it defaults to `.`.


## olojs start [port]
Starts serving the current package over HTTP. The server is made of a collection
of middlewares, defined in `config.middleware`.

By default, the row document are served at `/docs/path/to/doc` and rendered
documents are served at `/#/path/to/doc`.


## olojs install &lt;plugin-name&gt;
Installs a plugin as a dependency of the `.olojs` npm package.

A plugin is any npm package that exports a `plugin` object containing custom
`plugin.routes`, `plugin.protocols` and `plugin.middlewares` objects. Those 
objects will be mixed-in with the main `config.routes`, `config.protocols` and
`config.middlewares` objects respectively.

In other words:
* if the plugin exports a `plugin.routes['/path/to/store']` store, that store
  will be mounted to the main store under the path `/path/to/store`.
* if the plugin exports a `plugin.protocols['ipfs']` store, the `ipfs:` protocol
  will be added to the main store.
* if the plugin exports a `plugin.middleware['/my-server']` function, that 
  middleware `plugin.middleware['/my-server'](store)` will be served over
  HTTP under the `/my-server` path.


## olojs uninstall &lt;plugin-name&gt;
Removes a previously installed plugin.
