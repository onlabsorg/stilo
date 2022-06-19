
const logger = require('./logger');
const pathlib = require('path');
const fs = require('fs');


module.exports = async function (packageId) {
    if (packageId[0] === '.') {
        packageId = pathlib.join(process.cwd(), packageId);
    }

    try {
        
        logger.info(`@stilo: locating repository package`);
        const Package = require('./package');
        const package = Package.find(process.cwd());
        const packageAPI = package.require('./');
        
        logger.info('@stilo: running the pre-install routine');
        await packageAPI.beforePluginInstall(packageId);

        logger.info(`@stilo: installing ${packageId} from npm`);
        await package.spawn('npm', 'install', packageId, '--save');
        
        logger.info('@stilo: running the post-install routine');
        const pluginName = package.require(`${packageId}/package.json`).name;
        await packageAPI.afterPluginInstall(pluginName);

        logger.info(`@stilo: ${packageId} plugin installed`);

    } catch (error) {
        logger.error(error);
    }
}






// run npm install
