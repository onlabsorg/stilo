# .stilo package

This is the dafault implementation of a .stilo package, a npm package used 
by the stilo CLI to configure the olo-documents 
repository.

The stilo CLI only require the package to comply with a minimal API, wile 
the iternal implementation of that API can be anything. In other words, 
the behavior of a .stilo package is highly customizable. The required 
interface consists of:

- *.stilo.store* object
- *.stilo.commands* object
- *.stilo.afterInstall* function
- *.stilo.beforeUninstall* function

The following sections will describe both the minimum requirements that 
these functions need to satisfy and this particular implementation of 
them.



## .stilo.routes

##### Specification
This objects maps paths to [olojs.Store] instances or to parameter-less
functions that return an [olojs.Store] instance.

The *routes* will be mounted to the repository store by the stilo CLI.

##### Implementation
This implementation of the *routes* object contains some standard routes 
(namely 'http:/', 'https:', 'file:/' and 'temp:/'), plus all the custom 
routes defined by the plugins.

Each plugin can define custom routes by exporting a `stilo.routes` object 
of route-store pairs.



## .stilo.commands 

##### Specification
This objects maps command names to command functions. Each function must have 
the following signature:

- `store`: the repository store 
- `cwp`: a store sub-path
- `options`: an object containing command options
- `...args`: an array of command positional parameters

The command functions will be called by the *stilo run* CLI command.

##### Implementation
This implementation of the *commands* objectm, contains all the command 
functions exported by *.stilo/bin/index.js* and all the the custom commands 
defined by the plugins.

Each plugin can define custom commands by exporting a `stilo.commands` object 
of command-name:command-function pairs.

Another way to add custom commands is adding extra functions to the 
*.stilo/bin/index.js* exports. By default, this implementation exports only 
the [http-server](./docs/http-server.md) function.



## .stilo.afterInstall

##### Specification
This function receive an installed npm package name as parameter and does 
something with it. Anything at all.

The *stilo install* CLI command calls this function immediately after 
installing a new plugin.

##### Implementation
This implementation of the *afterInstall* hook, just register the installed 
package in *package.json* as an element of the *stilo.plugins* array. This 
allowes the *routes* and *commands* objects to be aware of the installed 
plugins.


## .stilo.beforeUninstall

##### Specification
This function receive an installed npm package name as parameter and does 
something with it. Anything at all.

The *stilo uninstall* CLI command calls this function just before uninstalling 
a plugin.

##### Implementation
This implementation of the *beforeUninstall* hook, just removes the plugin 
from the *stilo.plugins* array of *package.json*.





[olo.Store]: https://github.com/onlabsorg/olojs/blob/master/docs/store.md
   
