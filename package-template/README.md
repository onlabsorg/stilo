# .stilo package

This is a npm package containing 


* a `store.js` script that exports the olojs Store that will be used by the 
 `read`, `render` and `list` commands. 
* a `commands.js` script that exports and object containing only functions of 
  the type `async (store, options) => {...}`. Each of those functions
  can be called from the command line via `stilo run <fn-name> [opt1=val1 opt2=val2 ...]`

The `stilo` cli, once executed, searches fro the first occurrence of the
`.stilo` package in the current working directory and its parent directories.
Then it uses the `.stilo` store as follows:

- `stilo read <path>` calls `store.read(path)`
- `stilo list <path>` calls `store.list(path)`
- `stilo render <path>` fetches and evaluates the document mapped to `path` in `store`

The `stilo install` command installs a npm package as dependency of `.stilo` and
adds its name to the `stilo.plugins` array contained in `.stilo/package.json`.
The list of installed plugins will be used by `.stilo/store.js` to augment the 
package store and by `.stilo/commands.js` to add new sub-commands.


   
