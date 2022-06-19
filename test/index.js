var expect = require("chai").expect;
var pathlib = require('path');
var fs = require('fs');
var rimraf = require('rimraf');
var Package = require('../lib/package');
var stilo = require('..');
require('isomorphic-fetch');

describe("stilo CLI", () => {

    before(function () {
        this.timeout(5000);
        var packagePath = pathlib.join(__dirname, 'test-repository/.stilo');
        if (fs.existsSync(packagePath)) rimraf.sync(packagePath);
    });
    
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

    describe("stilo.init()", () => {
        
        it("should clone and install the package-template in the cwd", async function () {
            this.timeout(60000);
            
            // Status snapshot
            const cwd = process.cwd();
            
            // Run the command
            process.chdir( pathlib.join(__dirname, 'test-repository') );
            var packagePath = pathlib.join(__dirname, 'test-repository', Package.DIR_NAME);
            expect(fs.existsSync(packagePath)).to.be.false;
            await stilo.init();
            const package = new Package(packagePath);       
            
            // Ensure cloned     
            expect(package.require('./package.json')).to.deep.equal(require('../package-template/package.json'))
            
            // Ensure npm packages installed
            expect(fs.existsSync(pathlib.join(packagePath, 'node_modules/@onlabsorg/olojs')));
            
            // Restore original status
            process.chdir(cwd);
        });
    });
    
    describe("stilo.read(docPath)", () => {
        
        it("should fetch the doc mapped to docPath and print it to stdout ", async () => {
            let stdout = "";

            // Status snapshot
            const cwd = process.cwd();
            const stdout_write = process.stdout.write;
            
            // Run the commands
            process.chdir( pathlib.join(__dirname, 'test-repository') );
            process.stdout.write = text => {
                stdout += text;
                stdout_write.call(process.stdout, text);
            }
            await stilo.read('/dir/doc1');
            expect(stdout).to.equal(fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.olo'), 'utf8') + '\n');

            // Restore original status
            process.chdir(cwd);            
            process.stdout.write = stdout_write;
        });

        it("should consider the path as relative to the cwd", async () => {
            let stdout = "";

            // Status snapshot
            const cwd = process.cwd();
            const stdout_write = process.stdout.write;
            
            // Run the commands
            process.chdir( pathlib.join(__dirname, 'test-repository/dir') );
            process.stdout.write = text => {
                stdout += text;
                stdout_write.call(process.stdout, text);
            }
            await stilo.read('doc1');
            expect(stdout).to.equal(fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.olo'), 'utf8') + '\n');

            // Restore original status
            process.chdir(cwd);            
            process.stdout.write = stdout_write;
        });
    });
    
    describe("stilo.render(docPAth)", () => {

        it("should fetch the doc mapped to docPath and print its rendered text to stdout ", async () => {
            let stdout = "";

            // Status snapshot
            const cwd = process.cwd();
            const stdout_write = process.stdout.write;
            
            // Run the commands
            process.chdir( pathlib.join(__dirname, 'test-repository') );
            process.stdout.write = text => {
                stdout += text;
                stdout_write.call(process.stdout, text);
            }
            await stilo.render('/dir/doc1');
            expect(stdout).to.equal("document @ /dir/doc1\n\n");

            // Restore original status
            process.chdir(cwd);            
            process.stdout.write = stdout_write;
        });

        it("should consider the path as relative to the cwd", async () => {
            let stdout = "";

            // Status snapshot
            const cwd = process.cwd();
            const stdout_write = process.stdout.write;
            
            // Run the commands
            process.chdir( pathlib.join(__dirname, 'test-repository/dir') );
            process.stdout.write = text => {
                stdout += text;
                stdout_write.call(process.stdout, text);
            }
            await stilo.render('doc1');
            expect(stdout).to.equal("document @ /dir/doc1\n\n");

            // Restore original status
            process.chdir(cwd);            
            process.stdout.write = stdout_write;
        });
    });

    describe("stilo.serve(path, {port})", () => {
        
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

    describe("stilo.install(packageId)", () => {
        
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

            // Restore original status
            process.chdir(cwd);
        });
    });

    describe("stilo.run(commandName, ...args)", () => {
        
        it("should execute the plugin command named 'commandName'", async () => {
            // Status snapshot
            const cwd = process.cwd();

            // Run the command
            process.chdir( pathlib.join(__dirname, 'test-repository') );
            const [store, args] = await stilo.run('testcommand', 10, 20, 30);

            // Ensure command ran
            expect(args).to.deep.equal([10,20,30]);
            console.log(store);
            expect(await store.read('/dir/doc1')).to.equal(fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.olo'), 'utf8'))

            // Restore original status
            process.chdir(cwd);
            
        });
    });

    describe("stilo.uninstall(packageId)", () => {
        
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
