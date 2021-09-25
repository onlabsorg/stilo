# stilo CLI

```
Usage: stilo [options] [command]

Options:
  -v --version                    output the version number
  -h, --help                      display help for command

Commands:
  init                            initialize the current directory as the
                                  root of an olojs document package
  install <plugin>                install a plugin
  uninstall <plugin>              uninstall a plugin
  read <path>                     fetch a document source and print it to the
                                  stdout
  render <path> [params...]       render a document and print it to the
                                  stdout
  list [path]                     list the content of a directory
  run <command-name> [params...]  executes a sub-command
  commands                        list the available sub-commands
  help [command]                  display help for command
```

## stilo init
This command creates a `.stilo` sub-directory inside the current directory.
The `.stilo` directory is a npm package that exposes the following scripts:

* `store.js` exports the olojs Store that will be used by the `read`, `render`
  and `list` commands. 
* `commands.js` exports a collection of custom commands that can be executed
  with the `run` command.


## stilo render &lt;docId&gt;
Renders the document mapped to the passed path and prints the rendered content
to screen.

The docId parameter is a string composed by a document path, optionally followed
by `?` and query string.

The path can be also relative to the current working directory. For example,
let's assume that the package root is `/path/to/my-package` and that you
run `stilo render ./doc` from `/path/to/my-package/dir/`; in this case the
document mapped to `/dir/doc` will be rendered.

The query string, interpreted of a `&`-separated sequence `key=value` pairs,
will be passed to the document context as a namespace named `argns`.


## stilo read &lt;path&gt;
Fetches the document mapped to the passed path and prints its raw content
to screen.

The path can be relative to the current working directory (see render command).


## stilo list [path]
Lists the items (container names and document names) contained under the given
path.

The path can be relative to the current working directory (see render command)
and, if omitted, it defaults to `.`.


## stilo run <command-name> [opt1=val1 opt2=val2 ...]
Runs a subcommand and passes to it the current olojs store and the trailing
options.

You can add custom sub-commands to stilo manually modifying the `.stilo/commands.js` 
module, or by installing plugins that export custom commands.


## stilo commands
Lists all the available sub-commands.


## stilo install &lt;plugin-name&gt;
Installs a new npm package as dependency of the `.stilo` package and registers 
it as a plugin. 

The `.stilo/store.js` script uses the installed plugins to augment the package 
store. 

The `.stilo/commands.js` script uses the installed plugins to add new 
sub-commands to the stilo CLI. 


## stilo uninstall &lt;plugin-name&gt;
Removes a previously installed plugin.
