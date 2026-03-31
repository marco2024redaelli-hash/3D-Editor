# GLB 3D Editor — DECA 3D Viewer

Editor 3D professionale per file GLB/GLTF con intelligenza artificiale integrata, sviluppato per **DECA S.r.l.**

Permette di visualizzare, assemblare e gestire modelli 3D di alimentatori vibranti, nastri trasportatori, tramogge, cappe afoniche e componenti industriali per l'automazione.

**Live:** [glb-3d-editor.web.app](https://glb-3d-editor.web.app)

---

## DecAI — Assistente AI aziendale

Il cuore del progetto è **DecAI**, un LLM basato su Meta Llama 3 (8B, Q4_K_M), fine-tuned con Unsloth + QLoRA sui dati tecnici DECA (catalogo prodotti, distinte base, nomenclatura componenti).

- **Inferenza locale** su GPU NVIDIA RTX 4000 Ada (20 GB VRAM) via LM Studio (porta 1234)
- **Nessuna dipendenza cloud**: dati aziendali mai esposti a servizi esterni
- **System prompt specializzato**: risponde in italiano e produce azioni JSON per controllare la scena 3D (spostare, ruotare, colorare, caricare modelli)
- **Backend configurabile**: LM Studio locale, Cloudflare Tunnel, server DECAAI custom

## Funzionalità principali

- Caricamento GLB/GLTF via file picker o drag & drop
- Esportazione multi-formato: GLB, GLTF, OBJ, STL
- Trasformazioni: sposta (W), ruota (E), scala (R) con snap configurabile
- Undo/Redo (Ctrl+Z / Ctrl+Y)
- Misura distanza 2 punti (M)
- Accoppiamento superfici (mate a 2 fasi: sorgente + destinazione)
- Duplicazione e specchiatura oggetti (X, Y, Z)
- Materiali PBR: colore, emissivo, metallicità, rugosità, opacità, wireframe
- Bordi stile SolidWorks con angolo configurabile
- Visualizzatore PDF integrato (disegni tecnici)
- Visualizzatore XLS integrato (distinte base, via SheetJS)
- Autenticazione Google / email (Firebase Auth)

## Libreria prodotti

Navigazione gerarchica a cartelle basata su `db_tree.json`, con breadcrumb e ricerca.

| Categoria | Contenuto |
|-----------|-----------|
| **CMP** | Componenti (organizzati per famiglia/tipo) |
| **PRD** | Prodotti (organizzati per codice prodotto) |

Ogni modello può avere associati file `.glb` (3D), `.pdf` (disegno tecnico) e `.xls` (distinta base/BOM).

Indici: `catalog.json`, `drawings_index.json`, `distinte_index.json`, `bom_database.json`.

## Comandi DecAI

**Ricerca e libreria:**

| Comando | Descrizione |
|---------|-------------|
| `[nome prodotto]` | Cerca per descrizione nella libreria PRD |
| `aggiungi [nome]` | Carica un modello .glb dalla libreria |
| `disegno [nome]` | Apre il disegno PDF associato |
| `distinta [nome]` | Apre la distinta Excel associata |

**Trasformazioni:**

| Comando | Descrizione |
|---------|-------------|
| `seleziona [nome]` | Seleziona un oggetto in scena |
| `sposta x y z` | Sposta l'oggetto selezionato |
| `ruota x y z` | Ruota in gradi |
| `colore [colore]` | Cambia colore (nome o #hex) |
| `accoppia` | Avvia il modo accoppiamento facce |
| `duplica [nome]` | Duplica un oggetto |
| `sistema` | Disponi tutti gli oggetti in griglia |

**Database:**

| Comando | Descrizione |
|---------|-------------|
| `search_bom [codice]` | Cerca nella distinta base |
| `search_drawing [codice]` | Cerca disegni tecnici |
| `search_distinta [codice]` | Cerca fogli di assemblaggio |

## API REST (serve_editor.py)

Server locale (porta 3000) per controllo programmatico della scena:

- `POST /api/commands` — add_primitive, set_transform, set_material, delete, select, fit_camera, clear
- `GET /api/scene-info` — stato della scena (oggetti, posizioni, selezione)
- Primitive: box, sphere, cylinder, cone, torus, plane, capsule

## Scorciatoie tastiera

| Tasto | Azione |
|-------|--------|
| `W` | Modalità traslazione |
| `E` | Modalità rotazione |
| `R` | Modalità scala |
| `M` | Strumento misura |
| `ESC` | Annulla operazione |
| `Delete` | Elimina oggetto selezionato |
| `Ctrl+Z` | Annulla |
| `Ctrl+Y` | Ripristina |

## Struttura progetto

```
public/                     File web (Firebase Hosting)
  glb_editor.html           Editor 3D (app principale)
  catalog.json              Indice unificato dei modelli
  db_tree.json              Struttura gerarchica cartelle
  bom_database.json         Database distinte base (BOM)
  db/                       File serviti (CMP/ e PRD/)

DATABASE1/                  Archivio dati di progetto (sorgente)
  CMP/                      Componenti per famiglia
  PRD/                      Prodotti per codice

tools/                      Script CLI
  serve_editor.py           Server locale + API REST
  glb_modifier.py           Modifica GLB da terminale
  rebuild_catalog.py        Ricostruisce catalog.json
  build_bom_db.py           Costruisce bom_database.json
  create_training7.js       Generazione dati training AI

firebase.json               Configurazione Firebase Hosting
firestore.rules             Regole sicurezza Firestore
```

## Stack tecnologico

- **Frontend**: Three.js, MeshPhysicalMaterial (PBR), CSS2DRenderer
- **AI**: Meta Llama 3 8B (QLoRA fine-tuned), LM Studio
- **Hosting**: Firebase Hosting + Firestore
- **Auth**: Firebase Authentication (Google / email)
- **GPU**: NVIDIA RTX 4000 Ada (20 GB VRAM), inferenza locale

## Note

- `DATABASE1/` non viene deployata su Firebase — solo `public/` viene servito
- Il fine-tuning è stato eseguito con Unsloth + QLoRA in WSL2 (Ubuntu 22.04)
- Header Cross-Origin-Opener-Policy per compatibilità Google Auth
