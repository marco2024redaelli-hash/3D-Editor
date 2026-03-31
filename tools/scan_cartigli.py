"""Scansiona i PDF AC e estrae descrizioni dal cartiglio per ogni famiglia/serie."""
import fitz, os

db_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'db')

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

        # Solo PDF di assemblaggi completi
        if 'AC' not in f.upper():
            continue

        pdf_path = os.path.join(root, f)
        try:
            doc = fitz.open(pdf_path)
            page = doc.load_page(0)
            blocks = page.get_text('blocks')
            rect = page.rect
            doc.close()

            cartiglio = [b for b in blocks if b[1] > rect.height * 0.55]
            descs = []
            for b in cartiglio:
                txt = b[4].strip().replace('\n', ' ')
                skip = ['Deca', 'vietato', 'Tolleranze', 'UNI ', 'ISO ', 'Tel.',
                        'Monte', 'E-mail', 'Via ', 'VIBROALIMENTATORI', 'Codice',
                        'Disegno', 'Revisione', 'Data', 'Scala', 'Foglio',
                        'Descrizione', 'Materiale', 'Note', 'Peso', 'Trattamento']
                if len(txt) > 10 and not any(s in txt for s in skip):
                    descs.append(txt)

            print(f'{fam}/{serie} | {f} | {descs[:4]}')
        except Exception as e:
            print(f'{fam}/{serie} | {f} | ERRORE: {e}')
