
// Retrieve the list of the installed plugin package names from the 
// olojs.plugins field of package.json
const config = require('./package.json').olojs;

// Load and export an array containing all the available plugin packages.
module.exports = config.plugins.map(packageId => require(packageId));