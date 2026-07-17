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
    text += strings.join(' ') + '\n\n';
  }
  fs.writeFileSync(output, text, 'utf8');
  console.log('Wrote', output);
}

(async () => {
  const base = path.resolve(__dirname, '..');
  const files = [
    ['reference/dk-kleinschmidt.pdf', 'dk-kleinschmidt-pdfjs.txt'],
    ['reference/Checklist_Document__DK_Kleinschmidt__14501972.pdf', 'Checklist_Document__DK_Kleinschmidt__14501972-pdfjs.txt']
  ].map(([a, b]) => [path.resolve(base, a), path.resolve(__dirname, b)]);

  for (const [inp, out] of files) {
    console.log('Extracting', inp);
    await extract(inp, out);
  }
})();
