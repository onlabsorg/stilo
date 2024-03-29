
# Stilo http-server command

The `http-server` starts serving the olo-documents of this repository over HTTP.

The command syntax is as follows:

```
stilo run http-server [options] [root-path]

Arguments:
    root-path     path of the directory to be served as store root

Options:
    -p, --port    port on which the server will listen (defaults to 8010)
    -h, --help    show this message
```

Once the server started, a document under `<root-path>/path/to/doc` can be
fetched via:

```
HTTP GET http://localhost:<port>/path/to/doc
```

Where `<port>` is the port number passed via the `-p` or the `--port` option, or
`8010` by default.

If the *root-path* argument is a relative path, it will be resolved as relative
to the current working directory. If it is an assolute path, it will be
resolved as relative to the repository root path.


