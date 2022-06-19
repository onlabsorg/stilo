
const Package = require('./package');
const logger = require('./logger');
const pathlib = require('path');
const fs = require('fs');
const ncp = require('ncp');


module.exports = async function () {
    try {
        const packagePath = pathlib.resolve(process.cwd(), Package.DIR_NAME);
        if (fs.existsSync(packagePath)) {
            throw new Error("@stilo: Package already initialized");
        }

        logger.info(`@stilo: creating the package`);
        await cloneDirectory(`${__dirname}/../package-template`, packagePath);
        const package = new Package(packagePath);
        
        logger.info(`@stilo: installing dependencies`);
        await package.spawn('npm', 'install');

        logger.info(`@stilo: running the post-init routine`);
        const packageAPI = package.require('./');
        await packageAPI.afterInit();

        logger.info("@stilo: Package successfully initialized.");

    } catch (error) {
        logger.error(error.message);
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
