# .olojs package

This is a npm package containing 

- a `store.js` script that exports the olojs document package Store
- a `server.js` script that exports the olojs document package HTTP Server
   
The `olojs` cli, once executed, searches fro the first occurrence of the
`.olojs` package in the current working directory and its parent directories.
Then it uses the `.olojs` store and server as follows:

- `olojs read <path>` calls `store.read(path)`
- `olojs list <path>` calls `store.list(path)`
- `olojs render <path>` calls `store.load(path)`

The `olojs install` command installs a npm package as dependency of `.olojs` and
adds its name to the `olojs.plugins` array contained in `.olojs/package.json`.
The list of installed plugins will be used by `.olojs/store.js` to augment the 
package store and by `.olojs/server.js` to augment the package server.


   
