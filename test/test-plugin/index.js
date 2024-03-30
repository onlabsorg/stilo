


exports.stilo = {
    
    protocols: {
        ppp: {
            read: path => `test plugin: read ppp:/${path}`,
            write: (path, source) => undefined,
            delete: path => undefined,
        }
    },

    routes: {
        
        '/test/route': {
            read: path => `test plugin: read ${path}`,
            write: (path, source) => undefined,
            delete: path => undefined,
        }
    },

    commands: {
        
        test_command (stilo, options, ...args) {
            /// stilo command used only for testing purposes
            return {stilo, options, args};
        }
    }
}
