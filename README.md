# olojs-cli
This is a command line interface for managing [olojs] documents libraries. 
It allows creating a new library, mounting external (local or remote) stores 
and serving the library via internet.

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
olojs render /home/path/to/doc
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
olojs serve
```

Once the HTTP server is running, you can render the library documents in the browser
by visiting the URL `localhost:8010/#/home/path/to/doc` and optionally pass parameters
via a hash query string (e.g. `localhost:8010/#/home/path/to/doc?p1=val1&p2=val2`).


### Customization
You have two types of customization in olojs:

* Mounting external stores to your library tree
* Serving your library via custom servers

In order to mount a new store or use a custom server, you first need to install
a plugin that makes those functionalities available:

```
olojs install plugin-name
```

##### Mounting external stores

Now that you have a plugin installed, you can mount one of the custom 
stores it contains:

```
olojs mount /cstore/mount/point plugin-name/path/to/custom/store
```

After doing that, you can render the documents contained in the new store as
follows:

```
olojs render /cstore/mount/point/path/to/doc
```

or in your browser by visiting the url `localhost:8010#/cstore/mount/point/path/to/doc`.

##### Serving your library via custom servers

You can use the servers contained in your plugins by adding a `-s` flag to the
`serve` command:

```
olojs serve -s plugin-name/path/to/custom/server
```

### Learn more
If you are a developer and you want to create your own plugin, check the
[plugins](./docs/plugins.md) documentation.


### License
[MIT](https://opensource.org/licenses/MIT)


[olojs]: https://github.com/onlabsorg/olojs
[env]: https://github.com/onlabsorg/olojs/blob/master/docs/environment.md
