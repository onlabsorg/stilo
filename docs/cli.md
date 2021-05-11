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
  run <command> [args...]  Runs a custom command
  help [command]           display help for command
```

## olojs init
This command creates a `.olojs` sub-directory inside the current directory.
The `.olojs` directory is a npm package that exposes the following scripts:

* `store.js` exports the olojs Store that will be used by the `read`, `render`
  and `list` commands. 
* `commands.js` exports a collection of custom commands that can be executed
  with the `run` command.


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


## olojs run &lt;command-name&gt; [args]
Runs a custom command. Custom commands are function exported by the script 
`.olojs/commands.js`. The signature of those functions is:

```
exports["command-name"] = (store, options) => ...
```

Upon running the `run <command-name>` command, the `command-name` function will
be executed with the current package store as first parameter and the command
line arguments as options. For example, the following command:

```
olojs run doSomething x=10 s=abc
```

Will result in calling `commands.doSomething(store, {x:10, s:"abc"})`, where
`commands` is the export of `.olojs/commands.js`.

You can add custom commands by manually adding a function to the `.olojs/commands.js`
exports, or by installing plugins that export custom commands.


## olojs run server [port=8101]
Starts serving the current package over HTTP. The server command is defined by
default in `.olojs/server.js`.

By default, the raw documents are served at `/docs/path/to/doc` and rendered
documents are served at `/#/path/to/doc`.


## olojs install &lt;plugin-name&gt;
Installs a new npm package as dependency of the `.olojs` package and registers 
it as a plugin. 

The `.olojs/store.js` script uses the installed plugins to augment the package 
store. 

The `.olojs/commands.js` script uses the installed plugins to augment the package 
commands. 


## olojs uninstall &lt;plugin-name&gt;
Removes a previously installed plugin.
