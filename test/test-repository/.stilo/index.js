const pathlib = require('path');

module.exports = {
    
    async registerPlugin (pluginName) {
        const plugins = require('./lib/plugins');
        plugins.add(pluginName);
    },

    async getStore ( rootPath=pathlib.join(__dirname, '..') ) {
        const olo = require('@onlabsorg/olojs');
        const plugins = require('./lib/plugins');

        const routes = {
            '/'      : new olo.FileStore(rootPath),
            'http:/' : new olo.HTTPStore('http:/'),
            'https:/': new olo.HTTPStore('https:/'),
            'file:/' : new olo.FileStore('/'),
            'temp:/' : new olo.MemoryStore(),
        }

        for (let plugin of plugins) {
            for (let [path, store] of Object.entries(plugin.routes)) {
                routes[path] = typeof store === "function" ? await store() : store;
            }
        }

        return new olo.Router(routes);
    },

    async getCommands () {
        const plugins = require('./lib/plugins');

        const commands = {};

        for (let plugin of plugins) {
            for (let [commandName, command] of Object.entries(plugin.commands)) {
                if (typeof command == "function") {
                    commands[commandName] = command;
                }
            }
        }

        return commands;
    },

    async unregisterPlugin (pluginName) {
        const plugins = require('./lib/plugins');
        plugins.remove(pluginName);
    },
};
