"""
convert_bvl.py
==============
Converte i file BVL da PDM_Vault:
  - SLDASM -> GLB (modello 3D)
  - SLDDRW -> PDF (disegno tecnico)

Poi copia tutto nella cartella public/db/PRD/BVL/ e aggiorna catalog.json.

Uso:
  python convert_bvl.py [--dry-run] [--visible]

Requisiti:
  pip install pywin32
  SolidWorks installato e licenziato
"""

import os
import sys
import json
import time
import shutil
import argparse
import pathlib

try:
    import win32com.client
    import pythoncom
except ImportError:
    print("ERRORE: pywin32 non installato. Esegui: pip install pywin32")
    sys.exit(1)

# Costanti SolidWorks COM
SW_DOC_PART      = 1
SW_DOC_ASSEMBLY  = 2
SW_DOC_DRAWING   = 3
SW_OPEN_SILENT   = 1
SW_OPEN_READONLY = 2
SW_SAVE_CURRENT  = 0
SW_SAVE_SILENT   = 1

# Percorsi
BVL_ROOT = r"C:\PDM_Vault\VB - VIBRATORI CIRCOLARI-LINEARI FINITI\BVL"
PROJECT_ROOT = pathlib.Path(__file__).parent.parent
PUBLIC_DB = PROJECT_ROOT / "public" / "db" / "PRD" / "BVL"
CATALOG_PATH = PROJECT_ROOT / "public" / "catalog.json"

# Mappa taglie BVL con i file sorgente
BVL_FILES = [
    {
        "taglia": "VL101",
        "folder": "VL101",
        "asm": "BVL-VL101-XX-A000.SLDASM",
        "drw": ["BVL-VL101-XX-A000.SLDDRW"],
        "codice": "BVL-VL101",
        "desc": "Base vibrante lineare 1 elettromagnete - 300mm"
    },
    {
        "taglia": "VL201",
        "folder": "VL201",
        "asm": "BVL-VL201-XX-A000.SLDASM",
        "drw": ["BVL-VL201-DX-A000.SLDDRW", "BVL-VL201-SX-A000.SLDDRW"],
        "codice": "BVL-VL201",
        "desc": "Base vibrante lineare 2 elettromagneti - 400mm"
    },
    {
        "taglia": "VL301",
        "folder": "VL301",
        "asm": "BVL-VL301-XX-A000.SLDASM",
        "drw": ["BVL-VL301-DX-A000.SLDDRW", "BVL-VL301-SX-A000.SLDDRW"],
        "codice": "BVL-VL301",
        "desc": "Base vibrante lineare 3 elettromagneti - 500mm"
    },
    {
        "taglia": "VL401",
        "folder": "VL401",
        "asm": "BVL-VL401-XX-A000.SLDASM",
        "drw": ["BVL-VL401-XX-A000.SLDDRW"],
        "codice": "BVL-VL401",
        "desc": "Base vibrante lineare 4 elettromagneti - 600mm"
    },
    {
        "taglia": "VL401TR",
        "folder": "VL401 TR",
        "asm": "BVL-VL401TR-XX-A000-X.SLDASM",
        "drw": ["BVL-VL401TR-DX-A000-9006.SLDDRW", "BVL-VL401TR-SX-A000-9006.SLDDRW"],
        "codice": "BVL-VL401TR",
        "desc": "Base vibrante lineare 4 elettromagneti traversale"
    },
    {
        "taglia": "VL501",
        "folder": "VL501",
        "asm": "BVL-VL501-XX-A000.SLDASM",
        "drw": ["BVL-VL501-XX-A000.SLDDRW"],
        "codice": "BVL-VL501",
        "desc": "Base vibrante lineare 5 elettromagneti - 800mm"
    },
]


def connect_solidworks(visible=False):
    """Connette a SolidWorks."""
    print("Connessione a SolidWorks...")
    pythoncom.CoInitialize()
    try:
        sw = win32com.client.Dispatch("SldWorks.Application")
    except Exception as e:
        print(f"ERRORE: impossibile avviare SolidWorks: {e}")
        sys.exit(1)
    sw.Visible = visible
    sw.UserControl = False
    try:
        ver = sw.RevisionNumber
    except:
        ver = "unknown"
    print(f"SolidWorks connesso - versione: {ver}")
    return sw


def open_document(sw, file_path, doc_type):
    """Apre un documento SolidWorks gestendo le diverse API."""
    path_str = str(file_path)

    # Metodo 1: OpenDoc6 con interi semplici (senza VARIANT byref)
    try:
        doc = sw.OpenDoc6(path_str, doc_type, SW_OPEN_SILENT | SW_OPEN_READONLY, "", 0, 0)
        if doc is not None:
            return doc
    except Exception:
        pass

    # Metodo 2: OpenDoc2 (API piu vecchia, meno parametri)
    try:
        doc = sw.OpenDoc2(path_str, doc_type)
        if doc is not None:
            return doc
    except Exception:
        pass

    # Metodo 3: OpenDoc (API base)
    try:
        doc = sw.OpenDoc(path_str, doc_type)
        if doc is not None:
            return doc
    except Exception:
        pass

    return None


def save_as(doc, output_path):
    """Salva il documento nel formato indicato dall'estensione."""
    path_str = str(output_path)

    # Metodo 1: Extension.SaveAs2 (SW 2024+)
    try:
        result = doc.Extension.SaveAs2(path_str, 0, 1, None, "", False, 0, 0)
        if os.path.exists(path_str):
            return True
    except Exception:
        pass

    # Metodo 2: Extension.SaveAs con interi semplici
    try:
        result = doc.Extension.SaveAs(path_str, 0, 1, None, 0, 0)
        if os.path.exists(path_str):
            return True
    except Exception:
        pass

    # Metodo 3: SaveAs3
    try:
        result = doc.SaveAs3(path_str, 0, 1)
        if os.path.exists(path_str):
            return True
    except Exception:
        pass

    # Metodo 4: SaveAs
    try:
        result = doc.SaveAs(path_str)
        if os.path.exists(path_str):
            return True
    except Exception:
        pass

    return False


def convert_asm_to_glb(sw, sld_path, glb_path):
    """Converte SLDASM -> GLB (o STEP come fallback)."""
    doc = open_document(sw, sld_path, SW_DOC_ASSEMBLY)
    if doc is None:
        return False, "Apertura fallita"

    try:
        # Prova GLB diretto
        if save_as(doc, str(glb_path)):
            size_kb = os.path.getsize(str(glb_path)) // 1024
            return True, f"OK ({size_kb} KB)"

        # Fallback: STEP
        step_path = str(glb_path).replace('.glb', '.step')
        if save_as(doc, step_path):
            size_kb = os.path.getsize(step_path) // 1024
            return "STEP", f"Esportato STEP ({size_kb} KB) - serve conversione STEP->GLB"

        # Fallback: STL
        stl_path = str(glb_path).replace('.glb', '.stl')
        if save_as(doc, stl_path):
            size_kb = os.path.getsize(stl_path) // 1024
            return "STL", f"Esportato STL ({size_kb} KB) - serve conversione STL->GLB"

        return False, "Nessun formato esportato"
    except Exception as e:
        return False, f"Eccezione: {e}"
    finally:
        try:
            sw.CloseDoc(str(sld_path))
        except:
            pass


def convert_drw_to_pdf(sw, drw_path, pdf_path):
    """Converte SLDDRW -> PDF."""
    doc = open_document(sw, drw_path, SW_DOC_DRAWING)
    if doc is None:
        return False, "Apertura fallita"

    try:
        if save_as(doc, str(pdf_path)):
            size_kb = os.path.getsize(str(pdf_path)) // 1024
            return True, f"OK ({size_kb} KB)"
        return False, "Esportazione PDF fallita"
    except Exception as e:
        return False, f"Eccezione: {e}"
    finally:
        try:
            sw.CloseDoc(str(drw_path))
        except:
            pass


def update_catalog(new_entries):
    """Aggiorna catalog.json con i nuovi prodotti BVL."""
    catalog = []
    if CATALOG_PATH.exists():
        with open(CATALOG_PATH, 'r', encoding='utf-8') as f:
            catalog = json.load(f)

    # Rimuovi eventuali BVL esistenti per evitare duplicati
    catalog = [c for c in catalog if not (c.get('folder', '').startswith('PRD/BVL'))]

    # Aggiungi nuovi
    catalog.extend(new_entries)

    with open(CATALOG_PATH, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)

    print(f"catalog.json aggiornato: {len(new_entries)} prodotti BVL aggiunti (totale: {len(catalog)})")


def main():
    parser = argparse.ArgumentParser(description="Converti BVL SolidWorks -> GLB + PDF")
    parser.add_argument("--dry-run", action="store_true", help="Mostra cosa farebbe senza convertire")
    parser.add_argument("--visible", action="store_true", help="Mostra SolidWorks")
    args = parser.parse_args()

    print(f"Sorgente: {BVL_ROOT}")
    print(f"Destinazione: {PUBLIC_DB}")
    print(f"File da processare: {len(BVL_FILES)}")
    print()

    if args.dry_run:
        print("--- DRY RUN ---")
        for item in BVL_FILES:
            src_dir = os.path.join(BVL_ROOT, item['folder'])
            asm = os.path.join(src_dir, item['asm'])
            print(f"  [{item['taglia']}] {item['desc']}")
            print(f"    ASM: {asm} -> GLB")
            for drw in item['drw']:
                print(f"    DRW: {os.path.join(src_dir, drw)} -> PDF")
        return

    # Crea directory destinazione
    os.makedirs(PUBLIC_DB, exist_ok=True)

    # Connetti SolidWorks
    sw = connect_solidworks(visible=args.visible)
    time.sleep(2)

    catalog_entries = []
    success = 0
    fail = 0

    for item in BVL_FILES:
        taglia = item['taglia']
        src_dir = pathlib.Path(BVL_ROOT) / item['folder']
        dest_dir = PUBLIC_DB / taglia
        os.makedirs(dest_dir, exist_ok=True)

        print(f"\n{'='*60}")
        print(f"[{taglia}] {item['desc']}")
        print(f"{'='*60}")

        # --- GLB ---
        asm_path = src_dir / item['asm']
        glb_name = f"prd-bvl-{taglia.lower()}-a000-x.glb"
        glb_path = dest_dir / glb_name

        if asm_path.exists():
            print(f"  ASM -> GLB: {asm_path.name}")
            ok, msg = convert_asm_to_glb(sw, str(asm_path), str(glb_path))
            print(f"    {msg}")
            if ok == "STEP":
                # STEP exported, needs further conversion
                print(f"    NOTA: STEP esportato, serve tool di conversione STEP->GLB")
                fail += 1
            elif ok:
                success += 1
            else:
                fail += 1
        else:
            print(f"  ATTENZIONE: ASM non trovato: {asm_path}")
            fail += 1

        # --- PDF ---
        pdf_files = []
        for drw_name in item['drw']:
            drw_path = src_dir / drw_name
            pdf_name = drw_name.replace('.SLDDRW', '.pdf').replace('.slddrw', '.pdf')
            pdf_path = dest_dir / pdf_name

            if drw_path.exists():
                print(f"  DRW -> PDF: {drw_name}")
                ok, msg = convert_drw_to_pdf(sw, str(drw_path), str(pdf_path))
                print(f"    {msg}")
                if ok:
                    pdf_files.append(f"PRD/BVL/{taglia}/{pdf_name}")
            else:
                print(f"  ATTENZIONE: DRW non trovato: {drw_path}")

        # --- Catalog entry ---
        if glb_path.exists():
            entry = {
                "name": glb_name.replace('.glb', ''),
                "glb": f"PRD/BVL/{taglia}/{glb_name}",
                "folder": f"PRD/BVL/{taglia}",
                "family": "BVL",
                "pdf": pdf_files[0] if pdf_files else None,
                "xls": None,
                "code": item['codice'],
                "description": item['desc']
            }
            catalog_entries.append(entry)

    # Aggiorna catalogo
    print(f"\n{'='*60}")
    if catalog_entries:
        update_catalog(catalog_entries)
    else:
        print("Nessun GLB creato, catalog.json non aggiornato.")

    print(f"\nRisultato: {success} convertiti, {fail} errori")
    print(f"Prodotti aggiunti al catalogo: {len(catalog_entries)}")


if __name__ == "__main__":
    main()
