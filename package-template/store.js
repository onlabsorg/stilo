const olojs = require('@onlabsorg/olojs');
const plugins = require('./plugins');



const routes = {
    '/': new olojs.FileStore(`${__dirname}/..`),
};

for (let plugin of plugins) Object.assign(routes, plugin.routes);



const protocols = {
    'http':     new olojs.HTTPStore('http:/'),
    'https':    new olojs.HTTPStore('https:/'),
};

for (let plugin of plugins) Object.assign(protocols, plugin.protocols);



module.exports = new olojs.Router(routes, protocols);
