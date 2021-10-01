const olo = require('@onlabsorg/olojs');
const plugins = require('./plugins');

const pathlib = require('path');


module.exports = async (homePath) => {
    
    // Create a Hub with home store pointing to the passed directory path
    const homeStore = new olo.FileStore(homePath);
    const hub = new olo.Hub(homeStore);
    
    // Decorates the hub with all the __init__ functions installed as plugin
    for (let plugin of plugins) {
        if (typeof plugin.__init__ === "function") {
            
            try {
                await plugin.__init__(hub);                
            } catch (err) {
                console.error(err);
            }
        }
    }
    
    return hub;
}

