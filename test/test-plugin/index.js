


exports.stilo = {
    
    protocols: {
        ppp: {
            read: path => `test plugin: read ppp:/${path}`
        }
    },

    routes: {
        
        '/test/route': {
            read: path => `test plugin: read ${path}`,
        }
    },

    commands: {
        
        testcommand (stilo, options, ...args) {
            /// stilo command used only for testing purposes
            return {stilo, options, args};
        }
    }
}
