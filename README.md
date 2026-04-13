# GLB 3D Editor — DECA 3D Viewer

Editor 3D professionale per file GLB/GLTF con intelligenza artificiale integrata, sviluppato per **DECA S.r.l.**

Permette di visualizzare, assemblare e gestire modelli 3D di alimentatori vibranti, nastri trasportatori, tramogge, cappe afoniche e componenti industriali per l'automazione direttamente al cliente.

**Live:** [glb-3d-editor.web.app](https://glb-3d-editor.web.app)

---

## Autenticazione

Accesso opzionale per salvare progetti su Firestore e ricevere contenuti personalizzati. Pulsante **"Accedi / Registrati"** nell'header della home apre un modal con due metodi:

- **Google Sign-In** (popup Firebase)
- **Link email passwordless** (Firebase `sendSignInLinkToEmail`)

L'utente con email `marco2024redaelli@gmail.com` è riconosciuto come admin e vede in home una card "Analytics" (nascosta a tutti gli altri). Stesso controllo a livello UI sulla dashboard (`analytics_dashboard.html`) e a livello di regole Firestore (`isAdmin()`).

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
- **Richiesta preventivo**: flusso end-to-end dall'editor alla mail commerciale DECA
- **Viewer 3D condivisibile** (`viewer.html`) via link pubblico, con preview Open Graph
- **Analytics dashboard** custom per visite, visitatori, richieste preventivo, sessioni e feedback — accesso riservato all'email admin (Google Sign-In + regole Firestore)
- **Tutorial video auto-loop** in homepage che mostra il flusso end-to-end in 6 scene animate (~40 secondi)
- **Identità visiva DECA** — tema light con rosso corporate `#c41e3a`, blu `#004a99` e sfondo bianco, applicato uniformemente a home, editor, catalogo e analytics

## Sistema preventivi

Il cliente può inviare una richiesta di preventivo a DECA in due modi:

1. **Pulsante "Richiedi Preventivo"** — presente sia nella home sia nell'editor (in basso a destra, gradient rosso→blu DECA). Nell'editor costruisce il preventivo dagli oggetti attualmente in scena.
2. **Tramite DecAI** — se l'utente scrive in chat "voglio un preventivo", "vorrei fare un preventivo", ecc., l'intent viene intercettato localmente: DecAI conferma ("Ok, ti salvo l'attuale progetto e faccio il preventivo...") e apre la mail.

In entrambi i casi:

- Il progetto viene salvato in `localStorage['deca_saved_projects']`
- Viene scritto un documento nella collection Firestore `preventivi` con: `createdAt` (timestamp), `projectName`, `objectCodes`, `contactEmail`, `notes`, `hasConversation`, `conversation` (trascrizione chat DecAI, se presente), `origin` (`decai_chat` o `modal`), `userId`, `userEmail`, `userAgent`
- Si apre il client di posta precompilato con oggetto, lista prodotti e **un link `viewer.html` per ogni prodotto** — il destinatario clicca e vede il modello 3D ruotabile nel browser senza scaricare niente

Accanto al pulsante Preventivo c'è anche un pulsante secondario **"Contatta l'Ufficio Tecnico DECA"** (blu) che apre una mail precompilata verso l'ufficio tecnico.

**Nota**: la conversazione DecAI è visibile solo lato analytics (per comprendere le esigenze del cliente) — non viene inclusa nella mail inviata a DECA.

## Tutorial video (homepage)

Sezione "Come funziona — dall'editor alla richiesta preventivo in 30 secondi" sotto al benvenuto. Loop auto-play in 6 scene animate:

1. **Libreria prodotti**: card con 3D reali (CVM01, BVC, CDZ01, CVE01), la BVC target si illumina al passaggio del cursore
2. **Editor 3D**: modello BVC-431 con auto-rotazione nel viewport mock
3. **Chat DecAI**: l'utente chiede "Ci sono altre taglie della BVC?" — DecAI elenca BVC-331/361/431/532 — l'utente risponde "Ok perfetto, mandami un preventivo" — DecAI conferma
4. **CTA Richiedi Preventivo** con glow
5. **Mail precompilata** con link al viewer 3D
6. **Finale**: checkmark animato + "I nostri commerciali ti contatteranno nel più breve tempo possibile" + contatti

Implementazione self-contained (zero dipendenze, solo CSS+JS inline), cursore animato che si posiziona sugli elementi target, effetto typewriter sui messaggi chat, progress bar con 6 step.

## Analytics Dashboard (`analytics_dashboard.html`)

Dashboard custom (nessuna dipendenza da Google Analytics) che legge collezioni Firestore.

**Accesso riservato**: gate con Google Sign-In, consentito solo a `marco2024redaelli@gmail.com`. Utenti con altre email vengono automaticamente disconnessi. A livello di sicurezza, le regole Firestore (`isAdmin()`) limitano anche la lettura delle collection sensibili alla stessa email — la UI non è bypassabile da DevTools.

Pannelli:

- **Richieste Preventivo** (in cima, full-width): totali, % con conversazione DecAI, ultimi 7 giorni; lista espandibile con data/ora, email utente, codici prodotti, origine (DecAI/modal) e trascrizione chat
- **Visite al Sito**: totali, unici, ultimi 7 giorni + grafico linea 14 giorni
- **Chi ha Visitato il Sito**: lista visitatori identificati (nome + email) e anonimi, con conteggio visite e ultima visita
- **Analisi Abbandono (Funnel)**: visitatori → interazioni → configurazione → engagement
- **Profondita di Interazione**, **Sentiment per Categoria**, **Feature Request Ranking**, **Heatmap Zone**, **Simulazione di Vendita**

Collezioni Firestore usate: `site_visits`, `preventivi`, `analytics_sessions`, `model_feedback`, `feature_requests`, `annotations`.

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
  index.html                Home + lista progetti + richiesta preventivo
  glb_editor.html           Editor 3D (app principale, DecAI, preventivo)
  viewer.html               Viewer 3D condivisibile via link (Open Graph)
  analytics_dashboard.html  Dashboard metriche custom (visite, preventivi, funnel)
  chat_history.html         Storico chat DecAI
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

- **Frontend**: Three.js, MeshPhysicalMaterial (PBR), CSS2DRenderer, Google `<model-viewer>` per anteprime 3D
- **AI**: Meta Llama 3 8B (QLoRA fine-tuned), LM Studio
- **Hosting**: Firebase Hosting + Firestore (piano Spark, no Cloud Functions)
- **Auth**: Firebase Authentication (Google / email)
- **Analytics**: tracking lato browser su collezioni Firestore (`site_visits`, `preventivi`, `chat_sessions`, ecc.), dashboard custom HTML+Chart.js
- **Identità visiva**: rosso DECA `#c41e3a`, blu `#004a99`, bianco, font Inter
- **GPU**: NVIDIA RTX 4000 Ada (20 GB VRAM), inferenza locale DecAI

## Note

- `DATABASE1/` non viene deployata su Firebase — solo `public/` viene servito
- Il fine-tuning è stato eseguito con Unsloth + QLoRA in WSL2 (Ubuntu 22.04)
- Header Cross-Origin-Opener-Policy per compatibilità Google Auth
