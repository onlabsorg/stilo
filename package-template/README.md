This npm package is used by the `olojs` command-line interface to

* Generate the olojs environment
* Serve the olojs environment

The `package.json` file contains an `"olojs"` object:

```js
"olojs": {
    
    // document global variables to be added to the environment upon creation
    // the globals are loaded via npm require    
    "globals": "./globals",
    
    // custom stores to be added to the environment router upon creation.
    // Each store is defined by an array [path, ...args], where path is the
    // module path of the store class, while ...args are passed to the
    // store constructor.
    "store": {
        "http": ["@onlabsorg/olojs/lib/stores/http", "http:/"],
        "https": ["@onlabsorg/olojs/lib/stores/http", "https:/"],
        "temp": ["@onlabsorg/olojs/lib/stores/memory"]
    },

    // When olojs initi doesn't specify a --type parameter, the following
    // server will be used as defualt.
    "server": "@onlabsorg/olojs/lib/servers/http"    
}
```

Stores can be added and removed with the `olojs mount` and `olojs unmount`
commands, while the other properties can be modified by edition the
`package.json` file.
