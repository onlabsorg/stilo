
const logger = require('./logger');
const pathlib = require('path');
const fs = require('fs');


module.exports = async function (pluginName, options={}) {
    try {
        logger.info(`Removing plugin: '${pluginName}'`)
        
        // Detect stilo package instance
        if (options.verbose) logger.debug(`Locating repository package ...`);
        const Package = require('./package');
        const package = Package.find(process.cwd());
        const packageAPI = package.require('./');
        
        // Uninstall npm package
        if (options.verbose) logger.debug(`Running the pre-uninstall routine ...`);
        await packageAPI.beforePluginUninstall(pluginName);

        if (options.verbose) logger.debug(`Uninstalling ${pluginName} ...`);
        await package.spawn('npm', 'uninstall', pluginName);
        
        if (options.verbose) logger.debug('Running the post-uninstall routine ...');
        await packageAPI.afterPluginUninstall(pluginName);

        logger.info(`Plugin removed: '${pluginName}'`);

    } catch (error) {
        if (options.verbose) {
            logger.error(error);
        } else {
            logger.error(error.message);
        }
    }
}