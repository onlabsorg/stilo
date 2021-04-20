

exports.routes = {
    '/test/route1': {},
    '/test/route2': {}
}

exports.protocols = {
    'ppp1': {},
    'ppp2': {}
}

exports.middlewares = {
    '/mw1': store => (req, res, next) => next(),
    '/mw2': store => (req, res, next) => next(),
}
