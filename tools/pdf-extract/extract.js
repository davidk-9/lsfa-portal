const fs = require('fs');
const path = require('path');
const pdfModule = require('pdf-parse');
console.error('pdfModule keys:', Object.keys(pdfModule));
console.error('pdfModule type:', typeof pdfModule);
const pdf = pdfModule.default || pdfModule;
if (pdfModule.PDFParse) {
  console.error('PDFParse prototype keys:', Object.getOwnPropertyNames(pdfModule.PDFParse.prototype));
}

async function extract(input, output) {
  const data = fs.readFileSync(input);
  const parser = new pdfModule.PDFParse();
  await parser.load(data);
  const text = parser.getText();
  fs.writeFileSync(output, text, 'utf8');
  console.log('Wrote', output);
}

(async () => {
  const base = path.resolve(__dirname, '..', '..');
  const files = [
    ['reference/dk-kleinschmidt.pdf', 'dk-kleinschmidt.txt'],
    ['reference/Checklist_Document__DK_Kleinschmidt__14501972.pdf', 'Checklist_Document__DK_Kleinschmidt__14501972.txt']
  ].map(([a,b]) => [path.resolve(base, a), path.resolve(__dirname, b)]);

  for (const [inp, out] of files) {
    console.log('Extracting', inp);
    await extract(inp, out);
  }
})();
