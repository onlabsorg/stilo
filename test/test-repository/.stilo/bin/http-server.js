const pathlib = require('path');
const olojs = require('@onlabsorg/olojs');

/**
 *  # Stilo http-server command
 *
 *  The `http-server` starts serving the olo-documents of this repository over HTTP.
 *
 *  The command syntax is as follows:
 *
 *  ```
 *  stilo run http-server [options] [root-path]
 *
 *  Arguments:
 *      root-path     path of the directory to be served as store root
 *
 *  Options:
 *      -p, --port    port on which the server will listen (defaults to 8010)
 *      -h, --help    show this message
 *  ```
 *
 *  Once the document is started, a document under `<root-path>/path/to/doc` can be
 *  fetched via:
 *
 *  ```
 *  HTTP GET http://localhost:<port>/path/to/doc
 *  ```
 *
 *  Where `<port>` is the port number passed via the `-p` or the `--port` option, or
 *  `8010` by default.
 *
 */

module.exports = async (store, cwp, options, path="/") => {
    /// Serve a stilo repository sub-folder over HTTP

    // Print the help message if -h or --help option is passed
    if (options.h || options.help) {
        console.log('stilo-run http-server [options] [path]                                 ');
        console.log('                                                                       ');
        console.log('Serve olo-documents over HTTP.                                         ');
        console.log('                                                                       ');
        console.log('Arguments:                                                             ');
        console.log('  path          path of the directory to be served as store root       ');
        console.log('                                                                       ');
        console.log('Options:                                                               ');
        console.log('  -p, --port    port on which the server will listen (defaults to 8010)');
        console.log('  -h, --help    show this message                                      ');
        console.log('                                                                       ');
        return;
    }

    // Define the store to be served
    const rootPath = pathlib.join(cwp, pathlib.normalize(path || '/'));
    const rootStore = rootPath === '/' ? store : store.SubStore(rootPath);

    // Create and start the server
    const server = olojs.HTTPServer.create(rootStore);
    const port = options.port || options.p || 8010;
    await startServer(server, port);
    console.log(`stilo http-server: serving '${rootPath}' on port ${port}`);

    return server;
}




const startServer = (server, port) => new Promise((resolve, reject) => {
    server.listen(port, err => {
        if (err) reject(err);
        else resolve();
    });
});
