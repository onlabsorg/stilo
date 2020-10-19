const Path = require('path');
const fs = require('fs');
const ncp = require('ncp');
const child_process = require('child_process');

const configDirName = ".olonv";


class Repository {
    
    constructor (rootPath) {
        this.rootPath = Path.join('/', rootPath);
    }
    
    async init () {
        if (fs.existsSync( this.resolvePath() ) ) {
            throw new Error("Repository already initialized");
        }
        
        await cloneDirectory(`${__dirname}/../templates`, this.resolvePath());
        await this.exec('npm install');
    }
    
    get environment () {
        return this.require('index').environment;
    }
    
    get servers () {
        return this.require('index').servers;
    }
    
    async render (id) {
        const doc = await this.environment.readDocument(id);
        const context = doc.createContext();
        const docNS = await doc.evaluate(context);
        return await this.environment.render(docNS);
    }
    
    async serve (type='http', port=8010) {
        const Server = this.servers[type] || this.require('olojs').servers.http;
        const server = Server(this.environment);
        return new Promise((resolve, reject) => {
            server.listen(port, err => {
                if (err) reject(err); else resolve(server);
            });
        });
    }
    
    
    
    // UTILITY METHODS
    
    resolvePath (...subPaths) {
        return Path.join(this.rootPath, configDirName, ...subPaths);
    }
    
    require (modulePath) {
        const fullModulePath = this.resolvePath(modulePath);
        return require(fullModulePath);
    }
    
    exec (command) {
        return new Promise((resolve, reject) => {
            let options = {
                cwd: this.resolvePath()
            };
            child_process.exec(command, options, (error, stdout, stderr) => {
                if (error) reject(error); else resolve();
            });
        });        
    }    
}


module.exports = Repository;


function cloneDirectory (sourcePath, destPath) {
    fs.mkdirSync(destPath);
    return new Promise((resolve, reject) => {
        ncp(sourcePath, destPath, err => {
            if (err) reject(err); else resolve();
        });
    });
}
