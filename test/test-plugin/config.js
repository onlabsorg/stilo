


exports.stilo = {
    
    routes: {
        '/test/route1': {},
        '/test/route2': {}
    },
    
    protocols: {
        'test-protocol1': {},
        'test-protocol2': {}
    },
    
    commands: {
        'cmd1': store => {console.log('cmd1:', store)},
        'cmd2': store => {console.log('cmd2:', store)},
    }
}
