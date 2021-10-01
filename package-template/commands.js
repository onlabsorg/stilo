const olo = require('@onlabsorg/olojs');
const plugins = require('./plugins');


// Create the list of available commands
// these commands can be executed with `stilo run <command-name>`
const commands = module.exports = {};



// `stilo run server [port=<port-number>]`
//  serves the home store over HTTP
commands.server = (store, options={}) => {
    const server = olo.HTTPServer.create(store.homeStore);
    const port = options.port || 8010;
    server.listen(port, err => {
        if (err) throw (err);
        console.log(`Stilo HTTP server listening on port ${port}`);
    });
}    



// Add the custom commands eventually defined by the installed plugins
for (let plugin of plugins) {
    for (let commandName in plugin) {
        if (commandName[0] !== "_" && typeof plugin[commandName] == "function") {
            commands[commandName] = plugin[commandName].bind(plugin);
        }
    }
}

