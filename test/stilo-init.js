
var expect = require("chai").expect;
var pathlib = require('path');
var fs = require('fs');
var rimraf = require('rimraf');
var Package = require('../lib/package');
var stilo = require('..');

describe("stilo.init()", () => {

    it("should clone and install the package-template in the cwd", async function () {
        this.timeout(60000);

        // Status snapshot
        const cwd = process.cwd();

        // Run the command
        process.chdir( pathlib.join(__dirname, 'test-repository') );
        var packagePath = pathlib.join(__dirname, 'test-repository', Package.DIR_NAME);
        await stilo.init({force: true});
        const package = new Package(packagePath);

        // Ensure cloned
        expect(package.require('./package.json')).to.deep.equal(require('../package-template/package.json'))

        // Ensure npm packages installed
        expect(fs.existsSync(pathlib.join(packagePath, 'node_modules/@onlabsorg/olojs')));

        // Restore original status
        process.chdir(cwd);
    });
});
