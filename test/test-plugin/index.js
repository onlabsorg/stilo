


exports.stilo = {
    
    routes: {
        
        '/test/route': {
            read: path => `test plugin: read ${path}`,
            write: (path, source) => `test plugin: write ${path}`,
            delete: path => `test plugin: delete ${path}`,
        }
    },
    
    commands: {
        
        testcommand (store, options, ...args) {
            /// stilo command used only for testing purposes
            return [store, options, args];
        }
    }
}
