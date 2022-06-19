
const logger = require('./logger');
const pathlib = require('path');


module.exports = async function (path) {
    try {
        const Package = require('./package');
        const package = Package.find(process.cwd());
        const packageAPI = package.require('./');
        
        const rootPath = package.resolvePath('..');
        const store = await packageAPI.getStore(rootPath);
        
        const cwp = `/${pathlib.relative(rootPath, process.cwd())}/`;
        const docPath = store.resolvePath(cwp, path);
        const source = await store.read(docPath);
        
        logger.log(source);

    } catch (error) {
        logger.error(error.message);
    }
}
