

exports.routes = {
    '/test/route1': {},
    '/test/route2': {}
}

exports.commands = {
    'cmd1': store => {console.log('cmd1:', store)},
    'cmd2': store => {console.log('cmd2:', store)},
}
