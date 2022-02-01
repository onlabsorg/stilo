const olo = require('@onlabsorg/olojs');
const pathlib = require('path');


module.exports = async (rootPath) => {
    
    // Create a Hub with home store pointing to the passed directory path
    const store = new olo.Router({
        '/': new olo.FileStore(rootPath),
        'http:/': new olo.HTTPStore('http:/'),
        'https:/': new olo.HTTPStore('https:/'),
        'file:/': new olo.FileStore('/'),
        'temp:/': new olo.MemoryStore(),
    });
    
    // Decorates the store with all the __init__ functions installed as plugin
    const plugins = require('./plugins');
    for (let plugin of plugins) {
        if (typeof plugin.__init__ === "function") {
            
            try {
                await plugin.__init__(store);                
            } catch (err) {
                console.error(err);
            }
        }
    }
    
    return store;
}

