# .olojs package

This is a npm package containing 


* a `store.js` script that exports the olojs Store that will be used by the 
 `read`, `render` and `list` commands. 
* a `commands.js` script that exports a collection of custom commands that can 
  be executed with the `run` command.

The `olojs` cli, once executed, searches fro the first occurrence of the
`.olojs` package in the current working directory and its parent directories.
Then it uses the `.olojs` storeas follows:

- `olojs read <path>` calls `store.read(path)`
- `olojs list <path>` calls `store.list(path)`
- `olojs render <path>` calls `store.load(path)`

The `olojs install` command installs a npm package as dependency of `.olojs` and
adds its name to the `olojs.plugins` array contained in `.olojs/package.json`.
The list of installed plugins will be used by `.olojs/store.js` to augment the 
package store and by `.olojs/commands.js` to augment the list of the available
commands.


   
