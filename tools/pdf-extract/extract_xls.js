const excelToJson = require('convert-excel-to-json');
const fs = require('fs');
const xlsx = require('xlsx');

const inputPath = process.argv[2];
if (!inputPath) {
    console.error("No input file provided");
    process.exit(1);
}
const outputPath = inputPath.replace('.xlsx', '.json').replace('.xls', '.json');

const result = excelToJson({
    sourceFile: inputPath
});

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
console.log('Wrote', outputPath);
