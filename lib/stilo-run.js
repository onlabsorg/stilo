const logger = require('./logger');

module.exports = async (commandName, ...args) => {
    try {
        const Package = require('./package');
        const package = Package.find(process.cwd());
        const packageAPI = package.require('./');
        return await packageAPI.run(commandName, ...args);        
    } catch (error) {
        logger.error(error);
    }
}
