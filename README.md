# stilo
This is a command line tool for managing [olojs] documents. Out of the box it 
allows creating new document packages, rendering documents, serving documents
over HTTP and it can be extended via plugins.

> If you are not yet familiar with olojs documents, you can get started with 
> [this introduction](https://github.com/onlabsorg/olojs/blob/master/docs/document.md).

### Getting started
Install `stilo` globally.

```
npm install @onlabsorg/stilo -g
```

Initialize a new repository:

```
cd /path/to/my-repo
stilo init
```

Render a document contained in my-library:

```
stilo render /path/to/doc
```

>   Your local olojs documents are text files with `.olo` extension, but you 
>   must omit the extension when specifying a document path.

Serve the library over http:

```
stilo run http-server
```

Once the HTTP server is running, your document source will be accessible at the 
URL `http:/loclahost:8010/path/to/doc`.


### Plugins
Plugins are npm packages that can expand the stilo store and/or add 
custom sub-commands to the stilo CLI.

In order to install a plugin, you use the `stilo install` command, followed
by the name of the npm package that contains the plugin.

```
stilo install <plugin-name>
```

In order to uninstall a plugin, you use the `stilo uninstall` command, followed
by the name of the npm package that contains the plugin.

> If you are a developer and you want to create your own plugins or modify you
> `.stilo` package, read the [package documentation](./package-template/README.md).


### Documentation

- [stilo init](docs/stilo-init.md) command
- [stilo install](docs/stilo-install.md) command
- [stilo read](docs/stilo-read.md) command 
- [stilo render](docs/stilo-render.md) command 
- [stilo uninstall](docs/stilo-uninstall.md) command
- [stilo run](docs/stilo-run.md) command 
- [stilo run http-server](package-template/docs/http-server.md)
- [Default .stilo npm package](package-template/README.md)


### License
This software is released under the [ISC](https://opensource.org/licenses/ISC) 
license.


### Related projects
* [olojs] is a distributed content management system
* [olowiki] is a web interface that allows creating and modifying youd olojs 
  documents (it includes also a stilo plugin)


[olojs]: https://github.com/onlabsorg/olojs
[olowiki]: https://github.com/onlabsorg/olowiki
