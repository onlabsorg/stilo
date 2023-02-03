# stilo
This is a command line tool for managing [olojs] documents; out of the box it 
allows creating new document packages, rendering documents and serving documents
over HTTP.

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

For a full description of the commands available, read the
[cli documentation](./docs/cli.md).


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


### License
This software is released under the [ISC](https://opensource.org/licenses/ISC) 
license.


### Related projects
* [olojs] is a distributed content management system
* [olowiki] is a web interface that allows creating and modifying youd olojs 
  documents (it includes also a stilo plugin)


[olojs]: https://github.com/onlabsorg/olojs
[olowiki]: https://github.com/onlabsorg/olowiki
