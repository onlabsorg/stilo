/**
 *  *stilo install* command
 *  =============================================================================
 *
 *  The *install* command installs a plugin in the active repository.
 *
 *  ```
 *  stilo install <plugin-id>
 *  ```
 *
 *  where *plugin-id* is any valid *npm* package exporting a `stilo` object that
 *  contains a *stilo.routes* object and a *stilo.commands* object.
 *
 *  After installing the plugin npm package, the *install* command will call the
 *  `.stilo.afterInstall` function passing the name of the installed package,
 *  allowing the repository package to perform custom initialization actions.
 *
 *  > For more information about stilo plugins, see the
 *  > [package documentation](../package-template/README.md).
 *
 *  Finally,
 *  - the `--help` option will display a help message
 *  - the `--verbose` option will display a detailed log of the command
 */

const logger = require('./logger');
const pathlib = require('path');
const fs = require('fs');


module.exports = async function (packageId, options={}) {
    if (packageId[0] === '.') {
        packageId = pathlib.join(process.cwd(), packageId);
    }

    try {        
        logger.info(`Installing plugin from: ${packageId}`);

        // Detect stilo package instance
        if (options.verbose) logger.debug(`Locating repository package ...`);
        const Package = require('./package');
        const package = Package.find(process.cwd());

        // Install the npm package
        if (options.verbose) logger.debug(`Installing ${packageId} from npm ...`);
        await package.spawn('npm', 'install', packageId, '--save');
        
        if (options.verbose) logger.debug('Registering the package as plugin ...');
        const pluginName = package.require(`${packageId}/package.json`).name;
        await package.require('./').afterInstall(pluginName);

        logger.info(`Plugin successfully installed: '${pluginName}'`);

    } catch (error) {
        if (options.verbose) {
            logger.error(error);
        } else {
            logger.error(error.message);
        }
    }
}
