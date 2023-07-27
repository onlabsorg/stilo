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
 *  Once the server started, a document under `<root-path>/path/to/doc` can be
 *  fetched via:
 *
 *  ```
 *  HTTP GET http://localhost:<port>/path/to/doc
 *  ```
 *
 *  Where `<port>` is the port number passed via the `-p` or the `--port` option, or
 *  `8010` by default.
 *
 *  If the *root-path* argument is a relative path, it will be resolved as relative
 *  to the current working directory. If it is an assolute path, it will be
 *  resolved as relative to the repository root path.
 */

module.exports = async (stilo, options, path="") => {
    /// Serve a stilo repository sub-folder over HTTP

    // Print the help message if -h or --help option is passed
    if (options.h || options.help) {
        stilo.logger.log('stilo-run http-server [options] [path]                                 ');
        stilo.logger.log('                                                                       ');
        stilo.logger.log('Serve olo-documents over HTTP.                                         ');
        stilo.logger.log('                                                                       ');
        stilo.logger.log('Arguments:                                                             ');
        stilo.logger.log('  path          path of the directory to be served as store root       ');
        stilo.logger.log('                                                                       ');
        stilo.logger.log('Options:                                                               ');
        stilo.logger.log('  -p, --port    port on which the server will listen (defaults to 8010)');
        stilo.logger.log('  -h, --help    show this message                                      ');
        stilo.logger.log('                                                                       ');
        return;
    }

    // Define the store to be served
    const rootPath = pathlib.resolve(stilo.cwp, path);
    const rootStore = stilo.store.createSubStore(rootPath);

    // Create and start the server
    const server = olojs.HTTPServer.create(rootStore);
    const port = options.port || options.p || 8010;
    await startServer(server, port);
    stilo.logger.log(`stilo http-server: serving '${rootPath}' on port ${port}`);

    return server;
}




const startServer = (server, port) => new Promise((resolve, reject) => {
    server.listen(port, err => {
        if (err) reject(err);
        else resolve();
    });
});
