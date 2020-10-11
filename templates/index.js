const olojs = require('./olojs');
const config = require("./package.json").olonv;


// Load the protocol handlers from the npm packages defined in config.json
const protocols = {};
for (let [scheme, package_name] of Object.entries(config.protocols)) {
    protocols[scheme] = require(package_name);
    protocols.home = {
        get: path => olojs.protocols.file.get(`${__dirname}/../${path}`),
        set: (path, source) => olojs.protocols.file.set(`${__dirname}/../${path}`, source),
        delete: path => olojs.protocols.file.delete(`${__dirname}/../${path}`),
    }
}


// Create the repository environmet, defined by the options in config.json
const environment = olojs.Environment({
    protocols: protocols,
    routes: config.routes,
    globals: config.globals ? require(config.globals) : {}
});              


// Extend the environment with the ability to load one of the servers
// defined in config.json
environment.createServer = function (type="http") {
    const Server = require(config.servers[type]);
    return Server(this);
}      


// Export the repository environment
module.exports = environment;
