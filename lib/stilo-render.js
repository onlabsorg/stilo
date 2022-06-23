
const logger = require('./logger');
const pathlib = require('path');
const fs = require('fs');


module.exports = async function (path, options={}) {
    try {
        
        // Detect the stilo package
        if (options.verbose) logger.debug(`Locating repository package ...`);
        const Package = require('./package');
        const package = Package.find(process.cwd());
        const packageAPI = package.require('./');
        
        // Retrieve the store
        if (options.verbose) logger.debug(`Retrieving store ...`);
        const rootPath = package.resolvePath('..');
        const store = await packageAPI.getStore(rootPath);
        
        // Load the document source
        const cwp = `/${pathlib.relative(rootPath, process.cwd())}/`;
        const docPath = store.resolvePath(cwp, path);
        if (options.verbose) logger.debug(`Fetching, parsing and evaluating document from '${docPath}' ...`);
        const {text} = await store.load(docPath);
        
        // Output the rendered text
        if (options.output) {
            const outputPath = pathlib.resolve(options.output);
            if (options.verbose) logger.debug(`Writing rendered document to '${outputPath}' ...`);
            fs.writeFileSync(outputPath, text, 'utf8');
        } else {
            if (options.verbose) logger.debug(`Writing rendered document to stdout ...`);
            logger.log(text);
        }

        return text;

    } catch (error) {
        if (options.verbose) {
            logger.error(error);
        } else {
            logger.error(error.message);
        }
    }
}
