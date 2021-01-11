# .olojs package

This is a npm package containing the configuration of the olojs document
package rooted in its parent directory.

The main export of the package consists of two objects:

* `routes` contains the routes that will be passed to `olojs.Router`
  to create the document package store. The root path `/` maps to a file-store
  rooted in the directory that contains `.olojs`.
* `servers` is an object containing a set of store servers. Each server
  is a function that takes an olojs store as parameter and returns an NodeJS
  `http.Server` object. The default server constructor is 
  `olojs.HTTPServer.createServer`.
  
  
The `/config/` folder contains further configuration data:
 
* `/config/plugins.json` is a json file that contains the array of all the
  installed plugins.
  
> A plugin is just another npm package installed as dependency of .olojs
   
The `olojs` cli, once executed, searches fro the first occurrence of the
`.olojs` package in the current working directory and its parent directories.
Once the `.olojs` package is found, loads it an builds a `config` object
as follows:
 
* `config.routes` contains the `routes` object exported by the `.olojs`
  package, mixed-in with the `routes` objects exported by all the installed
  plugins. 
* `config.servers` contains the `servers` object exported by the `.olojs`
  package, mixed-in with the `server` objects exported by all the installed
  plugins.

The config object is used by the `render` and `list` commands to build the
document package store as follows:

```js
store = olojs.Router(config.routes);
```

The config object is used by the `start` command to retrieve the server to be
started. If no server name is passed to the command line, then the `default`
server is used.

   
