"""
Estrae i dati del cartiglio da tutti i PDF dei disegni tecnici.
Produce un JSON aggiornato con codice, descrizione, materiale, revisione, ecc.
"""
import fitz
import json
import os
import re
import sys

DRAWINGS_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'drawings')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'public', 'drawings_index.json')

def extract_cartiglio(pdf_path):
    """Estrae dati dal cartiglio di un disegno tecnico Deca S.r.l."""
    try:
        doc = fitz.open(pdf_path)
        if len(doc) == 0:
            doc.close()
            return None
        page = doc.load_page(0)
        text = page.get_text()
        blocks = page.get_text('blocks')
        rect = page.rect
        doc.close()
    except Exception as e:
        print(f"  ERRORE apertura {pdf_path}: {e}", file=sys.stderr)
        return None

    result = {}

    # Cerca il codice (tipicamente vicino alla label "Codice")
    # Il codice è un numero a 9+ cifre o un codice alfanumerico
    code_match = re.search(r'\bCodice\b', text)

    # Cerca codici numerici (tipici Deca: 050xxxxxx, 9 cifre)
    numeric_codes = re.findall(r'\b(0[45]\d{7})\b', text)
    if numeric_codes:
        result['codice'] = numeric_codes[0]

    # Cerca descrizione (dopo "Descrizione" nel cartiglio)
    # Approccio: usa i blocchi di testo posizionali
    page_height = rect.height
    page_width = rect.width

    # Il cartiglio è tipicamente nella parte bassa della pagina
    cartiglio_blocks = [b for b in blocks if b[1] > page_height * 0.55]

    # Cerca descrizione - tipicamente il testo più lungo nel cartiglio medio
    desc_candidates = []
    for b in cartiglio_blocks:
        txt = b[4].strip().replace('\n', ' ')
        # Escludi label del cartiglio
        if txt in ('Codice', 'Disegno', 'Revisione', 'Data', 'Disegnatore',
                   'Descrizione', 'Materiale', 'Note', 'Peso Kg', 'Trattamento',
                   'Scala', 'Foglio', 'Revisione disegno', 'Lunghezza:',
                   'Larghezza:', 'Sp./Ø:', 'Grado di finitura', 'Durezza',
                   'Profondità', 'Sistema E', 'UNI  3970'):
            continue
        if 'Deca S.r.l.' in txt or 'VIBROALIMENTATORI' in txt or 'vietato' in txt:
            continue
        if 'Tolleranze' in txt or 'UNI EN' in txt or 'ISO' in txt:
            continue
        if len(txt) > 10 and not txt.startswith('Tel.') and not txt.startswith('E-mail'):
            desc_candidates.append((b[1], txt))  # y position, text

    # Cerca materiale
    mat_patterns = [
        r'((?:AISI|Anticorodal|Alluminio|Acciaio|Inox|C40|Fe|Ottone|Bronzo|Teflon|Nylon|POM|PE|PP|PTFE|Rame|Gomma|Moplen)[\w\s\d\-.]*)',
    ]
    result['materiale'] = ''
    for pat in mat_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            result['materiale'] = m.group(1).strip()
            break

    # Cerca descrizione componente (tipicamente la riga con "x M4" o descrizione lunga)
    # Prendiamo il testo nella zona descrizione del cartiglio
    result['descrizione'] = ''
    for b in cartiglio_blocks:
        txt = b[4].strip().replace('\n', ' ')
        # La descrizione è tipicamente nella zona x=300-600, y vicino al codice
        if b[0] > 280 and b[0] < 650 and b[1] > page_height * 0.6:
            if len(txt) > 15 and 'Deca' not in txt and 'Tolleranze' not in txt and 'vietato' not in txt:
                if not any(skip in txt for skip in ['UNI', 'ISO', 'Tel.', 'E-mail', 'Via ', 'Monte Marenzo']):
                    result['descrizione'] = txt
                    break

    # Cerca revisione
    rev_match = re.findall(r'\b(\d{2})\b', text)
    # La revisione è tipicamente "00", "01", ecc.

    # Cerca scala
    scala_match = re.search(r'SCALA[:\s]*(\d+:\d+)', text)
    if scala_match:
        result['scala'] = scala_match.group(1)

    # Cerca disegnatore
    designer_match = re.search(r'(Andrea\s+Ponzoni|Marco\s+\w+|[A-Z][a-z]+\s+[A-Z][a-z]+)', text)
    if designer_match:
        result['disegnatore'] = designer_match.group(1)

    # Cerca data
    date_match = re.search(r'(\d{2}/\d{2}/\d{4})', text)
    if date_match:
        result['data'] = date_match.group(1)

    # Dimensioni (Lunghezza, Larghezza, Spessore)
    dim_section = text[text.find('Lunghezza'):text.find('Codice')] if 'Lunghezza' in text and 'Codice' in text else ''

    return result


def process_all_drawings():
    """Processa tutti i PDF e aggiorna drawings_index.json"""

    # Carica indice esistente
    existing = []
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            existing = json.load(f)

    # Mappa esistente per path
    existing_map = {d['path']: d for d in existing if 'path' in d}

    updated = []
    pdf_count = 0
    updated_count = 0

    for root, dirs, files in os.walk(DRAWINGS_DIR):
        for fname in sorted(files):
            if not fname.lower().endswith('.pdf'):
                continue

            full_path = os.path.join(root, fname)
            rel_path = os.path.relpath(full_path, DRAWINGS_DIR).replace('\\', '/')
            pdf_count += 1

            # Estrai info dal path (struttura: CATEGORY/SUBCATEGORY/TYPE/filename.pdf)
            parts = rel_path.split('/')
            category = parts[0] if len(parts) > 0 else ''
            subcategory = parts[1] if len(parts) > 1 else ''
            doc_type = parts[2] if len(parts) > 2 else ''
            code = fname.replace('.pdf', '')

            # Estrai dal cartiglio
            cartiglio = extract_cartiglio(full_path)

            entry = {
                'code': code,
                'codice': '',
                'category': category,
                'subcategory': subcategory,
                'type': doc_type,
                'path': rel_path
            }

            if cartiglio:
                if cartiglio.get('codice'):
                    entry['codice'] = cartiglio['codice']
                if cartiglio.get('descrizione'):
                    entry['descrizione'] = cartiglio['descrizione']
                if cartiglio.get('materiale'):
                    entry['materiale'] = cartiglio['materiale']
                if cartiglio.get('disegnatore'):
                    entry['disegnatore'] = cartiglio['disegnatore']
                if cartiglio.get('data'):
                    entry['data'] = cartiglio['data']
                if cartiglio.get('scala'):
                    entry['scala'] = cartiglio['scala']

            # Controlla se è stato aggiornato rispetto all'esistente
            old = existing_map.get(rel_path, {})
            if entry.get('codice') and entry['codice'] != old.get('codice', ''):
                updated_count += 1
                print(f"  AGGIORNATO: {code} -> codice: {entry['codice']}")

            updated.append(entry)

            if pdf_count % 50 == 0:
                print(f"  Processati {pdf_count} PDF...", file=sys.stderr)

    # Salva
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(updated, f, ensure_ascii=False, indent=2)

    print(f"\nCompletato: {pdf_count} PDF processati, {updated_count} codici aggiornati")
    print(f"Output: {OUTPUT_FILE}")

    return updated


if __name__ == '__main__':
    print("Estrazione cartigli da disegni PDF...")
    process_all_drawings()
