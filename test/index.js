var expect = require("chai").expect;
var pathlib = require('path');
var fs = require('fs');
var rimraf = require('rimraf');
var Package = require('../lib/package');
var stilo = {
    init:      require('../lib/stilo-init'),
    install:   require('../lib/stilo-install'),
    uninstall: require('../lib/stilo-uninstall'),
    read:      require('../lib/stilo-read'),
    render:    require('../lib/stilo-render'),
    run:       require('../lib/stilo-run')
}
require('isomorphic-fetch');

describe("stilo", () => {

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
            await stilo.init({force: true});
            const package = new Package(packagePath);

            // Ensure cloned
            expect(package.require('./package.json')).to.deep.equal(require('../package-template/package.json'))

            // Ensure npm packages installed
            expect(fs.existsSync(pathlib.join(packagePath, 'node_modules/@onlabsorg/olojs')));

            // Restore original status
            process.chdir(cwd);
        });

        it("should not overwrite an existing initialization", async function () {
            this.timeout(60000);

            // Status snapshot
            const cwd = process.cwd();

            // Run the command
            process.chdir( pathlib.join(__dirname, 'test-repository') );
            var packagePath = pathlib.join(__dirname, 'test-repository', Package.DIR_NAME);
            var dummyFilePath = `${packagePath}/dummy-file.txt`;
            fs.writeFileSync(dummyFilePath, "...", "utf8");
            await stilo.init({force: false});

            // Ensure that the existing package has not been replaced
            expect(fs.existsSync(dummyFilePath)).to.be.true;

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

        it("should not give access to the direcories above the repository root", async () => {
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
            await stilo.read('../../../dir/doc1');
            expect(stdout).to.equal(fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.olo'), 'utf8') + '\n');

            // Restore original status
            process.chdir(cwd);
            process.stdout.write = stdout_write;
        });

        it("should treat absolute paths as relative to the repository root", async () => {
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
            await stilo.read('/dir/doc1');
            expect(stdout).to.equal(fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.olo'), 'utf8') + '\n');

            // Restore original status
            process.chdir(cwd);
            process.stdout.write = stdout_write;
        });

        it("should treat URIs as absolute paths", async () => {
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
            await stilo.read(`file:/${__dirname}/test-repository/dir/doc1`);
            expect(stdout).to.equal(fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.olo'), 'utf8') + '\n');

            // Restore original status
            process.chdir(cwd);
            process.stdout.write = stdout_write;
        });

        it("should output the source to the file path eventually passed with the --output option", async () => {
            // Status snapshot
            const cwd = process.cwd();

            // Run the commands
            process.chdir( pathlib.join(__dirname, 'test-repository') );
            await stilo.read('/dir/doc1', {output:"dir/doc1.txt"});
            const outputFileContent = fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.txt'), 'utf8')
            const sourceFileContent = fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.olo'), 'utf8')
            expect(outputFileContent).to.equal(sourceFileContent);

            // Restore original status
            process.chdir(cwd);
        });
    });

    describe("stilo.render(docPath)", () => {

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
            expect(stdout).to.equal("document @ home://dir/doc1\n\n");

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
            expect(stdout).to.equal("document @ home://dir/doc1\n\n");

            // Restore original status
            process.chdir(cwd);
            process.stdout.write = stdout_write;
        });

        it("should not give access to the direcories above the repository root", async () => {
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
            await stilo.render('../../../dir/doc1');
            expect(stdout).to.equal("document @ home://dir/doc1\n\n");

            // Restore original status
            process.chdir(cwd);
            process.stdout.write = stdout_write;
        });

        it("should treat absolute paths as relative to the repository root", async () => {
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
            await stilo.render('/dir/doc1');
            expect(stdout).to.equal("document @ home://dir/doc1\n\n");

            // Restore original status
            process.chdir(cwd);
            process.stdout.write = stdout_write;
        });

        it("should treat URIs as absolute paths", async () => {
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
            var docPath = `${__dirname}/test-repository/dir/doc1`;
            await stilo.render(`file:${docPath}`);
            expect(stdout).to.equal(`document @ file:/${docPath}\n\n`);

            // Restore original status
            process.chdir(cwd);
            process.stdout.write = stdout_write;
        });

        it("should output the rendered document to the file path eventually passed with the --output option", async () => {
            // Status snapshot
            const cwd = process.cwd();

            // Run the commands
            process.chdir( pathlib.join(__dirname, 'test-repository') );
            await stilo.render('/dir/doc1', {output:"dir/doc1.txt"});
            const outputFileContent = fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.txt'), 'utf8')
            expect(outputFileContent).to.equal("document @ home://dir/doc1\n");

            // Restore original status
            process.chdir(cwd);
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

            // Ensure plugin routes added to the store
            expect(await stilo.read('/test/route/path/to/doc')).to.equal("test plugin: read /path/to/doc");
            expect(await stilo.read('ppp://path/to/doc')).to.equal("test plugin: read ppp://path/to/doc");

            // Restore original status
            process.chdir(cwd);
        });        
    });

    describe("stilo.run(commandName, ...args)", () => {
        
        it("should execute the plugin command named 'commandName'", async () => {

            // Status snapshot
            const cwd = process.cwd();

            // Run the command
            process.chdir( pathlib.join(__dirname, 'test-repository/dir') );
            const retval = await stilo.run('test-command', {x:1, y:2}, 10, 20, 30);

            // Ensure command ran
            expect(retval.args).to.deep.equal([10,20,30]);
            expect(retval.options).to.deep.equal({x:1, y:2});
            expect(await retval.stilo.store.read('/dir/doc1')).to.equal(fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.olo'), 'utf8'));
            expect(retval.stilo.rootPath).to.equal(pathlib.join(__dirname, 'test-repository'));
            expect(retval.stilo.cwp).to.equal('/dir/');

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

    describe("stilo.run('http-server', path, {port})", () => {

        it("should start serving the store over HTTP", async () => {

            // Status snapshot
            const cwd = process.cwd();

            // Run the command
            process.chdir( pathlib.join(__dirname, 'test-repository') );
            const server = await stilo.run("http-server", {port:8011}, '/');

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
            const server = await stilo.run("http-server", {port:8011}, '/dir');

            // Ensure the server is running
            const req = await fetch('http://localhost:8011/doc1');
            expect(await req.text()).to.equal(fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.olo'), 'utf8'));

            // Restore original status
            process.chdir(cwd);
            server.close();
        });

        it("should resolve non-absolite path as relative to the cwd", async () => {

            // Status snapshot
            const cwd = process.cwd();

            // Run the command
            process.chdir( pathlib.join(__dirname, 'test-repository/dir') );
            const server = await stilo.run("http-server", {port:8011}, './');

            // Ensure the server is running
            const req = await fetch('http://localhost:8011/doc1');
            expect(await req.text()).to.equal(fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.olo'), 'utf8'));

            // Restore original status
            process.chdir(cwd);
            server.close();
        });
    });
});
