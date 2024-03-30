/**
 *  *stilo render* command
 *  ============================================================================
 *
 *  Given a document path, the *render* command fetches a document from the
 *  repository, renders it and prints its rendered text to the stdout.
 *
 *  ```
 *  stilo render <path>
 *  ```
 *
 *  If the *path* argument is an absolute path, it will be considered relative
 *  to the repository root. If, instead, the *path* argument is a relative
 *  path it will be considered relative to the current working directory.
 *
 *  In order to write the rendered document to a file, the `--output` option can
 *  be used:
 *
 *  ```
 *  stilo render <path> --output <file-path>
 *  ```
 *
 *  Finally,
 *  - the `--help` option will display a help message
 *  - the `--verbose` option will display a detailed log of the command
 */

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

        // Load the document
        const olo = await package.require('@onlabsorg/olojs');
        const rootPath = package.resolvePath('..');
        const cwp = `/${pathlib.relative(rootPath, process.cwd())}/`;
        const docPath = store.resolvePath(cwp, path);
        if (options.verbose) logger.debug(`Fetching and evaluating document from '${docPath}' ...`);
        const doc = await olo.document.load(store, docPath);

        // Evaluate document
        if (options.verbose) logger.debug(`Rendering document '${docPath}' ...`);
        const docContext = doc.createContext();
        const docNamespace = await doc.evaluate(docContext);
        const text = docNamespace.__str__;
        
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
