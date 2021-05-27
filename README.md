# stilo
This is a command line tool for managing [olojs] documents; out of the box it 
allows creating new document packages, rendering documents (to file or in 
the browser), mounting external (local or remote) document stores and installing
new sub-commands via plugins.

> If you are not yet familiar with olojs documents, you can get started with 
> [this introduction](https://github.com/onlabsorg/olojs/blob/master/docs/document.md).

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

>   Your local olojs documents are text files with `.olo` extension, but you 
>   must omit the extension when specifying a document path.

Serve the library over http:

```
stilo run server
```

Once the HTTP server is running, you can render the library documents in the browser
by visiting the URL `localhost:8010/#/path/to/doc` and optionally pass parameters
via a hash query string (e.g. `localhost:8010/#/path/to/doc?p1=val1;p2=val2`).

>   Of course, with the same command, you can even serve your documents over
>   the internet.

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


### Cooperation
Any stilo package you create is a folder containing olojs documents, which are
just text files with `.olo` extension, organized in sub-folders as you please.

By their nature, the olojs documents contained in you package can import 
each other and re-use each-other's content, which makes your stilo package a 
personal content management system. 

Wouldn't it be great if you could use also other people's documents, the same 
way programmers use open-source libraries created by others, allowing for 
collaborative editing of documents? Of course that's possible and there are 
several ways to do that:

* **Git it!** Being your package just a bunch of text files, you can use
  [Git](https://git-scm.com/) to version-control them and cooperate on them.
* **Access remote documents via HTTP/HTTPS!** Each of your packages mounts by
  default two virtual stores: `/.protocols/http/` and `/.protocols/https/`. You 
  can use those stores to fetch/load/import documents from anywhere on the web.
  For example, try `stilo render /.protocols/http/raw.githubusercontent.com/onlabsorg/olojs/master/test/public/greet.olo?name=You`.
* **Install a third party stilo library!** It is possible for people to publish
  olojs document libraries on `npm` and for you to install them and mount them 
  to a path of your local package via `stilo install <library-npm-package>`. To
  be clear, as far as I know, nobody has published such a library yet (not even me),
  but I will update this documentation as soon as someone (or more likely me)
  does.
* **Share a sub-folder for concurrent editing!** This can be done via DropBox,
  GoogleDrive, Hypercore, etc.
* **Install a cooperation plugin!** The stilo plugin system is really flexible
  and someone (maybe you) may some day create a proper plugin to ease 
  cooperative olojs documents editng.


### License
[MIT](https://opensource.org/licenses/MIT)


### Related projects

* [olojs] is a content management system based on a distributed network of 
  documents having the following properties.
* [olowiki] is a plugin that allows to render and edit stilo documents in the
  browser.


[olojs]: https://github.com/onlabsorg/olojs
[olowiki]: https://github.com/onlabsorg/olowiki