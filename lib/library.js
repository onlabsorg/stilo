
const fs = require('fs');
const ncp = require('ncp');
const Package = require('./package');


class Library {
    
    constructor (rootPath) {
        this.package = Package(rootPath);
    }
    
    async init () {
        const packagePath = this.package.resolvePath('./'); 
        
        if (fs.existsSync(packagePath)) {
            throw new Error("Library already initialized");
        }
        
        await cloneDirectory(`${__dirname}/../package-template`, packagePath);
        await this.package.exec('npm install');
    }
    
    async install (npmPackageName) {
        await this.package.exec(`npm install "${npmPackageName}" --save`);
    }
    
    mount (storeName, storeModulePath, ...args) {
        this.package.mountStore(storeName, storeModulePath, ...args);
    }
    
    unmount (storeName) {
        this.package.unmountStore(storeName);
    }
    
    async render (id) {
        const environment = this.package.environment;
        const doc = await environment.readDocument(id);
        const context = doc.createContext();
        const docNS = await doc.evaluate(context);
        return await environment.render(docNS);
    }
    
    async serve (type, port=8010) {
        const Server = this.package.getServer(type)
        const server = Server(this.package.environment);
        return new Promise((resolve, reject) => {
            server.listen(port, err => {
                if (err) reject(err); else resolve(server);
            });
        });
    }    
}


module.exports = Library;



// -----------------------------------------------------------------------------
//  SERVICE FUNCTIONS
// -----------------------------------------------------------------------------

function cloneDirectory (sourcePath, destPath) {
    fs.mkdirSync(destPath);
    return new Promise((resolve, reject) => {
        ncp(sourcePath, destPath, err => {
            if (err) reject(err); else resolve();
        });
    });
}
