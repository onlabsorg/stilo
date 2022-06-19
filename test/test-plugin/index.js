


exports.stilo = {
    
    __init__ (store) {
        store.test_plugin_installed = true;
    },
    
    testcommand: {
        description: "Test sub-command used for testing the stilo-run command",
        action (store, ...args) {
            return [store, args];
        }        
    }
}
