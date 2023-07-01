


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
        
        testcommand (store, cwp, options, ...args) {
            /// stilo command used only for testing purposes
            return {store, cwp, options, args};
        }
    }
}
