# olojs plugins

Upon initialization (`olojs init`) of a library, olojs creates a `.olojs`
folder in the current directory, which is a npm pacage.

A plugin is just another npm package added as dependency to the `.olojs`
package. The install command ...

```
olojs install <package-name>
```

... is just a shortcut for

```
cd ./.olojs
npm install <package-name> --save
```

A plugin npm package can expose one or more of the following objects as main
export of a module:

* A store object, inheriting from `olojs.stores.Empty` or any other of the 
  `olojs.stores`.
* A Server, which is a function that takes an `olojs.Environment` object and
  returns an server object with a `server.listen(port, callback)` method and a
  `server.close()` mehtod.
    
To get started with olojs programming, see [the olojs project on github](https://github.com/onlabsorg/olojs/blob/master/README.md).
