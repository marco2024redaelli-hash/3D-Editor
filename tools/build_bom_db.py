"""
Genera public/bom_database.json parsando tutti i file Excel in database/DATABASE1/.

Uso:
    python tools/build_bom_db.py
"""

import json
import os
import re
import sys

import xlrd


def extract_product_key(filename):
    """Estrae il codice prodotto dal nome file, rimuovendo suffissi."""
    name = os.path.splitext(filename)[0]
    # Rimuovi suffissi comuni
    for suffix in [
        " - DETTAGLIATA", " - SOLO PARTI", " dettagliata", " solo parti",
        "-Dettagliata", " Dettagliata", "_Dettagliata",
        " Elenco parti", " Elenco Parti", " distinta dettagliata",
    ]:
        name = name.replace(suffix, "")
    # Rimuovi codici commessa iniziali (es. "C24-315-03 - ")
    name = re.sub(r"^C\d{2}-\d+(-\d+)?\s*-\s*", "", name)
    # Rimuovi codici tipo "20SA00079 " iniziali
    name = re.sub(r"^\d+\w+\s+", "", name)
    # Pulisci spazi
    name = name.strip(" -_")
    return name


def is_parts_only(filename):
    """Verifica se il file e' una distinta 'solo parti'."""
    lower = filename.lower()
    return "solo parti" in lower or ("elenco parti" in lower)


def is_detailed(filename):
    """Verifica se il file e' una distinta 'dettagliata'."""
    lower = filename.lower()
    return "dettagliata" in lower or "dettagliata" in lower


def parse_excel(filepath):
    """Parsa un file Excel BOM e restituisce la lista parti."""
    try:
        wb = xlrd.open_workbook(filepath)
    except Exception:
        return []

    sheet = wb.sheet_by_index(0)
    if sheet.nrows < 3:
        return []

    # Trova la riga header (cerca "CODICE" o "Num. articolo")
    header_row = -1
    for r in range(min(sheet.nrows, 10)):
        for c in range(min(sheet.ncols, 5)):
            val = str(sheet.cell_value(r, c)).strip().upper()
            if val in ("CODICE", "NUM. ARTICOLO"):
                header_row = r
                break
        if header_row >= 0:
            break

    if header_row < 0:
        return []

    # Mappa colonne
    headers = {}
    for c in range(sheet.ncols):
        val = str(sheet.cell_value(header_row, c)).strip().upper()
        headers[val] = c

    parts = []
    for r in range(header_row + 1, sheet.nrows):
        code_col = headers.get("CODICE", 1)
        code = str(sheet.cell_value(r, code_col)).strip()
        if not code:
            continue

        desc_col = headers.get("DESCRIZIONE", 3)
        num_col = headers.get("NUM. ARTICOLO", 0)

        part = {
            "num": str(sheet.cell_value(r, num_col)).strip(),
            "code": code,
        }

        # Campi opzionali
        if "REVISIONE" in headers:
            part["rev"] = str(sheet.cell_value(r, headers["REVISIONE"])).strip()
        if "DESCRIZIONE" in headers:
            part["desc"] = str(sheet.cell_value(r, headers["DESCRIZIONE"])).strip()
        elif desc_col < sheet.ncols:
            part["desc"] = str(sheet.cell_value(r, desc_col)).strip()
        if "DESCRIZIONE AGGIUNTIVA" in headers:
            extra = str(sheet.cell_value(r, headers["DESCRIZIONE AGGIUNTIVA"])).strip()
            if extra:
                part["descExtra"] = extra
        if "MATERIALE" in headers:
            mat = str(sheet.cell_value(r, headers["MATERIALE"])).strip()
            if mat:
                part["material"] = mat
        if "TRATTAMENTO" in headers:
            treat = str(sheet.cell_value(r, headers["TRATTAMENTO"])).strip()
            if treat:
                part["treatment"] = treat
        if "RICAMBIO" in headers:
            spare = str(sheet.cell_value(r, headers["RICAMBIO"])).strip()
            if spare:
                part["spare"] = spare

        parts.append(part)

    return parts


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    db_dir = os.path.join(project_dir, "database", "DATABASE1")
    output_path = os.path.join(project_dir, "public", "bom_database.json")

    if not os.path.isdir(db_dir):
        print(f"Errore: cartella non trovata: {db_dir}")
        sys.exit(1)

    print(f"Scansione: {db_dir}")

    # Raccogli tutti i file Excel
    excel_files = []
    for root, _, files in os.walk(db_dir):
        for f in files:
            if f.endswith((".xls", ".xlsx")) and not f.startswith("~"):
                excel_files.append(os.path.join(root, f))

    print(f"File Excel trovati: {len(excel_files)}")

    # Parsa e raggruppa per codice prodotto
    products = {}
    skipped = 0

    for fpath in sorted(excel_files):
        fname = os.path.basename(fpath)
        key = extract_product_key(fname)

        if not key or len(key) < 3:
            skipped += 1
            continue

        parts = parse_excel(fpath)
        if not parts:
            skipped += 1
            continue

        # Se il prodotto esiste gia', preferisci "solo parti"
        if key in products:
            if is_parts_only(fname):
                products[key]["parts"] = parts
                products[key]["variants"].append(fname)
            elif not any(is_parts_only(v) for v in products[key]["variants"]):
                products[key]["parts"] = parts
                products[key]["variants"].append(fname)
            else:
                products[key]["variants"].append(fname)
        else:
            products[key] = {
                "name": key,
                "variants": [fname],
                "parts": parts,
            }

    # Costruisci indici inversi
    code_index = {}  # codice componente -> lista prodotti
    material_index = {}  # materiale -> lista prodotti

    for prod_key, prod in products.items():
        for part in prod["parts"]:
            # Indice per codice componente
            pcode = part.get("code", "")
            if pcode:
                if pcode not in code_index:
                    code_index[pcode] = []
                if prod_key not in code_index[pcode]:
                    code_index[pcode].append(prod_key)

            # Indice per materiale
            mat = part.get("material", "")
            if mat:
                mat_upper = mat.upper().strip()
                if mat_upper not in material_index:
                    material_index[mat_upper] = []
                if prod_key not in material_index[mat_upper]:
                    material_index[mat_upper].append(prod_key)

    # Output
    database = {
        "products": products,
        "index": {
            "codes": code_index,
            "materials": material_index,
        },
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(database, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(output_path) / 1024
    print("\nRisultato:")
    print(f"  Prodotti: {len(products)}")
    print(f"  Componenti unici indicizzati: {len(code_index)}")
    print(f"  Materiali unici: {len(material_index)}")
    print(f"  File saltati: {skipped}")
    print(f"  Output: {output_path} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
