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
    
    spawn (command, ...args) {
        const child_process = require('child_process');
        return new Promise((resolve, reject) => {
            const options = {
                cwd: this.resolvePath('.'),
                stdio: 'inherit'
            };
            const proc = child_process.spawn(command, args, options);
            proc.on('error', e => reject(e));
            proc.on('close', code => resolve(code));
        });        
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
    
    mountStore (storePath, storeModulePath, ...args) {
        const normStorePath = pathlib.normalize(`/${storePath}/`);
        const config = this.getPackageConfig('.');
        config.routes = isObject(config.routes) ? config.routes : {};        
        config.routes[normStorePath] = [storeModulePath, ...args];
        this.updateGlobalConfig(config);
    },

    unmountStore (storePath) {
        const normStorePath = pathlib.normalize(`/${storePath}/`);
        const config = this.getPackageConfig('.');
        if (isObject(config.routes) && config.routes[normStorePath]) {
            delete config.routes[normStorePath];
            this.updateGlobalConfig(config);
        } else {
            throw new Error(`Mount point not found: ${normStorePath}`);
        }
    },

    get store () {
        const config = this.getPackageConfig('.');        
        const routes = {};
        if (isObject(config.routes)) {
            for (let path in config.routes) {
                const [modulePath, ...args] = config.routes[path];
                const Store = this.require(modulePath);
                routes[path] = new Store(...args);            
            }
        }
        routes['/'] = new this.olojs.stores.File(rootPath);
        return new this.olojs.stores.Router(routes);
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
