const http = require('http');

module.exports = function (package) {
    const {routes, protocols, middlewares} = package.config;
    const store = new package.olojs.Router(routes, protocols);

    const express = package.require('express');
    const app = express();
    for (let mountPoint of Object.keys(middlewares).sort().reverse()) {
        app.use(mountPoint, middlewares[mountPoint](store));
    }
    return http.createServer(app);
}
