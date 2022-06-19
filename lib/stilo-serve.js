
const pathlib = require('path');

module.exports = async (path, options) => {
    
    const Package = require('./package');
    const package = Package.find(process.cwd());
    const packageAPI = package.require('./');
    
    const rootPath = package.resolvePath('..');
    const rootStore = await packageAPI.getStore(rootPath);
    const cwp = `/${pathlib.relative(rootPath, process.cwd())}/`;
    const servedPath = rootStore.resolvePath(cwp, path);
    const store = SubStore(rootStore, servedPath);

    const server = await packageAPI.createServer(store);
    const port = options.port || 8010;
    server.listen(port, err => {
        if (err) throw (err);
        console.log(`Stilo HTTP server listening on port ${port}`);
    });
    
    return server;
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
