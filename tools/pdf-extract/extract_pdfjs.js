const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function extract(input, output) {
  const data = new Uint8Array(fs.readFileSync(input));
  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    text += strings.join('\n') + '\n\n';
  }
  fs.writeFileSync(output, text, 'utf8');
  console.log('Wrote', output);
}

const inputPath = process.argv[2];
if (!inputPath) {
    console.error("No input file provided");
    process.exit(1);
}
const outputPath = inputPath.replace('.pdf', '.txt');

extract(inputPath, outputPath).catch(console.error);
