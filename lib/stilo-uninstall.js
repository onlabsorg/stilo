
const logger = require('./logger');
const pathlib = require('path');
const fs = require('fs');


module.exports = async function (pluginName) {
    try {
        
        logger.info(`@stilo: locating repository package`);
        const Package = require('./package');
        const package = Package.find(process.cwd());
        const packageAPI = package.require('./');
        
        logger.info(`@stilo: running the pre-uninstall routine`);
        await packageAPI.beforePluginUninstall(pluginName);

        logger.info(`@stilo: uninstalling ${pluginName}`);
        await package.spawn('npm', 'uninstall', pluginName);
        
        logger.info('@stilo: running the post-uninstall routine');
        await packageAPI.afterPluginUninstall(pluginName);

        logger.info(`@stilo: ${pluginName} plugin uninstalled`);

    } catch (error) {
        logger.error(error);
    }
}
