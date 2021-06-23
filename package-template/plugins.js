
// Retrieve the list of the installed plugin package names from the 
// stilo.plugins field of package.json
const config = require('./package.json').stilo;

// Load and export an array containing all the available plugin packages.
module.exports = config.plugins.map(packageId => require(packageId).stilo || {});