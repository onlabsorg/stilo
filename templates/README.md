
This npm package exports an [olojs environment](env) that will be used by `olojs-cli`
to perform the following operations:

* load and render a document (environment.loadDocument & environment.render)
* serve the environment itself (environment.createServer)

If you want to customize the repo behaviour, you can alter the environment
exported by `index.js` at will, as long as the followin API is preserved:

* environment.loadDocument
* environment.render
* environment.createServer

A big deal of customization can be done just by installing new packages and/or
modifying the `olonv` item of the `package.json` file.


[env]: https://github.com/onlabsorg/olojs/blob/master/docs/api/environment.md
