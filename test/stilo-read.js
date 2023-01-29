
var expect = require("chai").expect;
var pathlib = require('path');
var fs = require('fs');
var Package = require('../lib/package');
var stilo = require('..');

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
