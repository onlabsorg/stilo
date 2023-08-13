# .stilo package

This is the dafault implementation of a .stilo package, a npm package used 
by the stilo CLI to configure the olo-documents repository.

The stilo CLI only requires the package to comply with a minimal API, wile 
the iternal implementation of that API can be anything. In other words, 
the behavior of a .stilo package is highly customizable. The required 
interface consists of:

- *.stilo.protocols* object
- *.stilo.routes* object
- *.stilo.commands* object
- *.stilo.afterInstall* function
- *.stilo.beforeUninstall* function

The following sections will describe both the minimum requirements that 
the *.stilo* api need to satisfy and this particular implementation of it.



## .stilo.protocols

##### Specification
This objects maps URI schemes to [olojs.Store] instances or to parameter-less
functions that return an [olojs.Store] instance.

The *protocols* will be mounted to the repository URIStore by the stilo CLI.

Stilo will always map the 'home:' scheme to a Router defined by the routes
defined in the .stolo.routes object.

##### Implementation
This implementation of the *protocols* object contains some standard protocols,
such as `http`, `https` and `file` and all the custom protocols defined by the 
installed plugins.

Each plugin can define custom protocols by exporting a `stilo.protocols` object 
of scheme-store pairs.



## .stilo.routes

##### Specification
This objects maps paths to [olojs.Store] instances or to parameter-less
functions that return an [olojs.Store] instance.

The *routes* will be mounted to the repository store by the stilo CLI.

Stilo will always map the '/' path to a FileStore rooted in the repository
directory.

##### Implementation
This implementation of the *routes* object contains all the custom 
routes defined by the installed plugins.

Each plugin can define custom routes by exporting a `stilo.routes` object 
of route-store pairs.



## .stilo.commands 

##### Specification
This objects maps command names to command functions. Each function must have 
the following signature:

- `stilo`: object representing the stilo environment
  - `stilo.store`: the repository store 
  - `stilo.rootPath`: the root path of the stilo repository
  - `stilo.cwp`: a store sub-path
  - `stilo.logger`: the logger used by the stilo CLI
- `options`: an object containing command options
- `...args`: an array of command positional parameters

The command functions will be called by the `stilo run <command-name> [options] [args]` 
CLI command.

##### Implementation
This implementation of the *commands* object, contains:

1. all the command functions exported by the scripts in *.stilo/bin/*; each script in 
   the *bin* folder must export only a command function which will be mapped to a
   command named after the script name
2. all the the custom commands defined by the plugins; each plugin can define custom 
   commands by exporting a `stilo.commands` object of command-name:command-function pairs.

By default, this implementation exports only the [http-server](./docs/http-server.md) 
command, defined in the `bin/http-server.js` script.



## .stilo.afterInstall

##### Specification
This function receives an installed npm package name as parameter and does 
something with it. Anything at all.

The `stilo install <package-id>` CLI command calls this function immediately after 
installing a new plugin.

##### Implementation
This implementation of the *afterInstall* hook, just registers the installed 
package in *package.json* as an element of its *stilo.plugins* array. This 
allowes the *routes* and *commands* objects to be aware of the installed 
plugins.



## .stilo.beforeUninstall

##### Specification
This function receive an installed npm package name as parameter and does 
something with it. Anything at all.

The `stilo uninstall <package-id>` CLI command calls this function just before 
uninstalling a plugin.

##### Implementation
This implementation of the *beforeUninstall* hook, just removes the plugin 
from the *stilo.plugins* array of *package.json*.





[olojs.Store]: https://github.com/onlabsorg/olojs/blob/master/docs/store.md
   
