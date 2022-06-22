
const logger = require('./logger');
const pathlib = require('path');
const fs = require('fs');


module.exports = async function (packageId, options={}) {
    if (packageId[0] === '.') {
        packageId = pathlib.join(process.cwd(), packageId);
    }

    try {        
        logger.info(`Installing plugin from: ${packageId}`);

        // Detect stilo package instance
        if (options.verbose) logger.debug(`Locating repository package ...`);
        const Package = require('./package');
        const package = Package.find(process.cwd());
        const packageAPI = package.require('./');
        
        // Install the npm package
        if (options.verbose) logger.debug('Running the pre-install routine ...');
        await packageAPI.beforePluginInstall(packageId);

        if (options.verbose) logger.debug(`Installing ${packageId} from npm ...`);
        await package.spawn('npm', 'install', packageId, '--save');
        
        if (options.verbose) logger.debug('Running the post-install routine ...');
        const pluginName = package.require(`${packageId}/package.json`).name;
        await packageAPI.afterPluginInstall(pluginName);

        logger.info(`Plugin successfully installed: '${pluginName}'`);

    } catch (error) {
        if (options.verbose) {
            logger.error(error);
        } else {
            logger.error(error.message);
        }
    }
}






// run npm install
