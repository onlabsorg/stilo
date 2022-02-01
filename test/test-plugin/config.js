


exports.stilo = {
    
    __init__ (store) {
        store.test_plugin_installed = true;
    },
    
    testcommand (store) {
        return [store];
    }
}
