
const logger = require('./logger');
const pathlib = require('path');
const fs = require('fs');


module.exports = async function (path, options={}) {
    try {
        
        // Detect the stilo package
        if (options.verbose) logger.debug(`Locating repository package ...`);
        const Package = require('./package');
        const package = Package.find(process.cwd());

        // Retrieve the store
        if (options.verbose) logger.debug(`Retrieving store ...`);
        const store = await package.getStore();

        // Fetch the document source
        const rootPath = package.resolvePath('..');
        const cwp = `/${pathlib.relative(rootPath, process.cwd())}/`;
        const docPath = store.resolvePath(cwp, path);
        if (options.verbose) logger.debug(`Fetching document from '${docPath}' ...`);
        const source = await store.read(docPath);
        
        // Output the source
        if (options.output) {
            const outputPath = pathlib.resolve(options.output);
            if (options.verbose) logger.debug(`Writing document source to '${outputPath}' ...`);
            fs.writeFileSync(outputPath, source, 'utf8');
        } else {
            if (options.verbose) logger.debug(`Writing document source to stdout ...`);
            logger.log(source);            
        }
        
        return source;

    } catch (error) {
        if (options.verbose) {
            logger.error(error);
        } else {
            logger.error(error.message);
        }
    }
}
