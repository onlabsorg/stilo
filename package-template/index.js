const pathlib = require('path');

module.exports = {
    
    async getStore ( rootPath=pathlib.join(__dirname, '..') ) {
        const olo = require('@onlabsorg/olojs');
        const plugins = require('./lib/plugins');

        const store = new olo.Router({
            '/'      : new olo.FileStore(rootPath),
            'http:/' : new olo.HTTPStore('http:/'),
            'https:/': new olo.HTTPStore('https:/'),
            'file:/' : new olo.FileStore('/'),
            'temp:/' : new olo.MemoryStore(),
        });
        
        for (let plugin of plugins) {
            if (typeof plugin.__init__ === 'function') {
                await plugin.__init__(store);
            }
        }
        
        return store;
    },
    
    async createServer (store) {
        const olo = require('@onlabsorg/olojs');
        return olo.HTTPServer.create(store);
    },
    
    get commands () {
        const plugins = require('./lib/plugins');
        
        const commands = {};
        
        for (let plugin of plugins) {
            for (let commandName in plugin) {
                if (commandName[0] !== "_" && typeof plugin[commandName] == "function") {
                    commands[commandName] = plugin[commandName];
                }
            }
        }
        
        return commands;
    },
    
    async run (commandName, options, ...args) {
        const command = this.commands[commandName];
        if (command) {
            const rootPath = pathlib.join(__dirname, '..');
            const store = await this.getStore(rootPath);
            store.stiloRootPath = rootPath;
            return await command(store, options, ...args);
        } else {
            throw new Error(`Unknown command: '${commandName}'`);
        }
    },

    async beforeInit () {},
    
    async afterInit () {},
    
    async beforePluginInstall (npmPackageId) {},

    async afterPluginInstall (pluginName) {
        const plugins = require('./lib/plugins');
        plugins.add(pluginName);
    },

    async beforePluginUninstall (pluginName) {},

    async afterPluginUninstall (pluginName) {
        const plugins = require('./lib/plugins');
        plugins.remove(pluginName);
    }
};
