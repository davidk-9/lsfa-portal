import sys
from pathlib import Path
from pdfminer.high_level import extract_text

base = Path(__file__).resolve().parents[2]
files = [
    (base / 'reference' / 'dk-kleinschmidt.pdf', Path(__file__).resolve().parent / 'dk-kleinschmidt.txt'),
    (base / 'reference' / 'Checklist_Document__DK_Kleinschmidt__14501972.pdf', Path(__file__).resolve().parent / 'Checklist_Document__DK_Kleinschmidt__14501972.txt')
]

for inp, out in files:
    print('Extracting', inp)
    try:
        text = extract_text(str(inp))
        out.write_text(text, encoding='utf-8')
        print('Wrote', out)
    except Exception as e:
        print('Error extracting', inp, e)
        sys.exit(1)
