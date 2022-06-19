
const pathlib = require('path');
const logger = require('./logger');

module.exports = async (path, options={}) => {
    try {                
        logger.info(`Starting the HTTP server ...`);

        // Detect stilo package
        if (options.verbose) logger.debug(`Locating repository package ...`);
        const Package = require('./package');
        const package = Package.find(process.cwd());
        const packageAPI = package.require('./');
        
        // Create store
        if (options.verbose) logger.debug(`Creating the store ...`);
        const rootPath = package.resolvePath('..');
        const rootStore = await packageAPI.getStore(rootPath);
        const cwp = `/${pathlib.relative(rootPath, process.cwd())}/`;
        const servedPath = path ? rootStore.resolvePath(cwp, path) : '/';
        const store = SubStore(rootStore, servedPath);

        // Start the server
        if (options.verbose) logger.debug(`Serving the store path '${servedPath}' ...`);
        const server = await packageAPI.createServer(store);
        const port = options.port || 8010;
        server.listen(port, err => {
            if (err) throw (err);
            logger.info(`Stilo HTTP server listening on port ${port}`);
        });
        
        return server;
    } catch (error) {
        if (options.verbose) {
            logger.error(error);
        } else {
            logger.error(error.message);
        }
    }
}


function SubStore (rootStore, path='/') {
    
    if (!path || pathlib.normalize(path) === '/') {
        return rootStore;
    }
    
    const store = Object.create(rootStore);
    const fullPath = subPath => pathlib.join('/', path, pathlib.normalize(`/${subPath}`))
    store.read = subPath => rootStore.read(fullPath(subPath));
    store.write = (subPath, source) => rootStore.write(fullPath(subPath), source);
    store.delete = subPath => rootStore.delete(fullPath(subPath));
    return store;
}
