# .stilo package

This is the dafault implementation of a .stilo package, a npm package used 
by the stilo CLI and by the stilo NodeJS API as interface to a olo-documents 
repository.

The stilo CLI and the stilo NodeJS API only require the package to comply 
with a minimal API, why the iternal implementation of that API can be 
anything. In other words, the behavior of a .stilo package is highly 
customizable. The required interface consists of:

- .stilo.getStore
- .stilo.getCommands
- .stilo.registerPlugin
- stilo.unregisterPlugin

The following sections will describe both the minimum requirements that 
these functions need to satisfy and this particular implementation of 
them.


## .stilo.getStore

##### Specification
This function takes no parameters and 

##### Implementation



## .stilo.getCommands 

##### Specification

##### Implementation



## .stilo.afterInstall

##### Specification
This function receive an installed npm package name as parameter and does 
something with it. Anything at all.

The *stilo install* CLI command and the *stilo.install* NodeJS API call 
this function immediately after installing a new plugin.

##### Implementation



## .stilo.beforeUninstall

##### Specification
This function receive an installed npm package name as parameter and does 
something with it. Anything at all.

The *stilo uninstall* CLI command and the *stilo.uninstall* NodeJS API call 
this function just before uninstalling a plugin.

##### Implementation















--------------------------------------------------------------



## .stilo.getStore
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
   
