# stilo CLI

```
Usage: stilo [options] [command]

Options:
  -v --version                  output the version number
  -h, --help                    display help for command

Commands:
  init [options]                initialize the current directory as the root of
                                an olojs document package
  install [options] <plugin>    install a plugin
  uninstall [options] <plugin>  uninstall a plugin from npm
  read [options] <path>         fetch a document source and print it to the
                                stdout
  render [options] <path>       render a document and print it to the stdout
  serve [options] [path]        serve the stilo repository documents over HTTP
  run                           executes a plugin command
  help [command]                display help for command
```

## stilo init
This command initializes the current directory as a stilo repository.

```
Usage: stilo init [options]

initialize the current directory as the root of an olojs document package

Options:
  --force     eventually overwrites an existing instance
  --verbose   logs detailed information
  -h, --help  display help for command
```

The initialization consists in creating a `.stilo` directory which is a npm 
package that exposes the following items as main exports:

* `.getStore()` returns an olojs.Store object that is used by the `stilo-read` 
  and `stilo-render` command
* `.createServer` returns the HTTP server launched by the `stilo-serve` command
* `.run` executes a sub command. This method is used by the `stilo-run` command
* `.beforeInit` and `.afterInit` called before and after the `stilo-init` command
* `.bfeorePluginInstall` and `.afterPluginInstall`, called before and after
  a plugin installation.
* `.beforePluginUninstall` and `.afterPluginUninstall`, called before and
  after a plugin removal.
  
> The behaviour of a repository can be custimized by modifying these methods. More 
> details can be found in the [package documentation](../package-template/README.md).


## stilo render &lt;doc-path&gt;
Renders the document mapped to the passed path and prints the rendered content
to screen.

```
Usage: stilo render [options] <path>

render a document and print it to the stdout

Arguments:
  path                      path of the document to be rendered

Options:
  -o, --output <file-path>  write the rendered document to a file
  --verbose                 logs detailed information
  -h, --help                display help for command
```

The path can be also relative to the current working directory. For example,
let's assume that the package root is `/path/to/my-package` and that you
run `stilo render ./doc` from `/path/to/my-package/dir/`; in this case the
document mapped to `/dir/doc` will be rendered.


## stilo read &lt;doc-path&gt;
Fetches the document mapped to the passed path and prints its raw content
to screen. The path can be relative to the current working directory (see render 
command).

```
Usage: stilo read [options] <path>

fetch a document source and print it to the stdout

Arguments:
  path                      path of the document to be fetched

Options:
  -o, --output <file-path>  write the fetched source to a file
  --verbose                 logs detailed information
  -h, --help                display help for command
```


## stilo install &lt;plugin-name&gt;
Installs a new plugin.

```
Usage: stilo install [options] <plugin>

install a plugin

Arguments:
  plugin      npm package-id of the plugin to be installed

Options:
  --verbose   logs detailed information
  -h, --help  display help for command
```

A plugin is any npm package that exports a `stilo` object. The command will 
install the plugin as dependency of the `.stilo` npm package and register it 
as plugin.

A plugin can decorate the stilo olojs.Store or add new commands to the cli. The 
new commands can be the run via `stilo run`.


## stilo run <command-name> [options] [args...]
Runs a plugin command.

```
Usage: stilo-run [options]

Options:
  -h, --help  display help for command
```


## stilo uninstall &lt;plugin-name&gt;
Removes a previously installed plugin.

```
Usage: stilo uninstall [options] <plugin>

uninstall a plugin from npm

Arguments:
  plugin      npm package-id of the plugin to be uninstalled

Options:
  --verbose   logs detailed information
  -h, --help  display help for command
```
