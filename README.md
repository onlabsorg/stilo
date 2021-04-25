# olojs-cli
This is a command line interface for managing [olojs] document packages.
It allows creating a new package, mounting external (local or remote) stores
and serving the documents over HTTP.

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
Plugins are npm packages that can mount one or more custom stores or protocols 
to the main store tree and/or add routes to the HTTP server.

In order to install a plugin, you use the `install` olojs command, followed
by the name of the npm package that contains the plugin.

```
olojs install plugin-name
```

In order to uninstall a plugin, you use the `uninstall` olojs command, followed
by the name of the npm package that contains the plugin.

> If you are a developer and you want to create your own plugin or customize the
> way a package behaves, check the [package documentation](./package-template/README.md).


### License
[MIT](https://opensource.org/licenses/MIT)


### Related projects

* [olojs] is a content management system based on a distributed network of 
  documents having the following properties.
* [olowiki] is a plugin that allows to render and edit an olojs document package
  in the browser.


[olojs]: https://github.com/onlabsorg/olojs
[olowiki]: https://github.com/onlabsorg/olowiki