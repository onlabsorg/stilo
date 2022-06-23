


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
            return [store, options, args];
        }
    }
}
