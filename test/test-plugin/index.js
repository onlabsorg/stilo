


exports.stilo = {
    
    __init__ (store) {
        store.test_plugin_installed = true;
    },
    
    testcommand (store, options, ...args) {
        return [store, options, args];
    }
}
