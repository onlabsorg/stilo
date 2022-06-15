const pathlib = require('path');
const fs = require('fs');
const ncp = require('ncp');
const child_process = require('child_process');


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

    // Install a new npm package as dependecy of the .stilo package
    async install (packageId) {
        
        // run npm install
        await this.spawn('npm', 'install', packageId, '--save');
        
        // add the plugin name to the list of the installed plugins
        const packageJson = this.require('./package.json');
        const pluginName = this.require(`${packageId}/package.json`).name;
        if (packageJson.stilo.plugins.indexOf(pluginName) === -1) {
            packageJson.stilo.plugins.push(pluginName);
            writeJsonFile(this.resolveModulePath('./package.json'), packageJson);
        }
    }

    // Uninstall a new npm package as dependecy of the .stilo package
    async uninstall (pluginName) {
        var packageJson = JSON.parse(fs.readFileSync(this.resolvePath('./package.json'), 'utf8'));
        const pluginIndex = packageJson.stilo.plugins.indexOf(pluginName);
        if (pluginIndex === -1) {
            throw new Error(`Plugin not found: ${pluginName}`);
        }
        
        await this.spawn('npm', 'uninstall', pluginName);
        packageJson = this.require('./package.json');
        packageJson.stilo.plugins.splice(pluginIndex, 1);
        writeJsonFile(this.resolveModulePath('./package.json'), packageJson);
    }
    
    
    async getStore (rootPath='/') {
        const Store = this.require('./store');
        const homePath = this.resolvePath('..');
        const homeStore = await Store(homePath);
        return SubStore(homeStore, homePath, rootPath);        
    }


    // The name of the directory that contain the stilo configuration npm-package
    static get DIR_NAME () {
        return ".stilo";
    }

    // Turns the directory at the given path in a stilo package
    static async create (path) {
        const packagePath = pathlib.resolve(path, this.DIR_NAME);
        if (fs.existsSync(packagePath)) {
            throw new Error("@stilo: Package already initialized");
        }
        await cloneDirectory(`${__dirname}/package-template`, packagePath);
        const pkg = new this(packagePath);
        await pkg.spawn('npm', 'install');
        return pkg;
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
}


module.exports = {Package};


// -----------------------------------------------------------------------------
//  SERVICE FUNCTIONS
// -----------------------------------------------------------------------------

function SubStore (homeStore, homePath, rootPath) {
    const store = Object.create(homeStore);
    
    const cwd = pathlib.join('/', process.cwd().slice(homePath.length));

    const fullPath = path => pathlib.join(`/${rootPath}`, path);    
    
    store.resolveRelativePath = path => {
        if (path[0] === '/' || path.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/(.*)$/)) {
            return path;
        } else {
            return pathlib.join(cwd, path);
        }
    }
    
    store.read = path => homeStore.read(fullPath(path));
    
    store.write = (path, source) => homeStore.write(fullPath(path), source);
    
    store.delete = path => homeStore.delete(fullPath(path), path);
            
    store.subStore = path => {
        const rootPath = fullPath(store.resolveRelativePath(path));
        return SubStore(homeStore, homePath, rootPath);
    }
    
    return store;
}

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
