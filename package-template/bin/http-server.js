const pathlib = require('path');
const olojs = require('@onlabsorg/olojs');



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
