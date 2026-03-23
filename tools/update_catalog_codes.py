"""
Scansiona tutti i PDF in DATABASE1, estrae il codice dal cartiglio,
e aggiorna catalog.json con i codici trovati.
"""
import fitz
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(BASE, 'DATABASE1')
CATALOG_PATH = os.path.join(BASE, 'public', 'catalog.json')
PYTHON = sys.executable


SKIP_WORDS = {
    '', 'revisione', 'disegno', 'revisione disegno', 'descrizione',
    'data', 'materiale', 'scala', 'foglio', 'peso kg', 'note',
    'trattamento', 'rev', 'descrizione aggiuntiva', 'descrizione revisione',
    'disegnatore', 'num. art.', 'durezza', 'grado di finitura',
    'emissione', 'sistema e',
}

def extract_code_from_pdf(pdf_path):
    """Estrae il codice prodotto dal cartiglio di un PDF tecnico DECA."""
    try:
        doc = fitz.open(pdf_path)
        if len(doc) == 0:
            doc.close()
            return None
        # Check last page (cartiglio is usually there) and first page
        for page_idx in [len(doc) - 1, 0]:
            page = doc.load_page(page_idx)
            text = page.get_text()

            # Metodo 1: Cerca codici numerici tipici DECA (050xxxxxx, 040xxxxxx, 9+ cifre)
            numeric_codes = re.findall(r'\b(0[3-5]\d{7,})\b', text)
            if numeric_codes:
                doc.close()
                return numeric_codes[0]

            # Metodo 2: Cerca l'ULTIMA occorrenza di "Codice" (il cartiglio e' in fondo)
            # e il valore nelle righe successive
            lines = text.split('\n')
            last_codice_idx = None
            for i, line in enumerate(lines):
                if re.search(r'\bCodice\b', line) and 'Revisione' not in line:
                    last_codice_idx = i

            if last_codice_idx is not None:
                for j in range(last_codice_idx + 1, min(last_codice_idx + 6, len(lines))):
                    candidate = lines[j].strip()
                    if candidate.lower() in SKIP_WORDS:
                        continue
                    if len(candidate) < 3:
                        continue
                    # Skip pure numbers <= 2 digits (revision numbers like "00")
                    if re.match(r'^\d{1,2}$', candidate):
                        continue
                    # Codice alfanumerico di almeno 3 caratteri
                    m = re.match(r'^([A-Z0-9][A-Z0-9\-]{2,})$', candidate, re.IGNORECASE)
                    if m:
                        doc.close()
                        return m.group(1).upper()
                    # Codice numerico puro (3+ cifre)
                    m = re.match(r'^(\d{3,})$', candidate)
                    if m:
                        doc.close()
                        return m.group(1)

            # Metodo 3: Cerca codici tipo ALMxxxxxxx, BLFxxxxxxx
            alm_codes = re.findall(r'\b([A-Z]{3}\d{5,})\b', text)
            if alm_codes:
                doc.close()
                return alm_codes[0]

        doc.close()
        return None
    except Exception as e:
        return None


def main():
    # Carica catalog.json
    with open(CATALOG_PATH, 'r', encoding='utf-8') as f:
        catalog = json.load(f)

    total = len(catalog)
    updated = 0
    already = 0
    no_pdf = 0
    no_code = 0
    errors = 0

    for i, entry in enumerate(catalog):
        # Skip if already has a valid code
        if entry.get('code') and entry['code'] != '__PDF_NO_CODE__':
            already += 1
            continue

        pdf_rel = entry.get('pdf')
        if not pdf_rel:
            no_pdf += 1
            continue

        pdf_path = os.path.join(DB, pdf_rel)
        if not os.path.exists(pdf_path):
            # Try in public/db
            pdf_path = os.path.join(BASE, 'public', 'db', pdf_rel)
            if not os.path.exists(pdf_path):
                no_pdf += 1
                continue

        code = extract_code_from_pdf(pdf_path)
        if code:
            entry['code'] = code
            updated += 1
            print(f"  [{updated}] {entry['name']} -> {code}")
        else:
            if entry.get('code') != '__PDF_NO_CODE__':
                entry['code'] = '__PDF_NO_CODE__'
            no_code += 1

        if (i + 1) % 100 == 0:
            print(f"  ... processati {i+1}/{total}", file=sys.stderr)

    # Salva
    with open(CATALOG_PATH, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)

    print(f"\nRisultato:")
    print(f"  Totale entries: {total}")
    print(f"  Codici gia presenti: {already}")
    print(f"  Nuovi codici estratti: {updated}")
    print(f"  PDF senza codice: {no_code}")
    print(f"  Senza PDF: {no_pdf}")


if __name__ == '__main__':
    print("Estrazione codici dai cartigli PDF...")
    main()
