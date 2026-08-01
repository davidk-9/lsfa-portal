const textract = require('textract');
const fs = require('fs');

const inputPath = process.argv[2];
if (!inputPath) {
    console.error("No input file provided");
    process.exit(1);
}
const outputPath = inputPath.replace('.doc', '.txt');

textract.fromFileWithPath(inputPath, function( error, text ) {
    if (error) {
        console.error(error);
        process.exit(1);
    }
    fs.writeFileSync(outputPath, text, 'utf8');
    console.log('Wrote', outputPath);
});
