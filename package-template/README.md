# .olojs package

This is a npm package containing 


* a `store.js` script that exports the olojs Store that will be used by the 
 `read`, `render` and `list` commands. 
* a `commands.js` script that exports a collection of custom commands that can 
  be executed with the `stilo run` command.

The `stilo` cli, once executed, searches fro the first occurrence of the
`.stilo` package in the current working directory and its parent directories.
Then it uses the `.stilo` storeas follows:

- `stilo read <path>` calls `store.read(path)`
- `stilo list <path>` calls `store.list(path)`
- `stilo render <path>` calls `store.load(path)`

The `stilo install` command installs a npm package as dependency of `.stilo` and
adds its name to the `stilo.plugins` array contained in `.stilo/package.json`.
The list of installed plugins will be used by `.stilo/store.js` to augment the 
package store and by `.stilo/commands.js` to augment the list of the available
commands.


   
