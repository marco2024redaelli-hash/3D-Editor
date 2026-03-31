const fs = require('fs');
const path = require('path');
const catalog = require('../public/catalog.json');

const PDM_ROOT = 'C:/PDM_Vault';
const DB_ROOT = path.join(__dirname, '../public/db');

console.log('Scansione PDM_Vault in corso...');
function walkDir(dir) {
    let r = [];
    try {
        fs.readdirSync(dir).forEach(item => {
            const full = path.join(dir, item);
            try {
                const stat = fs.statSync(full);
                if (stat.isDirectory()) r.push(...walkDir(full));
                else {
                    const lower = item.toLowerCase();
                    if (lower.endsWith('.pdf') || lower.match(/\.xlsx?$/)) {
                        r.push({ name: item, path: full });
                    }
                }
            } catch(e) {}
        });
    } catch(e) {}
    return r;
}

const vaultFiles = walkDir(PDM_ROOT);
const vaultPdfs = vaultFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
const vaultXls = vaultFiles.filter(f => f.name.toLowerCase().match(/\.xlsx?$/));
console.log('PDF:', vaultPdfs.length, '| XLS:', vaultXls.length);

// Indicizza TUTTI i file per nome base (parte prima del primo spazio o suffisso variante)
// Es. "PRD-CCP-0001-0005-AC001-A.xls" -> base "PRD-CCP-0001-0005-AC001"
// Es. "CMP-CCCP-CRP-A001 - DETTAGLIATA - 08SA01305.xls" -> base "CMP-CCCP-CRP-A001"
function extractBase(filename) {
    // Rimuovi estensione
    let name = filename.replace(/\.(pdf|xlsx?)$/i, '').toUpperCase();
    // Rimuovi suffissi descrittivi dopo spazio
    name = name.replace(/\s+[-–].*/,'').replace(/\s+DETTAGLIATA.*/i,'').replace(/\s+SOLO PARTI.*/i,'').replace(/\s+ELENCO.*/i,'').trim();
    // Rimuovi suffisso variante finale (-A, -B, -C, -7016, -9006, -X, -AL, -D, etc)
    // Ma solo se la parte prima è un codice tipo AC001, SA001, P0001, S0001, V0001, etc
    const match = name.match(/^(.+?-(?:AC?\d+|SA\d+|[PSVRCA]\d+|PV\d+|CV\d+))(?:-.*)?$/);
    if (match) return match[1];
    return name;
}

const pdfByBase = {};
vaultPdfs.forEach(p => {
    const base = extractBase(p.name);
    if (!pdfByBase[base]) pdfByBase[base] = [];
    pdfByBase[base].push(p);
});
const xlsByBase = {};
vaultXls.forEach(x => {
    const base = extractBase(x.name);
    if (!xlsByBase[base]) xlsByBase[base] = [];
    xlsByBase[base].push(x);
});

console.log('Basi PDF uniche:', Object.keys(pdfByBase).length);
console.log('Basi XLS uniche:', Object.keys(xlsByBase).length);

// Per ogni GLB, estrai la base
function glbToBase(c) {
    let name = c.name;
    // Rimuovi timestamp
    name = name.replace(/_\d{2}-\d{2}-\d{2,4}$/, '');
    // Rimuovi -x finale
    name = name.replace(/-x$/i, '');
    // Rimuovi suffisso variante (-a, -b, ecc) per file tipo ac001-a
    name = name.replace(/-[a-c]$/i, '');
    return name.toUpperCase();
}

// Stato prima
const noPdfBefore = catalog.filter(c => !c.pdf).length;
const noXlsBefore = catalog.filter(c => !c.xls).length;

let pdfFound = 0, xlsFound = 0, pdfCopied = 0, xlsCopied = 0;
const pdfExamples = [], xlsExamples = [];

// Cerca PDF per GLB senza PDF
catalog.filter(c => !c.pdf).forEach(c => {
    const base = glbToBase(c);
    const matches = pdfByBase[base];
    if (matches && matches.length > 0) {
        // Prendi il primo match (preferisci -A se disponibile)
        const pick = matches.find(m => m.name.toUpperCase().includes('-A.PDF')) || matches[0];
        const destName = pick.name;
        const destPath = path.join(DB_ROOT, c.folder, destName);
        const relPath = c.folder + '/' + destName;

        try {
            fs.mkdirSync(path.join(DB_ROOT, c.folder), { recursive: true });
            if (!fs.existsSync(destPath)) {
                fs.copyFileSync(pick.path, destPath);
                pdfCopied++;
            }
            c.pdf = relPath;
            pdfFound++;
            if (pdfExamples.length < 15) pdfExamples.push(`  ${c.name} -> ${destName}`);
        } catch(e) {
            if (pdfExamples.length < 3) pdfExamples.push(`  ERRORE ${c.name}: ${e.message}`);
        }
    }
});

// Cerca XLS per GLB senza XLS
catalog.filter(c => !c.xls).forEach(c => {
    const base = glbToBase(c);
    const matches = xlsByBase[base];
    if (matches && matches.length > 0) {
        // Preferisci file senza "dettagliata" o "solo parti" (la distinta base semplice)
        const pick = matches.find(m => {
            const n = m.name.toUpperCase();
            return !n.includes('DETTAGLIATA') && !n.includes('SOLO PARTI') && !n.includes('ELENCO');
        }) || matches[0];
        const destName = pick.name;
        const destPath = path.join(DB_ROOT, c.folder, destName);
        const relPath = c.folder + '/' + destName;

        try {
            fs.mkdirSync(path.join(DB_ROOT, c.folder), { recursive: true });
            if (!fs.existsSync(destPath)) {
                fs.copyFileSync(pick.path, destPath);
                xlsCopied++;
            }
            c.xls = relPath;
            xlsFound++;
            if (xlsExamples.length < 15) xlsExamples.push(`  ${c.name} -> ${destName}`);
        } catch(e) {
            if (xlsExamples.length < 3) xlsExamples.push(`  ERRORE ${c.name}: ${e.message}`);
        }
    }
});

// Risultati
const noPdfAfter = catalog.filter(c => !c.pdf).length;
const noXlsAfter = catalog.filter(c => !c.xls).length;

console.log('\n=== RISULTATI ===');
console.log(`PDF trovati: +${pdfFound} (copiati su disco: ${pdfCopied})`);
console.log(`XLS trovati: +${xlsFound} (copiati su disco: ${xlsCopied})`);
console.log(`\nPRIMA  -> Senza PDF: ${noPdfBefore}/${catalog.length} | Senza XLS: ${noXlsBefore}/${catalog.length}`);
console.log(`DOPO   -> Senza PDF: ${noPdfAfter}/${catalog.length} | Senza XLS: ${noXlsAfter}/${catalog.length}`);
console.log(`\nCon PDF: ${catalog.length - noPdfAfter} (${Math.round((catalog.length - noPdfAfter)/catalog.length*100)}%) | Con XLS: ${catalog.length - noXlsAfter} (${Math.round((catalog.length - noXlsAfter)/catalog.length*100)}%)`);

if (pdfExamples.length > 0) {
    console.log('\nEsempi PDF:');
    pdfExamples.forEach(e => console.log(e));
}
if (xlsExamples.length > 0) {
    console.log('\nEsempi XLS:');
    xlsExamples.forEach(e => console.log(e));
}

fs.writeFileSync(path.join(__dirname, '../public/catalog.json'), JSON.stringify(catalog, null, 2));
console.log('\ncatalog.json aggiornato!');
