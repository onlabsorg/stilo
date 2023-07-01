const pathlib = require("path");
const fs = require("fs");


module.exports = dirPath => {
    const modules = {};

    const fileNames = fs.readdirSync(dirPath).filter(fileName => fileName.endsWith(".js"));
    for (let fileName of fileNames) {
        const moduleName = fileName.slice(0,-3);
        const modulePath = pathlib.join(dirPath, fileName);
        if (!fs.lstatSync(modulePath).isDirectory()) {
            modules[moduleName] = require(modulePath);
        };
    };

    return modules;
};
