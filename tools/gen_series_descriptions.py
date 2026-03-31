"""
Genera SERIES_DESCRIPTIONS analizzando i cartigli dei PDF AC.
Estrae: dimensioni, materiale, tipo di lavorazione.
"""
import fitz, os, re, json
from collections import defaultdict

db_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'db')

# Raccogli info per famiglia/serie
series_data = defaultdict(lambda: defaultdict(list))

for root, dirs, files in os.walk(db_path):
    for f in sorted(files):
        if not f.lower().endswith('.pdf'):
            continue
        rel = os.path.relpath(os.path.join(root, f), db_path).replace('\\', '/')
        parts = rel.split('/')
        if len(parts) < 3 or parts[0] != 'PRD':
            continue
        fam = parts[1]
        serie = parts[2] if len(parts) > 2 else '?'

        # Solo AC (assemblaggio completo)
        if 'AC' not in f.upper():
            continue

        pdf_path = os.path.join(root, f)
        try:
            doc = fitz.open(pdf_path)
            page = doc.load_page(0)
            text = page.get_text()
            blocks = page.get_text('blocks')
            rect = page.rect
            doc.close()

            cartiglio = [b for b in blocks if b[1] > rect.height * 0.55]
            info = {'file': f}

            # Cerca descrizione nella zona cartiglio
            for b in cartiglio:
                txt = b[4].strip().replace('\n', ' ')
                skip = ['Deca', 'vietato', 'Tolleranze', 'UNI ', 'ISO ', 'Tel.',
                        'Monte', 'E-mail', 'Via ', 'VIBROALIMENTATORI', 'Codice',
                        'Disegno', 'Revisione', 'Data', 'Scala', 'Foglio',
                        'Descrizione', 'Materiale', 'Note', 'Peso', 'Trattamento',
                        'SEZIONE', 'DETTAGLIO', 'Grado', 'Disegnatore',
                        '0.5mm', 'x45']
                if len(txt) > 15 and not any(s in txt for s in skip):
                    info.setdefault('desc', []).append(txt)

            # Cerca materiale
            mat_match = re.search(r'(AISI\s*\d+|S235JR|C40|C45|Acciaio|Alluminio|Ghisa)', text)
            if mat_match:
                info['materiale'] = mat_match.group(1)

            # Cerca dimensioni (pattern LxHxP, diametro, ecc.)
            dim_match = re.findall(r'(\d{3,4})\s*x\s*(\d{2,4})', text)
            if dim_match:
                info['dimensioni'] = dim_match[0]

            diam_match = re.search(r'[Øø]\s*(\d{3,4})', text)
            if diam_match:
                info['diametro'] = diam_match.group(1)

            series_data[fam][serie].append(info)
        except:
            pass

# Output
for fam in sorted(series_data.keys()):
    print(f"\n{'='*60}")
    print(f"FAMIGLIA: {fam}")
    print(f"{'='*60}")
    for serie in sorted(series_data[fam].keys()):
        items = series_data[fam][serie]
        print(f"\n  Serie {serie} ({len(items)} PDF AC):")
        mats = set()
        dims = set()
        diams = set()
        descs = []
        for item in items[:5]:
            if 'materiale' in item:
                mats.add(item['materiale'])
            if 'dimensioni' in item:
                dims.add(f"{item['dimensioni'][0]}x{item['dimensioni'][1]}")
            if 'diametro' in item:
                diams.add(item['diametro'])
            if 'desc' in item:
                for d in item['desc'][:2]:
                    if d not in descs:
                        descs.append(d)
        if mats:
            print(f"    Materiali: {', '.join(mats)}")
        if dims:
            print(f"    Dimensioni: {', '.join(dims)}")
        if diams:
            print(f"    Diametri: {', '.join(diams)}")
        if descs:
            for d in descs[:3]:
                print(f"    Desc: {d[:100]}")
