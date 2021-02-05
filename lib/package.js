const pathlib = require('path');
const fs = require('fs');
const ncp = require('ncp');
const child_process = require('child_process');


// A Package object is a javascrisp interface to a npm package contained
// in a `.olojs` folder. The Package object has no knowledge of the type
// of content of the package: it exposes only general handlers valid for
// any npm package.
class Package {

    constructor (path) {
        this.path = pathlib.resolve(path);
    }

    // Resolve a relative path to the package root path into an absolute path
    resolvePath (subPath) {
        return pathlib.join(this.path, subPath);
    }

    // Returns the absolute path of a package module
    resolveModulePath (subPath) {
        return require.resolve(subPath, {
            paths: [ this.path ]
        });
    }

    // Returns a package module
    require (modulePath) {
        return require( this.resolveModulePath(modulePath) );
    }

    // Returns the package main module
    get config () {
        const config = this.require('./config');
        const routes = Object.assign({}, config.routes);
        const servers = Object.assign({}, config.servers);
        const plugins = this._getPluginNames()
                .map(pluginName => this.require(pluginName));
        for (let plugin of plugins) {
            if (isObject(plugin.routes)) Object.assign(routes, plugin.routes);
            if (isObject(plugin.servers)) Object.assign(servers, plugin.servers);
        }
        return {routes, servers};
    }

    // Returns the olojs library module
    get olojs () {
        return this.require('@onlabsorg/olojs');
    }

    // Returns the package store
    get store () {
        return new this.olojs.Router(this.config.routes);
    }

    // Executes a command in the package working directory
    spawn (command, ...args) {
        return new Promise((resolve, reject) => {
            const options = {
                cwd: this.path,
                stdio: 'inherit'
            };
            const proc = child_process.spawn(command, args, options);
            proc.on('error', e => reject(e));
            proc.on('close', code => resolve(code));
        });
    }

    // Install a new npm package as dependecy of the .olojs package
    async install (packageId) {
        await this.spawn('npm', 'install', packageId, '--save');
        const pluginName = this.require(`${packageId}/package.json`).name;
        const pluginNames = this._getPluginNames();
        if (pluginNames.indexOf(pluginName) === -1) {
            pluginNames.push(pluginName);
            this._setPluginNames(pluginNames);
        }
    }

    // Uninstall a new npm package as dependecy of the .olojs package
    async uninstall (pluginName) {
        const pluginNames = this._getPluginNames();
        const pluginIndex = pluginNames.indexOf(pluginName);
        if (pluginIndex === -1) {
            throw new Error(`Plugin not found: ${pluginName}`);
        }
        await this.spawn('npm', 'uninstall', pluginName);
        pluginNames.splice(pluginIndex, 1);
        this._setPluginNames(pluginNames);
    }


    // This internal function returns the list of the installed plugins
    _getPluginNames () {
        return this.require('./config/plugins.json');
    }

    // This internal function modifies the list of the installed plugins
    _setPluginNames (pluginNames) {
        const pluginNamesPath = this.resolveModulePath('./config/plugins.json');
        writeJsonFile(pluginNamesPath, pluginNames);
    }


    // The name of the directory that contain the olojs configuration npm-package
    static get DIR_NAME () {
        return ".olojs";
    }

    // Turns the directory at the given path in a olojs package
    static async create (path) {
        const packagePath = pathlib.resolve(path, this.DIR_NAME);
        if (fs.existsSync(packagePath)) {
            throw new Error("@olojs: Package already initialized");
        }
        await cloneDirectory(`${__dirname}/../package-template`, packagePath);
        const pkg = new this(packagePath);
        await pkg.spawn('npm', 'install');
        return pkg;
    }

    // Given a directory path, finds the closest olojs package root (i.e. the folder
    // containg the .olojs package), in the parent directory chain.
    static find (path) {
        path = pathlib.resolve(path);
        while (true) {
            let packagePath = pathlib.join(path, this.DIR_NAME);
            if (isDirectory(packagePath)) return new this(packagePath);
            if (isRootPath(path)) throw new Error(`'${this.DIR_NAME}' npm package not found`);
            path = pathlib.join(path, "..");
        }
    }
}

module.exports = Package;


// -----------------------------------------------------------------------------
//  SERVICE FUNCTIONS
// -----------------------------------------------------------------------------

function isRootPath (path) {
    const {root, dir} = pathlib.parse(path);
    return root === dir;
}

const isDirectory = path => fs.existsSync(path) && fs.lstatSync(path).isDirectory();

const isObject = x => x && typeof x === "object" && !isArray(x);
const isArray = x => Array.isArray(x);

function writeJsonFile (path, object) {
    const content = JSON.stringify(object, null, 4);
    fs.writeFileSync(path, content, 'utf8');
}

function cloneDirectory (sourcePath, destPath) {
    fs.mkdirSync(destPath);
    return new Promise((resolve, reject) => {
        ncp(sourcePath, destPath, err => {
            if (err) reject(err); else resolve();
        });
    });
}
