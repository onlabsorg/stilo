const pathlib = require('path');

module.exports = {
    
    async afterInstall (pluginName) {
        const plugins = require('./lib/plugins');
        plugins.add(pluginName);
    },

    get routes () {
        const olo = require('@onlabsorg/olojs');
        const plugins = require('./lib/plugins');

        const routes = {
            'http:/' : new olo.HTTPStore('http:/'),
            'https:/': new olo.HTTPStore('https:/'),
            'file:/' : new olo.FileStore('/'),
            'temp:/' : new olo.MemoryStore(),
        }

        for (let plugin of plugins) {
            Object.assign(routes, plugin.routes);
        }

        return routes;
    },

    get commands () {
        const commands = require('./bin/index.js');

        const plugins = require('./lib/plugins');
        for (let plugin of plugins) {
            Object.assign(commands, plugin.commands);
        }

        return commands;
    },

    async beforeUninstall (pluginName) {
        const plugins = require('./lib/plugins');
        plugins.remove(pluginName);
    },
};
