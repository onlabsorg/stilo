const logger = require('./logger');
const pathlib = require('path');

module.exports = async (commandName, options, ...args) => {
    try {
        const Package = require('./package');
        const package = Package.find(process.cwd());

        if (!commandName || commandName === '-h' || commandName === '--help') {
            logger.log('Usage: stilo run <command-name> [options] [args...]');
            logger.log('');
            logger.log('Commands:');
            for (let commandHelpLine of listCommands(await package.getCommands())) {
                console.log(`  ${commandHelpLine}`);
            }
            logger.log('');
            logger.log('Options:');
            logger.log('  -h, --help     print this help message');
            
        } else {
            const commands = await package.getCommands();
            if (!commands[commandName]) throw new Error(`Unknown command: '${commandName}'`);

            const store = await package.getStore();
            const rootPath = package.resolvePath('..');
            const cwp = `/${pathlib.relative(rootPath, process.cwd())}/`;
            return await commands[commandName](store, cwp, options, ...args);
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

function* listCommands (commands) {
    const commandNames = Object.keys(commands).sort();
    const cmdColumnWidth = Math.max(...commandNames.map(name => name.length)) + 4;
    if (commandNames.length > 0) {
        for (let cname of commandNames) {
            const description = getCommandDescription(commands[cname])
            yield cname + ' '.repeat(cmdColumnWidth-cname.length) + description;
        }                
    } else {
        yield `No commands installed.`;
    }    
}

function getCommandDescription (command) {
    const match = command.toString().match(/\/\/\/\s*(.*)\s*\n/);
    return match ? match[1] : "";
}
