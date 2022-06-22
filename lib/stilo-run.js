const logger = require('./logger');

module.exports = async (commandName, options, ...args) => {
    
    if (isHelpRequest(commandName, options, args)) {
        logger.log('Usage: stilo run <command-name> [options] [args...]');
        logger.log('');
        logger.log('Arguments:');
        logger.log('  Command dependent.');
        logger.log('');
        logger.log('Options:');
        logger.log('  Command dependent.');
        logger.log('');
        return;
    }
    
    if (!isValidCommand(commandName)) {
        logger.error(`Invalid command: '${commandName || ""}'`);
        return;
    }
    
    try {
        const Package = require('./package');
        const package = Package.find(process.cwd());
        const packageAPI = package.require('./');
        return await packageAPI.run(commandName, options, ...args);        
    } catch (error) {
        logger.error(error);
    }
}


function isHelpRequest (commandName, options, args) {
    if (commandName && commandName !== '-h' && commandName !== '--help') return false;
    if (Object.keys(options).length !== 0) return false;
    if (args.length !== 0) return false;
    return true;
}

function isValidCommand (commandName) {
    return typeof commandName === 'string' && commandName[0] !== '-';
}
