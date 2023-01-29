var expect = require("chai").expect;
var pathlib = require('path');
var fs = require('fs');
var Package = require('../lib/package');
var stilo = require('..');

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

    it("should output the rendered document to the file path eventually passed with the --output option", async () => {
        // Status snapshot
        const cwd = process.cwd();

        // Run the commands
        process.chdir( pathlib.join(__dirname, 'test-repository') );
        await stilo.render('/dir/doc1', {output:"dir/doc1.txt"});
        const outputFileContent = fs.readFileSync(pathlib.join(__dirname, 'test-repository/dir/doc1.txt'), 'utf8')
        expect(outputFileContent).to.equal("document @ /dir/doc1\n");

        // Restore original status
        process.chdir(cwd);
    });
});
