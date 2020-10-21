const pathlib = require('path');
const fs = require('fs');

const configDirName = ".olojs";

module.exports = rootPath => ({
    
    resolvePath (subPath) {
        return pathlib.join(rootPath, configDirName, subPath);
    },
    
    resolveModulePath (subPath) {
        return require.resolve(subPath, {
            paths: [ pathlib.join(rootPath, configDirName) ]
        }); 
    },
    
    require (modulePath) {
        return require( this.resolveModulePath(modulePath) );
    },
    
    get olojs () {
        return this.require('@onlabsorg/olojs');
    },
    
    getPackageJson (packagePath) {
        return this.require(`${packagePath}/package.json`);
    },
    
    getPackageConfig (packagePath) {
        return this.getPackageJson(packagePath).olojs;
    },
    
    updateGlobalConfig (config) {
        const globalPackageJson = this.getPackageJson('.');
        globalPackageJson.olojs = config;
        fs.writeFileSync(this.resolvePath('package.json'), JSON.stringify(globalPackageJson, null, 4), 'utf8');
    },

    exec (command) {
        const child_process = require('child_process');
        return new Promise((resolve, reject) => {
            const options = {
                cwd: this.resolvePath('.')
            };
            child_process.exec(command, options, (error, stdout, stderr) => {
                if (error) reject(error); else resolve();
            });
        });        
    },
    
    getServer (serverId) {
        if (serverId) {
            return this.require(serverId);            
        } else {
            const config = this.getPackageConfig('.');
            return this.require(config.server);
        }
    },
    
    mountStore (storeName, storeModulePath, ...args) {
        const config = this.getPackageConfig('.');
        config.store = isObject(config.store) ? config.store : {};
        config.store[storeName] = [storeModulePath, ...args];
        this.updateGlobalConfig(config);
    },

    unmountStore (storeName) {
        const config = this.getPackageConfig('.');
        if (isObject(config.store) && config.store[storeName]) {
            delete config.store[storeName];
            this.updateGlobalConfig(config);
        } else {
            throw new Error(`No mount point /${storeName} fount`);
        }
    },

    loadStore (config) {
        if (Array.isArray(config)) {
            const [modulePath, ...args] = config;
            const Store = this.require(modulePath);
            return new Store(...args);
        } else if (isObject(config)) {
            const routes = mapObjProps(config, this.loadStore.bind(this));
            return new this.olojs.stores.Router(routes);
        }
    }, 
    
    get store () {
        const config = this.getPackageConfig('.');
        if (!isObject(config.store)) config.store = {};
        config.store.home = ['@onlabsorg/olojs/lib/stores/fs', rootPath];
        return this.loadStore(config.store);
    },    
    
    get globals () {
        const config = this.getPackageConfig('.');
        return typeof config.globals === 'string' ? this.require(config.globals) : {};
    },
    
    get environment () {
        return new this.olojs.Environment({
            globals: this.globals,
            store: this.store
        })
    }
});


const entries = o => isObject(o) ? Object.entries(o) : [];
const isObject = o => o && typeof o === 'object' && !Array.isArray(o);

const mapObjProps = (o, f) => {
    const img = {};
    for (let [key, value] of entries(o)) {
        img[key] = f(value);
    }
    return img;
}

const splitPath = path => {
    let i = path.indexOf('/');
    return [path.slice(0,i), path.slice(i+1)];
}
