# .olojs package

This is a npm package containing the configuration of the olojs document
package rooted in its parent directory.

The main export of the package consists of three objects:

* `routes` contains the routes that will be passed to `olojs.Router`
  to create the document package store. The root path `/` maps to a file-store
  rooted in the directory that contains `.olojs`.
* `protocols` contains the protocol schemes that will be passed to `olojs.Router`
  to create the document package store. The protocols `http` and `https` are
  defined by default.
* `middlewares` is an object mapping paths to express middleware constructors. 
  The `olojs start` create a HTTP serve and mount all the middleware to their
  paths. Each middleware will be created by passign the package store as argument.  
  
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
* `config.protocols` contains the `protocols` object exported by the `.olojs`
  package, mixed-in with the `protocols` objects exported by all the installed
  plugins. 
* `config.middlewares` contains the `middlewares` object exported by the `.olojs`
  package, mixed-in with the `middlewares` objects exported by all the installed
  plugins. 

The config object is used by the `render`, `list` and `start` commands to build 
the document package store as follows:

```js
store = olojs.Router(config.routes, config.protocols);
```

   
