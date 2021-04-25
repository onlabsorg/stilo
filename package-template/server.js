const olojs = require('@onlabsorg/olojs');
const plugins = require('./plugins');
const store = require('./store');


const middlewares = {
    "/": olojs.HTTPServer.ViewerMiddleware.bind(olojs.HTTPServer)
};

for (let plugin of plugins) Object.assign(middlewares, plugin.middlewares);


const express = require('express');
const app = express();
for (let mountPoint of Object.keys(middlewares).sort().reverse()) {
    app.use(mountPoint, middlewares[mountPoint](store));
}


const http = require('http');
module.exports = http.createServer(app);

