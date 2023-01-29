
const Package = require('./package');
const logger = require('./logger');
const pathlib = require('path');
const fs = require('fs');
const ncp = require('ncp');
const rimraf = require('rimraf');


module.exports = async function (options) {

    try {
        const packagePath = pathlib.resolve(process.cwd(), Package.DIR_NAME);
        
        // Eventually handle pre-existing repository data
        if (fs.existsSync(packagePath)) {
            if (options.force) {
                logger.info(`Deleting existing stilo package instance ...`);
                rimraf.sync(packagePath);
            } else {
                logger.error("Repository already initialized!");
                logger.info("Use the `--force` option to overwrite the existing stilo package instance.");
                return;
            }
        }

        // Create the .stilo directory
        logger.info(`Initializing the current directory as stilo repository ...`);
        if (options.verbose) logger.debug("cloning directory ...");
        await cloneDirectory(`${__dirname}/../package-template`, packagePath);
        
        // Get the package interface
        if (options.verbose) logger.debug("loading package interface ...");
        const package = new Package(packagePath);

        // Install the npm dependencies
        if (options.verbose) logger.debug(`Installing dependencies ...`);
        await package.spawn('npm', 'install');

        logger.info("Repository successfully initialized!");

    } catch (error) {
        if (options.verbose) {
            logger.error(error);
        } else {
            logger.error(error.message);
        }
    }
}


function cloneDirectory (sourcePath, destPath) {
    fs.mkdirSync(destPath);
    return new Promise((resolve, reject) => {
        ncp(sourcePath, destPath, err => {
            if (err) reject(err); else resolve();
        });
    });
}
