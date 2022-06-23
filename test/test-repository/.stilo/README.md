# .stilo package

This is the npm package that turns the folder containing it, into a stilo
repository. Every stilo cli command looks up the directory tree to find a
.stilo package and then imports it and uses its API to interface with the
repository. 

The standard .stilo API maily does two things: a) it exposes an [olo.Store] 
that works as interface to the repository documents and b) provides access to 
the installed plugins. In particular, the API contains the following functions:

* `api.getStore` returns the [olo.Store] interface to the repository documents
* `api.createServer` returns a NodeJS [http.Server] object that serves the store 
  over HTTP
* `api.commands` return an object containing all the plugin commands
* `api.run` executes a plugin command
* `api.beforeInit` called before the `stilo-init` command 
* `api.afterInit` called after the `stilo-init` command 
* `api.bfeorePluginInstall` called before the `stilo-install` command
* `api.afterPluginInstall`, called after the `stilo-install` command
* `api.beforePluginUninstall` called before the `stilo-uninstall` command
* `api.afterPluginUninstall`, called after the `stilo-uninstall` command

A .stilo package can be created using the `stilo init` command. This command 
will creat the .stilo directory, the call the `api.beforeInit` hook, then 
install all the dependencies and finally call the `api.afterInit` hook. 


## Store

The store returned by the `api.getStore` function is an [olo.FileStore] rooted in 
the .stilo parent directory. In addition to that, it can also access remote 
document over HTTP and HTTPS (e.g. http://host-name/path/to/doc), global files 
located anywhere on disc (e.g. file://home/path/to/file), in-memory documents 
(e.g. temp://path/to/doc) and an mount arbitrary other sub-stores defined by
plugins.

> This is the standard behavior of the stilo store, but in principle you can
> modify the .getStore function to return any other valid [olo.Store] object.

The store object returned by the `api.getStore` function is used by the following
stilo-CLI commands:

- `stilo-read` returns the source fetched with `store.read`
- `stilo-render` returns the rendered text obtained by calling `store.load`
- `stilo-serve` serves the store over HTTP
- `stilo-run <command>` passes the store to the plugin command handler as parameter


## HTTP Store Server

The `api.createServer` function takes an [olo.Store] as argument (normally 
the store returned by `api.getStore`) and returns a [http.Server] object that:

- on `GET http://hostname/path/to/doc` requests returns `store.read('/path/to/doc')`;
- on `PUT http://hostname/path/to/doc` calls `store.write('/path/to/doc', body)`;
- on `DELETE http://hostname/path/to/doc` calls `store.delete('/path/to/doc')`.

> By default the returned server is an [olo.HTTPServer], but you could modify 
> the `api.createServer` function to return any [http.Server] object.

Internally, the `stilo serve` command calls `api.createServer` with the store 
returned by `api.getStore` as argument and then starts it.


## Plugins 

Plugins are npm packages, installed as dependencies of the .stilo package, that 
export a `stilo` object containing some functions. The functions of the `stilo`
object are of two types:

- A `stilo.__init__` function that is a store decorator called by `api.getStore` 
  after creating the basic store. Every plugin can implement a `__init__` 
  function to decorate the package store.
- Any other function whose name doesn't start by '_', which can be run by the 
  `api.run` function or from the command line via the `stilo run` command. 
  These functions are basically custom commands acting on the package store.

```js
// stilo plugin export
exports.stilo = {
    
    routes: {
        // These stores will be mounted to the repository root store
        '/path/to/store1': store1,
        '/path/to/store2': store2,
        '/path/to/store3': store3        
    },

    commands: {
        
        command1 (store, options, arg1, arg2) {            
            // this function will be called on `stilo run command1 arg1 arg2 -o1 val1 -o2 val2`
            // or via `api.run('command1', {option1:val1, option2:val2}, arg1, arg2)`
            
            /// the first comment starting with triple slash is used as command description
        },

        command2 (store, options, arg1, arg2, arg3) {
            /// another custom command
            // ...
        },

        command3 (store, options, arg1) {
            /// yet another custom command
            // ...
        }
    }
}
```

A plugin can be installed by running the `stilo install <package-id>` command,
which will first call the `api.beforePluginInstall` hook, then install the 
plugin package using `npm` and finally call the `api.afterPluginInstall` hook.

A plugin can be removed by running the `stilo uninstall <package-id>` command,
which will first call the `api.beforePluginUninstall` hook, then remove the 
plugin package using `npm` and finally call the `api.afterPluginUninstall` hook.



[olo.Store]: https://github.com/onlabsorg/olojs/blob/master/docs/store.md
[olo.FileStore]: https://github.com/onlabsorg/olojs/blob/master/docs/api/file-store.md
[http.Server]: https://nodejs.org/api/http.html#class-httpserver
[olo.HTTPServer]: https://github.com/onlabsorg/olojs/blob/master/docs/api/http-server.md
   
