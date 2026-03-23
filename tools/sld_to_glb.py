"""
sld_to_glb.py
=============
Converte tutti i file .sldprt / .sldasm di DATABASE1 in .glb
usando la COM API di SolidWorks (richiede SW 2019+ installato).

Convenzione nomi (da CODIFICA PARTE TERMINALE FILE.xlsx):
  - Il file 3D usa il suffisso -X:  es. PRD-ALM01-M-0001-AC001-X.SLDASM
  - Il GLB output sarà:              PRD-ALM01-M-0001-AC001-X.glb
  (stessa cartella, stessa base, solo estensione cambiata)

Uso:
  python sld_to_glb.py [DATABASE_PATH] [opzioni]

  DATABASE_PATH   Cartella radice (default: ~/Desktop/DATABASE1)

Opzioni:
  --dry-run       Mostra cosa farebbe senza convertire
  --skip-existing Salta file .glb già presenti (default: True)
  --limit N       Converte al massimo N file (utile per test)
  --filter TESTO  Converte solo file il cui percorso contiene TESTO
                  es: --filter PRD/ALM01

Requisiti:
  pip install pywin32
  SolidWorks 2019+ installato e licenziato
"""

import os
import sys
import time
import argparse
import pathlib

try:
    import win32com.client
    import pythoncom
except ImportError:
    print("ERRORE: pywin32 non installato. Esegui: pip install pywin32")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Costanti SolidWorks COM
# ---------------------------------------------------------------------------
SW_DOC_PART     = 1
SW_DOC_ASSEMBLY = 2

# Opzioni apertura: 1=Silent, 2=ReadOnly  (si possono combinare)
SW_OPEN_SILENT   = 1
SW_OPEN_READONLY = 2

# SaveAs: versione corrente=0, opzioni silent=1
SW_SAVE_CURRENT  = 0
SW_SAVE_SILENT   = 1

# ---------------------------------------------------------------------------

def find_sld_files(root: str, skip_existing: bool, filter_str: str = None):
    """Ritorna lista di (sld_path, glb_path) da convertire."""
    root = pathlib.Path(root)
    results = []
    for ext in ('*.SLDPRT', '*.sldprt', '*.SLDASM', '*.sldasm'):
        for sld in root.rglob(ext):
            glb = sld.with_suffix('.glb')
            # Rinomina: stessa cartella, stesso nome, estensione .glb minuscola
            glb = sld.parent / (sld.stem + '.glb')

            if filter_str and filter_str.lower() not in str(sld).lower():
                continue
            if skip_existing and glb.exists():
                continue
            results.append((str(sld), str(glb)))
    return sorted(results)


def connect_solidworks(visible: bool = False):
    """Connette a SolidWorks (lo avvia se non attivo)."""
    print("Connessione a SolidWorks...")
    pythoncom.CoInitialize()
    try:
        sw = win32com.client.Dispatch("SldWorks.Application")
    except Exception as e:
        print(f"ERRORE: impossibile avviare SolidWorks: {e}")
        print("Assicurati che SolidWorks sia installato e licenziato.")
        sys.exit(1)
    sw.Visible = visible
    sw.UserControl = False          # non interrompere con dialog box
    print(f"SolidWorks connesso — versione: {sw.RevisionNumber()}")
    return sw


def convert_file(sw, sld_path: str, glb_path: str) -> tuple[bool, str]:
    """
    Apre il file SolidWorks ed esporta in GLB.
    Ritorna (successo, messaggio).
    """
    ext = pathlib.Path(sld_path).suffix.lower()
    doc_type = SW_DOC_PART if ext == '.sldprt' else SW_DOC_ASSEMBLY

    errors   = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, -1)
    warnings = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, -1)

    # Apri il documento
    doc = sw.OpenDoc6(
        sld_path,
        doc_type,
        SW_OPEN_SILENT | SW_OPEN_READONLY,
        "",         # configurazione (vuoto = default)
        errors,
        warnings
    )

    if doc is None:
        return False, f"Apertura fallita (err={errors.value})"

    try:
        # Esporta in GLB — SaveAs3(path, version, options)
        # SolidWorks deduce il formato dall'estensione .glb
        result = doc.SaveAs3(glb_path, SW_SAVE_CURRENT, SW_SAVE_SILENT)
        if result:
            size_kb = os.path.getsize(glb_path) // 1024
            return True, f"OK ({size_kb} KB)"
        else:
            # Prova con Extension.SaveAs (API alternativa)
            ext_errors   = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, -1)
            ext_warnings = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, -1)
            result2 = doc.Extension.SaveAs(
                glb_path,
                SW_SAVE_CURRENT,
                SW_SAVE_SILENT,
                None,           # export data (None = default per .glb)
                ext_errors,
                ext_warnings
            )
            if result2:
                size_kb = os.path.getsize(glb_path) // 1024
                return True, f"OK via Extension.SaveAs ({size_kb} KB)"
            return False, f"Esportazione fallita (SaveAs={result}, Ext={result2})"
    except Exception as e:
        return False, f"Eccezione: {e}"
    finally:
        try:
            sw.CloseDoc(sld_path)
        except:
            pass


def main():
    parser = argparse.ArgumentParser(description="Converti SolidWorks → GLB")
    parser.add_argument("db_path", nargs="?",
                        default=os.path.join(os.path.expanduser("~"), "Desktop", "DATABASE1"),
                        help="Cartella DATABASE1")
    parser.add_argument("--dry-run", action="store_true",
                        help="Mostra cosa farebbe senza convertire")
    parser.add_argument("--no-skip-existing", action="store_true",
                        help="Riconverti anche i GLB già presenti")
    parser.add_argument("--limit", type=int, default=0,
                        help="Limite file da convertire (0 = tutti)")
    parser.add_argument("--filter", default="",
                        help="Filtra per percorso contenente questa stringa")
    parser.add_argument("--visible", action="store_true",
                        help="Mostra la finestra di SolidWorks")
    args = parser.parse_args()

    skip_existing = not args.no_skip_existing
    db_path = args.db_path

    if not os.path.isdir(db_path):
        print(f"ERRORE: cartella non trovata: {db_path}")
        sys.exit(1)

    # Raccogli file da convertire
    print(f"Scansione {db_path} ...")
    files = find_sld_files(db_path, skip_existing, args.filter)
    total = len(files)

    if args.limit > 0:
        files = files[:args.limit]

    print(f"File da convertire: {len(files)}{' (limitato a ' + str(args.limit) + ')' if args.limit else ''} / {total} totali trovati")

    if not files:
        print("Nessun file da convertire.")
        return

    if args.dry_run:
        print("\n--- DRY RUN ---")
        for sld, glb in files[:20]:
            print(f"  {sld}")
            print(f"  → {glb}")
        if len(files) > 20:
            print(f"  ... e altri {len(files)-20} file")
        return

    # Connetti a SolidWorks
    sw = connect_solidworks(visible=args.visible)

    # Conversione
    success_count = 0
    fail_count    = 0
    skip_count    = 0
    errors_log    = []
    t_start       = time.time()

    for i, (sld_path, glb_path) in enumerate(files, 1):
        rel = os.path.relpath(sld_path, db_path)
        elapsed = time.time() - t_start
        avg = elapsed / i
        remaining = avg * (len(files) - i)
        print(f"[{i}/{len(files)}] {rel}")
        print(f"         → {os.path.basename(glb_path)}  "
              f"(~{remaining/60:.1f} min rimanenti)", end="  ", flush=True)

        ok, msg = convert_file(sw, sld_path, glb_path)
        print(msg)

        if ok:
            success_count += 1
        else:
            fail_count += 1
            errors_log.append((rel, msg))

    # Report finale
    total_time = time.time() - t_start
    print("\n" + "="*60)
    print(f"COMPLETATO in {total_time/60:.1f} min")
    print(f"  Convertiti con successo : {success_count}")
    print(f"  Errori                  : {fail_count}")
    if errors_log:
        print("\nFile con errori:")
        for path, msg in errors_log:
            print(f"  {path} — {msg}")

    # Salva log errori
    if errors_log:
        log_path = os.path.join(os.path.dirname(__file__), "sld_to_glb_errors.txt")
        with open(log_path, "w", encoding="utf-8") as f:
            for path, msg in errors_log:
                f.write(f"{path}\t{msg}\n")
        print(f"\nLog errori salvato in: {log_path}")


if __name__ == "__main__":
    main()
