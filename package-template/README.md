# .stilo package

This is a npm package containing 

* a `store.js` script that exports the olojs Store that will be used by the 
 `read`, `render` and `list` commands. 
* a `commands.js` script that exports and object containing only functions of 
  the type `async (store, options) => {...}`. Each of those functions
  can be called from the command line via `stilo run <fn-name> [opt1=val1 opt2=val2 ...]`

The `stilo` cli, once executed, searches fro the first occurrence of the
`.stilo` package in the current working directory and its parent directories.
Then it uses the `.stilo/store` store as follows:

- `stilo read <path>` calls `store.read(path)`
- `stilo list <path>` calls `store.list(path)`
- `stilo render <path>` fetches and evaluates the document mapped to `path` in `store`

The `stilo install` command installs a npm package as dependency of `.stilo` and
adds its name to the `stilo.plugins` array contained in `.stilo/package.json`.
The list of installed plugins will be used by `.stilo/store.js` to decorate the 
store and by `.stilo/commands.js` to add new sub-commands.

A plugin package should export a `stilo` object containing a `__init__` function
and or any number of command functions. For example, the following plugins
defined a store decorator and two sub-commands:

```js

exports.stilo = {
    
    __init__ (store) {
        // This function will be called after building the package store
        // and used as decorator.
        store.mount('myplugin:/', new olo.MemoryStore());
    }
    
    command1 (store, options) {
        // this function will be called on `stilo run command1 opt1=val1 opt2=val2 ...`
    }

    command2 (store, options) {
        // this function will be called on `stilo run command2 opt1=val1 opt2=val2 ...`
    }
}

```

   
