const olojs = require('@onlabsorg/olojs');
const plugins = require('./plugins');



// These are the routes of the current package store. By default the only route
// availbale is '/' that mounts a file store rooted in the parent folder.
const routes = {
    '/': new olojs.FileStore(`${__dirname}/..`),
};

// All the routes exported by the installed plugins are merged with the `routes`
// object
for (let plugin of plugins) Object.assign(routes, plugin.routes);



// The followin protocol are added by default to the package store.
const protocols = {
    http:  new olojs.HTTPStore('http:/'),
    https: new olojs.HTTPStore('https:/'),
};

// All the protocols exported by the installed plugin are merged with the 
// `protocols` object
for (let plugin of plugins) Object.assign(routes, plugin.protocols);

// The routes are mounted as default protocol
protocols.default = new olojs.Router(routes);



// Exports an olojs Protocols store built with the protocols defined above.
module.exports = new olojs.Protocols(protocols);
