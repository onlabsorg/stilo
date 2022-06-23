const logger = require('./logger');

module.exports = async (commandName, options, ...args) => {
    try {
        const Package = require('./package');
        const package = Package.find(process.cwd());
        const packageAPI = package.require('./');
        
        if (!commandName || commandName === '-h' || commandName === '--help') {
            logger.log('Usage: stilo run <command-name> [options] [args...]');
            logger.log('');
            logger.log('Commands:');
            for (let cname of Object.keys(packageAPI.commands).sort()) {
                console.log(`  stilo-run ${cname} [options] [args...]`);
            }
            logger.log('');
            logger.log('Options:');
            logger.log('  -h, --help     print this help message');
            
        } else {
            return await packageAPI.run(commandName, options, ...args);        
        }
    } catch (error) {
        logger.error(error.message);
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
