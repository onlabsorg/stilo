const config = require('./package.json').olojs;
module.exports = config.plugins.map(packageId => require(packageId));