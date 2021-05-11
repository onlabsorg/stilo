const olojs = require('@onlabsorg/olojs');
const plugins = require('./plugins');



// The following function are custom commands that can be executed with the
// olojs command `olojs run <command-name> [options]`
const commands = module.exports = {
    
    "server": async (store, options={}) => {
        const server = olojs.HTTPServer.ViewerServer(store);
        const port = options.port || 8010;
        await new Promise((resolve, reject) => server.listen(port, 
                    err => err ? reject(err) : resolve() ));
        console.log(`olojs HTTP viewer server listening on port ${port}`);
    },
    
    // "test": async (store, options={}) => {
    //     console.log("olojs test command:")
    //     console.log("- options:", options);
    // }    
};



// All the commands exported by the installed plugins are merged to the
// commands object
for (let plugin of plugins) Object.assign(commands, plugin.commands);
