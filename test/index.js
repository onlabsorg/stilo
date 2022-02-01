var expect = require("chai").expect;
var pathlib = require('path');
var fs = require('fs');
var rimraf = require('rimraf');
var {Package} = require('..');

describe("stilo", () => {

    before(function () {
        this.timeout(5000);
        var dirPath = pathlib.join(__dirname, 'package');
        if (fs.existsSync(dirPath)) rimraf.sync(dirPath);
        fs.mkdirSync(dirPath);
        fs.mkdirSync(pathlib.join(dirPath, 'dir'));
    });
    
    describe("Package", () => {
        
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

            it("should return a Package instance pointing to the first occurence of the `.stilo` folder", () => {
                var pkg = Package.find(pathlib.join(__dirname, 'package'));
                expect(pkg).to.be.instanceof(Package);
                expect(pkg.path).to.equal(pathlib.join(__dirname, 'package', Package.DIR_NAME));

                var pkg = Package.find(pathlib.join(__dirname, 'package/dir'));
                expect(pkg).to.be.instanceof(Package);
                expect(pkg.path).to.equal(pathlib.join(__dirname, 'package', Package.DIR_NAME));
            });

            it("should throw an error if no `.stilo` folder is found", () => {
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
                expect(pkg.require('./package.json').stilo.plugins).to.deep.equal(['test-plugin']);
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
                expect(pkg.require('./package.json').stilo.plugins).to.deep.equal([]);
            });
        });
    });
    
    describe(".stilo/store", () => {
        
        it("should map its root to the package root path", async () => {
            const pkg = Package.find(pathlib.join(__dirname, 'package'));
            const Store = pkg.require('./store');
            const store = await Store(pathlib.join(pkg.path, ".."));
            await store.write('/dir/doc1', "Doc1");
            expect(fs.readFileSync(`${__dirname}/package/dir/doc1.olo`, "utf8")).to.equal("Doc1");
        });

        it("should contain the http: scheme", async () => {
            const pkg = Package.find(pathlib.join(__dirname, 'package'));
            const Store = pkg.require('./store');
            const store = await Store(pathlib.join(pkg.path, ".."));
            const readme = await store.read("http://raw.githubusercontent.com/onlabsorg/stilo/main/README.md ");
            const req = await fetch("http://raw.githubusercontent.com/onlabsorg/stilo/main/README.md ");
            expect(await req.text()).to.equal(readme);
        });

        it("should contain the https: scheme", async () => {
            const pkg = Package.find(pathlib.join(__dirname, 'package'));
            const Store = pkg.require('./store');
            const store = await Store(pathlib.join(pkg.path, ".."));
            const readme = await store.read("https://raw.githubusercontent.com/onlabsorg/stilo/main/README.md ");
            const req = await fetch("https://raw.githubusercontent.com/onlabsorg/stilo/main/README.md ");
            expect(await req.text()).to.equal(readme);            
        });

        it("should contain the file: scheme", async () => {
            const pkg = Package.find(pathlib.join(__dirname, 'package'));
            const Store = pkg.require('./store');
            const store = await Store(pathlib.join(pkg.path, ".."));
            await store.write('/dir/doc2', "Doc2");
            expect(await store.read(`file:/${__dirname}/package/dir/doc2`)).to.equal("Doc2");
        });

        it("should contain the temp: scheme", async () => {
            const pkg = Package.find(pathlib.join(__dirname, 'package'));
            const Store = pkg.require('./store');
            var store = await Store(pathlib.join(pkg.path, ".."));
            await store.write('temp:/doc3', "Doc3");
            expect(await store.read('temp:/doc3')).to.equal("Doc3");
            
            store = await Store(pathlib.join(pkg.path, ".."));
            expect(await store.read('temp:/doc3')).to.equal("");
        });
        
        it("should be decorated by the installed plugins with a __init__ method", async function () {
            this.timeout(5000);            
            const pkg = Package.find(pathlib.join(__dirname, 'package'));

            // install test plugin
            var testPluginPath = pathlib.join(__dirname, 'test-plugin');
            await pkg.install(testPluginPath);

            // retrieve store
            delete require.cache[pkg.resolveModulePath("./package.json")];
            delete require.cache[pkg.resolveModulePath("./plugins")];
            delete require.cache[pkg.resolveModulePath("./store")];
            const Store = pkg.require('./store');
            var store = await Store(pathlib.join(pkg.path, ".."));
            
            // test store decoration
            expect(store.test_plugin_installed).to.be.true;
            
            // uninstall test plugin
            await pkg.uninstall("test-plugin");
        });
    });
    
    describe(".stilo/commands", () => {
        
        it("should contain the `serve` command", async () => {
            const pkg = Package.find(pathlib.join(__dirname, 'package'));            

            const Store = pkg.require('./store');
            const store = await Store(pathlib.join(pkg.path, ".."));
            await store.write('/dir/doc4', "Doc4");

            const commands = pkg.require('./commands');            
            const server = await commands.server(store);
            
            const req = await fetch("http://localhost:8010/dir/doc4");
            expect(await req.text()).to.equal("Doc4");

            server.close();
        });
        
        it("should contain the commands defined by the installed plugins", async () => {
            const pkg = Package.find(pathlib.join(__dirname, 'package'));            
            const commands = pkg.require('./commands');
            expect(commands.testcommand).to.be.a("function");
            expect(commands.testcommand({x:10})).to.deep.equal([{x:10}]);
        });
    });
});
