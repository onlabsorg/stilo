var expect = require("chai").expect;
var pathlib = require('path');
var fs = require('fs');
var rimraf = require('rimraf');
var {Package} = require('..');

describe("Package", () => {

    before(function () {
        this.timeout(5000);
        var dirPath = pathlib.join(__dirname, 'package');
        if (fs.existsSync(dirPath)) rimraf.sync(dirPath);
        fs.mkdirSync(dirPath);
        fs.mkdirSync(pathlib.join(dirPath, 'dir'));
    });

    describe("***** Package.create", () => {

        it("should clone and install the package-template", async function () {
            this.timeout(60000);
            var dirPath = pathlib.join(__dirname, 'package');
            expect(fs.existsSync(pathlib.join(dirPath, Package.DIR_NAME))).to.be.false;
            var pkg = await Package.create(dirPath);
            expect(pkg).to.be.instanceof(Package);
            expect(fs.existsSync(pathlib.join(dirPath, Package.DIR_NAME))).to.be.true;
            expect(fs.existsSync(pathlib.join(dirPath, Package.DIR_NAME, 'node_modules'))).to.be.true;
        });
    });

    describe("***** Package.find", () => {

        it("should return a Package instance pointing to the first occurence of the `.olojs` folder", () => {
            var pkg = Package.find(pathlib.join(__dirname, 'package'));
            expect(pkg).to.be.instanceof(Package);
            expect(pkg.path).to.equal(pathlib.join(__dirname, 'package', Package.DIR_NAME));

            var pkg = Package.find(pathlib.join(__dirname, 'package/dir'));
            expect(pkg).to.be.instanceof(Package);
            expect(pkg.path).to.equal(pathlib.join(__dirname, 'package', Package.DIR_NAME));
        });

        it("should throw an error if no `.olojs` folder is found", () => {
            try {
                var pkg = Package.find(pathlib.join('/usr/etc'));
                throw new Error("It did not throw");
            } catch (e) {
                expect(e.message).to.equal(`'${Package.DIR_NAME}' npm package not found`);
            }
        });
    });

    describe("***** Package.prototype.install", () => {

        it("should install the given package and record it in the plugins list", async function () {
            this.timeout(5000);
            var pkg = new Package(pathlib.join(__dirname, 'package', Package.DIR_NAME));
            var testPluginPath = pathlib.join(__dirname, 'test-plugin');
            await pkg.install(testPluginPath);
            var testPlugin = require(testPluginPath);
            expect(pkg.require('test-plugin')).to.equal(testPlugin);
            expect(pkg.require('./package.json').olojs.plugins).to.deep.equal(['test-plugin']);
        });
    });

    describe("***** Package.prototype.uninstall", () => {

        it("should uninstall the given package and remove it from the plugins list", async function () {
            this.timeout(5000);
            var pkg = new Package(pathlib.join(__dirname, 'package', Package.DIR_NAME));
            await pkg.uninstall('test-plugin');
            try {
                var testPlugin = require('test-plugin');
                throw new Error("It did not throw");
            } catch (error) {
                expect(error.message.indexOf("Cannot find module 'test-plugin'")).to.equal(0);
            }
            expect(pkg.require('./package.json').olojs.plugins).to.deep.equal([]);
        });
    });
});
