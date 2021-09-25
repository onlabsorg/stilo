


exports.stilo = {
    
    routes: {
        '/test/route1': {},
        '/test/route2': {}
    },
    
    middlewares: {
        '/app1': store => (req, res, next) => {console.log("@app1:", req.method, req.path)},
        '/app2': store => (req, res, next) => {console.log("@app2:", req.method, req.path)},
    }
}
