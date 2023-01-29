var expect = require("chai").expect;
var pathlib = require('path');
var fs = require('fs');
var Package = require('../lib/package');



describe("THe stilo package manager", () => {

    describe('package.path', () => {

        it("should contain the root path of the .stilo npm package", () => {
            const packagePath = pathlib.join(__dirname, "../package-template");
            const package = new Package(packagePath);
            expect(package.path).to.equal(packagePath);
        });
    });

    describe('package.resolvePath(subPath)', () => {

        it("should return the absolute path of subPath, considering it relative to the package path", () => {
            const packagePath = pathlib.join(__dirname, "../package-template");
            const package = new Package(packagePath);
            expect(package.resolvePath('/../test')).to.equal(__dirname);
        });
    });

    describe('package.require(moduleId)', () => {

        it("should import a return a module of the npm package", () => {
            const packagePath = pathlib.join(__dirname, "../package-template");
            const package = new Package(packagePath);
            expect(package.require('./index')).to.equal(require('../package-template/index'));
        });
    });

    describe('package.spawn(command, ...args)', () => {

        it("should execute a shell command from the root directory of the npm package", async () => {
            const packagePath = pathlib.join(__dirname, "../package-template");
            const package = new Package(packagePath);
            const fileContent = String(Math.random());
            await package.spawn('cp', './package.json', '../test/package.json');
            expect(require('./package.json')).to.deep.equal(require('../package-template/package.json'))
            await package.spawn('rm', '../test/package.json');
            expect(fs.existsSync(pathlib.join(__dirname, 'package.json'))).to.be.false;
        });
    });
});
