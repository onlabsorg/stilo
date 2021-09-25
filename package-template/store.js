const olo = require('@onlabsorg/olojs');
const plugins = require('./plugins');


// Create a Hub with home store pointing to the package root directory
const homeStore = new olo.FileStore(`${__dirname}/..`);
const hub = new olo.Hub(homeStore);

// All the routes exported by the installed plugins are mounted to the hub
for (let plugin of plugins) {
    for (let route in Object(plugin.routes)) {
        hub.mount(route, plugin.routes[route]);
    }
}

// Exports the hub.
module.exports = hub;
