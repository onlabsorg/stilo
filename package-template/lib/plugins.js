const fs = require('fs');
const pathlib = require('path');

const packageJsonPath = pathlib.join(__dirname, '../package.json');

function getPackageJson () {
    const packageJsonText = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonText);
    if (!packageJson.stilo) packageJson.stilo = {};
    if (!packageJson.stilo.plugins) packageJson.stilo.plugins = [];
    return packageJson;
}


function updatePackageJson (packageJson) {
    const packageJsonText = JSON.stringify(packageJson, null, 4);
    fs.writeFileSync(packageJsonPath, packageJsonText, 'utf8');
}


module.exports = {
    
    get list () {
        return getPackageJson().stilo.plugins;
    },
    
    get (pluginName) {
        const plugin = require(pluginName).stilo || {};
        if (!plugin.routes) plugin.routes = {};
        if (!plugin.commands) plugin.commands = {};
        return plugin;
    },
    
    add (pluginName) {
        const packageJson = getPackageJson();
        if (packageJson.stilo.plugins.indexOf(pluginName) === -1) {
            packageJson.stilo.plugins.push(pluginName);
            updatePackageJson(packageJson);
        }
    },
    
    remove (pluginName) {
        const packageJson = getPackageJson();
        const pluginIndex = packageJson.stilo.plugins.indexOf(pluginName);
        if (pluginIndex !== -1) {
            packageJson.stilo.plugins.splice(pluginIndex, 1);
            updatePackageJson(packageJson);
        }
    },
    
    *[Symbol.iterator] () {
        for (let pluginName of this.list) {
            yield this.get(pluginName);
        }
    }    
}
