const olojs = require('./olojs');
const config = require("./package.json").olojs || {};



// SUPPORT FUNCTIONS
const isObject = obj => obj && typeof obj === 'object' && !Array.isArray(obj);
const extend = (parent, child) => Object.assign(Object.create(parent), child);



// CREATE THE ENVIRONMENT EXPORT
const stores = {};

// Load the custom stores from the package.json configuration
if (isObject(config.stores)) {
    for (let [store_name, package_name] of Object.entries(config.stores)) {
        customStore[store_name] = require(package_name);
    }
}

// Add the default stores
Object.assign(stores, {
    home: new olojs.stores.FS(`${__dirname}/..`),
    temp: new olojs.stores.Memory(),
    http: new olojs.stores.HTTP('http://'),
    https: new olojs.stores.HTTP('https://')
});

// Construct the environment and export it
exports.environment = new olojs.Environment({
    globals: isObject(config.globals) ? require(config.globals) : {},
    store: new olojs.stores.Router(stores)
});   



// ENVIRONMENT SERVERS
const servers = {};

// Load the custom servers defined in package.json
if (isObject(config.servers)) {
    for (let [server_name, package_name] of Object.entries(config.servers)) {
        servers[server_name] = require(package_name);
    }
}

// Add the default server and export
exports.servers = Object.assign(servers, {
    http: olojs.servers.http
});
