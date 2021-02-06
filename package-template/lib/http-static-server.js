const olojs = require('@onlabsorg/olojs');

module.exports = function (store, options={}) {
    const portNumber = options.port || 8010;
    const server = olojs.HTTPServer.createServer(store);
    return new Promise((resolve, reject) => {
        server.listen(portNumber, err => {
            if (err) reject(err);
            else {
                console.log(`olojs HTTP static server listening on port ${portNumber}`);
                resolve(server);
            }
        });
    });
}
