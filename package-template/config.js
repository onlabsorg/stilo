const olojs = require('@onlabsorg/olojs');

exports.routes = {
    '/': new olojs.FileStore(`${__dirname}/..`),
};

exports.protocols = {
    'http':     new olojs.HTTPStore('http:/'),
    'https':    new olojs.HTTPStore('https:/'),
};

exports.middlewares = {
    "/": olojs.HTTPServer.ViewerMiddleware.bind(olojs.HTTPServer)
};
