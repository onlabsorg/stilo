const olo = require('@onlabsorg/olojs');
const plugins = require('./plugins');


// Create the list of available commands
// these commands can be executed with `stilo run <command-name>`
const commands = module.exports = {};



// `stilo run server [port=<port-number>]`
//  serves the home store over HTTP
commands.server = {
    
    description: "Serves the stilo repository documents over HTTP",
    
    arguments: [
        "[path] ? root path to be served [defaults to '/']"
    ],
    
    options: [
        "-p, --port <port> ? server port [defaults to 8010]"
    ],
    
    async action (path, options) {
        const store = this;
        const server = olo.HTTPServer.create(store);
        const port = options.port || 8010;
        server.listen(port, err => {
            if (err) throw (err);
            console.log(`Stilo HTTP server listening on port ${port}`);
        });
        return server;                   
    }
}



// Add the custom commands eventually defined by the installed plugins
for (let plugin of plugins) {
    for (let commandName in plugin) {
        if (commandName[0] !== "_" && plugin[commandName] && typeof plugin[commandName].action == "function") {
            commands[commandName] = plugin[commandName];
        }
    }
}
