

module.exports = async (commandName, ...args) => {
    const Package = require('./package');
    const package = Package.find(process.cwd());
    const packageAPI = package.require('./');
    return await packageAPI.run(commandName, ...args);
}
