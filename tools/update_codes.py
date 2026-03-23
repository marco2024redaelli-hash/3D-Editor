"""
Aggiorna i codici nel catalog.json dei modelli 3D
usando i codici estratti dai cartigli dei disegni PDF.
Incrocia per nome disegno (CMP-xxx) → codice cartiglio (050xxx).
"""
import json
import re
import os

BASE = os.path.join(os.path.dirname(__file__), '..', 'public')

# Carica drawings_index aggiornato
with open(os.path.join(BASE, 'drawings_index.json'), 'r', encoding='utf-8') as f:
    drawings = json.load(f)

# Carica catalog.json
catalog_path = os.path.join(BASE, 'models', 'catalog.json')
with open(catalog_path, 'r', encoding='utf-8') as f:
    catalog = json.load(f)

# Costruisci mappa: base_code (senza suffisso variante) -> codice cartiglio
# Es: CMP-CALM-AS-P0007 -> 050201043
drawing_map = {}
for d in drawings:
    if d.get('codice'):
        # Mappa il code completo del disegno
        drawing_map[d['code'].upper()] = d['codice']
        # Anche senza il suffisso finale (es. -A, -AL, -C45, -AS, -VB, ecc.)
        base = re.sub(r'-[A-Z0-9]{1,4}$', '', d['code'])
        if base.upper() not in drawing_map:
            drawing_map[base.upper()] = d['codice']

print(f"Mappa disegni: {len(drawing_map)} entries")

# Aggiorna catalog
updated = 0
for item in catalog:
    if item.get('code'):  # ha già un codice
        continue

    name = item['name'].upper()
    # Rimuovi suffissi come -X, date, ecc.
    clean_name = re.sub(r'\s*\(.*\)$', '', name)  # rimuovi date tra parentesi
    clean_name = re.sub(r'-X$', '', clean_name)  # rimuovi -X finale

    # Cerca match nel drawing_map
    matched_code = None

    # Match esatto
    if clean_name in drawing_map:
        matched_code = drawing_map[clean_name]
    else:
        # Prova con varianti di suffisso
        for suffix in ['', '-A', '-AL', '-AS', '-X', '-C45', '-VB', '-PET']:
            key = clean_name + suffix
            if key in drawing_map:
                matched_code = drawing_map[key]
                break

    if not matched_code:
        # Cerca match parziale (il nome del modello è contenuto in un codice disegno)
        for dcode, codice in drawing_map.items():
            # Confronta la parte base (senza variante finale)
            dbase = re.sub(r'-[A-Z0-9]{1,4}$', '', dcode)
            if dbase == clean_name or clean_name == dcode:
                matched_code = codice
                break

    if matched_code:
        item['code'] = matched_code
        updated += 1
        print(f"  CATALOG: {item['name']} -> {matched_code}")

# Salva catalog aggiornato
with open(catalog_path, 'w', encoding='utf-8') as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print(f"\nCatalog: {updated} modelli aggiornati con codice")

# Ora mostra statistiche finali
total = len(catalog)
with_code = sum(1 for c in catalog if c.get('code'))
print(f"Totale modelli: {total}, con codice: {with_code}, senza: {total - with_code}")
