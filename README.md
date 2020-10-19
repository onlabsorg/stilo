# olojs-cli
This is a command line interface for managing olojs repositories. It allows
creating a new repo, mounting external (local or remote) repos and serving
the repo via internet.

### Getting started
Install `olojs-cli` globally.

```
npm install @onlabsorg/olojs-cli -g
```

Initialize a new repo:

```
cd /path/to/my-repo
olojs init
```

Render a document contained in my-repo:

```
cd /path/to/my-repo
olojs render /home/path/to/doc
```

>   You can optionally inject parameters in the document context by adding them
>   to the command-line
>
>   `olojs render /path/to/doc p1=val1 p2=val2 p3=val3 ...`
>
>   The passed parameters will added to the document context under the `argns`
>   namespace (argns={p1:val1, p2:val2, p3:val3, ...}).

Serve the repo over http:

```
cd /path/to/my-repo
olojs serve
```

Once the HTTP server is running, you can render the repo document in the browser
by entering the URL `localhost:8010/#/home/path/to/doc` and optionally pass parameters
via a hash query string (e.g. `localhost:8010/#/home/path/to/doc?p1=val1&p2=val2`).


### Customization
Each repository is highly customizable, indeed the repository [environment](env) 
is the main export of the `.olonv` npm package created upon initialization. 
If you speak javascript, you can modify the repo environment at will.

>   cli commands for simple customization (e.g. olojs mount <target> <path>)
>   will be added soon to olojs-cli. Meanwhile please refer to the documentation
>   inside the `.olonv` package to learn how to customize the repo environment.


### License
[MIT](https://opensource.org/licenses/MIT)


[env]: https://github.com/onlabsorg/olojs/blob/master/docs/api/environment.md
