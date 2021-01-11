const olojs = require('@onlabsorg/olojs');

exports.routes = {
    '/': new olojs.FileStore(`${__dirname}/..`),
};

exports.servers = {
    default: store => olojs.HTTPServer.createServer(store)
}
