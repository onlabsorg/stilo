This npm package exports and `environment` object and a `servers` object. The 
`environment` is an [olojs environment](env) that will be used by `olojs-cli`
to load and render documents. The `servers` object contains a set of servers 
that will be used by `olojs-cli` to serve the environment over the network.

The command `olojs render <path>` command, uses the `environment` object to 
perform the following operations:

* Load the document: `doc = await environment.readDocument(path)`
* Evaluate the document: `docns = await doc.evaluate(doc.createContext())`
* Render the document: `await environment.render(docns)`

The command `olojs serve --type http --port 8010` uses the `environment` and the
`servers` object to perform the following operation

* Create the environment server: `server = servers[type](environment)`
* Start the environment server: `server.listen(port)`

A big deal of customization can be done just by installing new packages and/or
modifying the `olojs` item of the `package.json` file.

```js
"olonv": {
    
    // document global variables to be added to the environment upon creation
    // the globals are loaded via require("path-to-globals-module")
    "globals": "path-to-globals-module" // this path will be passed to node require
    
    // custom stores to be added to the environment router upon creation
    // the stores are loaded via require("path-to-store-module")
    "stores":
        "store1": "path-to-store1-module",
        "store2": "path-to-store2-module",
        ...
    },
    
    // custom servers to be added to the servers object
    // the servers are loaded via require("path-to-server-module")
    "stores":
        "server1": "path-to-server1-module",
        "server2": "path-to-server2-module",
        ...
    }
}
```


[env]: https://github.com/onlabsorg/olojs/blob/master/docs/api/environment.md
