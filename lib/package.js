const pathlib = require('path');
const fs = require('fs');
const child_process = require('child_process');


const isDirectory = path => fs.existsSync(path) && fs.lstatSync(path).isDirectory();

function isRootPath (path) {
    const {root, dir} = pathlib.parse(path);
    return root === dir;
}


// A Package object is a javascrisp interface to a npm package contained
// in a `.stilo` folder. The Package object has no knowledge of the type
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

    // Given a directory path, finds the closest stilo package root (i.e. the folder
    // containg the .stilo package), in the parent directory chain.
    static find (path) {
        path = pathlib.resolve(path);
        while (true) {
            let packagePath = pathlib.join(path, this.DIR_NAME);
            if (isDirectory(packagePath)) return new this(packagePath);
            if (isRootPath(path)) throw new Error(`'${this.DIR_NAME}' npm package not found`);
            path = pathlib.join(path, "..");
        }
    }

    async getStore () {
        const olo = this.require('@onlabsorg/olojs');

        const routes = {};

        const customRoutes = this.require("./").routes;
        for (let [path, store] of Object.entries(customRoutes)) {
            routes[path] = typeof store === "function" ? await store() : store;
        }

        const rootPath = this.resolvePath('..');
        routes['/'] = new olo.FileStore(rootPath);

        const protocols = this.require('./').protocols;
        protocols.home = new olo.Router(routes);

        return new olo.URIStore(protocols);
    }

    async getCommands () {
        const commands = {};

        const customCommands = this.require("./").commands;
        for (let [commandName, command] of Object.entries(customCommands)) {
            if (typeof command === "function") {
                commands[commandName] = command;
            }
        }

        return commands;

    }

    // The name of the directory that contain the stilo configuration npm-package
    static get DIR_NAME () {
        return ".stilo";
    }
}


module.exports = Package;
