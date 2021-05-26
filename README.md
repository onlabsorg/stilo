# stilo
This is a command line tool for managing [olojs] documents; out of the box it 
allows creating new document packages, rendering documents (to file or in 
the browser), mounting external (local or remote) document stores and installing
new sub-commands via plugins.

### Getting started
Install `stilo` globally.

```
npm install @onlabsorg/stilo -g
```

Initialize a new library:

```
cd /path/to/my-library
stilo init
```

Render a document contained in my-library:

```
stilo render /path/to/doc
```

>   You can optionally inject parameters in the document context by adding them
>   to the command-line
>
>   `stilo render /path/to/doc p1=val1 p2=val2 p3=val3 ...`
>
>   The passed parameters will be added to the document context under the `argns`
>   namespace (argns={p1:val1, p2:val2, p3:val3, ...}).

Serve the library over http:

```
stilo run server
```

Once the HTTP server is running, you can render the library documents in the browser
by visiting the URL `localhost:8010/#/path/to/doc` and optionally pass parameters
via a hash query string (e.g. `localhost:8010/#/path/to/doc?p1=val1;p2=val2`).

For a full description of the commands available, read the
[cli documentation](./docs/cli.md).


### Plugins
Plugins are npm packages that can mount one or more custom stores and/or make
custom sub-commands available to the `stilo run <sub-command>` command.

In order to install a plugin, you use the `stilo install` command, followed
by the name of the npm package that contains the plugin.

```
stilo install <plugin-name>
```

In order to uninstall a plugin, you use the `stilo uninstall` command, followed
by the name of the npm package that contains the plugin.

> If you are a developer and you want to create your own plugin or customize the
> way a package behaves, check the [package documentation](./package-template/README.md).


### License
[MIT](https://opensource.org/licenses/MIT)


### Related projects

* [olojs] is a content management system based on a distributed network of 
  documents having the following properties.
* [olowiki] is a plugin that allows to render and edit stilo documents in the
  browser.


[olojs]: https://github.com/onlabsorg/olojs
[olowiki]: https://github.com/onlabsorg/olowiki