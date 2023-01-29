var expect = require("chai").expect;
var pathlib = require('path');
var fs = require('fs');
var rimraf = require('rimraf');
var Package = require('../lib/package');
var stilo = require('..');
require('isomorphic-fetch');

describe("stilo", () => {

    require('./package');

    require('./stilo-init');
    require('./stilo-read');
    require('./stilo-render');


    describe.skip("stilo.serve(path, {port})", () => {
        
        it("should start serving the store over HTTP", async () => {
            
            // Status snapshot
            const cwd = process.cwd();
            
            // Run the command
            process.chdir( pathlib.join(__dirname, 'test-repository') );
            const server = await stilo.serve('/', {port:8011});
            
            // Ensure the server is running
            const req = await fetch('http://localhost:8011/dir/doc1');
            expect(await req.text()).to.equal(fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.olo'), 'utf8')); 
            
            // Restore original status
            process.chdir(cwd);
            server.close();            
        });

        it("should serve a substore if a non-root path is passed", async () => {
            
            // Status snapshot
            const cwd = process.cwd();
            
            // Run the command
            process.chdir( pathlib.join(__dirname, 'test-repository') );
            const server = await stilo.serve('/dir', {port:8011});
            
            // Ensure the server is running
            const req = await fetch('http://localhost:8011/doc1');
            expect(await req.text()).to.equal(fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.olo'), 'utf8')); 
            
            // Restore original status
            process.chdir(cwd);
            server.close();            
        });
    });

    describe.skip("stilo.install(packageId)", () => {
        
        it("should install the given package and record it in the plugins list", async function () {
            this.timeout(5000);

            // Status snapshot
            const cwd = process.cwd();

            // Run the command
            process.chdir( pathlib.join(__dirname, 'test-repository') );
            const testPluginPath = pathlib.join(__dirname, 'test-plugin');
            await stilo.install(testPluginPath);

            // Ensure plugin installed
            const package = new Package(pathlib.join(__dirname, 'test-repository', Package.DIR_NAME));
            expect(package.require('test-plugin')).to.equal(require(testPluginPath));

            // Ensure plugin registered
            const packageJsonPath = pathlib.join(__dirname, 'test-repository/.stilo/package.json');
            const packageJsonText = fs.readFileSync(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonText)
            expect(packageJson.stilo.plugins).to.deep.equal(['test-plugin']);

            // Ensure plugin routes added to the store
            expect(await stilo.read('/test/route/path/to/doc')).to.equal("test plugin: read /path/to/doc");

            // Restore original status
            process.chdir(cwd);
        });        
    });

    describe.skip("stilo.run(commandName, ...args)", () => {
        
        it("should execute the plugin command named 'commandName'", async () => {
            // Status snapshot
            const cwd = process.cwd();

            // Run the command
            process.chdir( pathlib.join(__dirname, 'test-repository') );
            let [store, options, args] = await stilo.run('testcommand', {x:1, y:2}, 10, 20, 30);

            // Ensure command ran
            expect(args).to.deep.equal([10,20,30]);
            expect(options).to.deep.equal({x:1, y:2});
            expect(await store.read('/dir/doc1')).to.equal(fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.olo'), 'utf8'));
            expect(store.stiloRootPath).to.equal(pathlib.join(__dirname, 'test-repository'));

            // Restore original status
            process.chdir(cwd);
            
        });
    });

    describe.skip("stilo.uninstall(packageId)", () => {
        
        it("should uninstall the given package and remove it from the plugins list", async function () {
            this.timeout(5000);
            
            // Status snapshot
            const cwd = process.cwd();

            // Run the command
            process.chdir( pathlib.join(__dirname, 'test-repository') );
            await stilo.uninstall('test-plugin');

            // Ensure plugin uninstalled
            const package = new Package(pathlib.join(__dirname, 'test-repository', Package.DIR_NAME));
            try {
                const testPlugin = require('test-plugin');
                throw new Error("It did not throw");
            } catch (error) {
                expect(error.message.indexOf("Cannot find module 'test-plugin'")).to.equal(0);
            }

            // Ensure plugin unregistered
            const packageJsonPath = pathlib.join(__dirname, 'test-repository/.stilo/package.json');
            const packageJsonText = fs.readFileSync(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonText)
            expect(packageJson.stilo.plugins).to.deep.equal([]);

            // Restore original status
            process.chdir(cwd);
        });
    });
});
