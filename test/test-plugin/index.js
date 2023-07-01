


exports.stilo = {
    
    protocols: {},

    routes: {
        
        '/test/route': {
            read: path => `test plugin: read ${path}`,
            list: path => `test plugin: list ${path}`,
            write: (path, source) => `test plugin: write ${path}`,
            delete: path => `test plugin: delete ${path}`,
        }
    },

    commands: {
        
        testcommand (store, cwp, options, ...args) {
            /// stilo command used only for testing purposes
            return {store, cwp, options, args};
        }
    }
}
