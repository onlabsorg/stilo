const olojs = require('@onlabsorg/olojs');
const plugins = require('./plugins');



// These are the routes of the current package store. By default the only route
// availbale is '/' that mounts a file store rooted in the parent folder.
const routes = {
    '/': new olojs.FileStore(`${__dirname}/..`),
};



// All the routes exported by the installed plugin are merged with the `routes`
// object
for (let plugin of plugins) Object.assign(routes, plugin.routes);



// Exports an olojs Router server built with the routes defined above.
module.exports = new olojs.Router(routes);
