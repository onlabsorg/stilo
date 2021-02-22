const olojs = require('@onlabsorg/olojs');
const Router = require('./lib/router');

exports.routes = {
    '/'         : new olojs.FileStore(`${__dirname}/..`),
};

exports.protocols = {
    'http':     new olojs.HTTPStore('http:/'),
    'https':    new olojs.HTTPStore('https:/'),
};

exports.commands = {
    "http-static-server": require('./lib/http-static-server')
};
