const chalk = require('chalk');

exports.log = (...messages) => console.log(...messages);

exports.debug = (...messages) => console.debug(chalk.black.bgGray('stilo DEBUG'), ...messages);

exports.info = (...messages) => console.info(chalk.white.bgBlue('stilo INFO'), ...messages);

exports.warn = (...messages) => console.warn(chalk.black.bgYellow('stilo WARN'), ...messages);

exports.error = (...messages) => console.error(chalk.white.bgRed('stilo ERROR'), ...messages);
