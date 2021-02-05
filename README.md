# olojs-cli
This is a command line interface for managing [olojs] document packages.
It allows creating a new package, mounting external (local or remote) stores
and serving the documents over the internet.

### Getting started
Install `olojs-cli` globally.

```
npm install @onlabsorg/olojs-cli -g
```

Initialize a new library:

```
cd /path/to/my-library
olojs init
```

Render a document contained in my-library:

```
olojs render /path/to/doc
```

>   You can optionally inject parameters in the document context by adding them
>   to the command-line
>
>   `olojs render /path/to/doc p1=val1 p2=val2 p3=val3 ...`
>
>   The passed parameters will be added to the document context under the `argns`
>   namespace (argns={p1:val1, p2:val2, p3:val3, ...}).

Serve the library over http:

```
olojs start
```

Once the HTTP server is running, you can render the library documents in the browser
by visiting the URL `localhost:8010/#/path/to/doc` and optionally pass parameters
via a hash query string (e.g. `localhost:8010/#/path/to/doc?p1=val1;p2=val2`).

For a full description of the commands available, read the
[cli documentation](./docs/cli.md).


### Plugins
Plugins are npm packages that can mount one or more custom stores to the main
store tree and/or make one or more custom servers available.

In order to install a plugin, you use the `install` olojs command, followed
by the name of the npm package that contains the plugin.

```
olojs install plugin-name
```

In order to uninstall a plugin, you use the `uninstall` olojs command, followed
by the name of the npm package that contains the plugin.

If you are a developer and you want to create your own plugin, check the
[plugins](./docs/plugins.md) documentation.


### License
[MIT](https://opensource.org/licenses/MIT)


[olojs]: https://github.com/onlabsorg/olojs
