const fs = require('fs');
const path = require('path');
const catalog = require('../public/catalog.json');

// Scansiona tutti i file su disco in db/
function walkDir(dir, base) {
    let results = [];
    try {
        fs.readdirSync(dir).forEach(item => {
            const full = path.join(dir, item);
            const rel = base ? base + '/' + item : item;
            if (fs.statSync(full).isDirectory()) results.push(...walkDir(full, rel));
            else results.push(rel);
        });
    } catch(e) {}
    return results;
}

const dbRoot = path.join(__dirname, '../public/db');
const allFiles = walkDir(dbRoot, '');
const pdfFiles = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
const xlsFiles = allFiles.filter(f => f.toLowerCase().match(/\.xlsx?$/));

console.log('File su disco - PDF:', pdfFiles.length, '| XLS:', xlsFiles.length);

// Indicizza PDF e XLS per cartella
const pdfByFolder = {};
pdfFiles.forEach(p => {
    const folder = path.dirname(p).replace(/\\/g, '/');
    if (!pdfByFolder[folder]) pdfByFolder[folder] = [];
    pdfByFolder[folder].push(p);
});
const xlsByFolder = {};
xlsFiles.forEach(x => {
    const folder = path.dirname(x).replace(/\\/g, '/');
    if (!xlsByFolder[folder]) xlsByFolder[folder] = [];
    xlsByFolder[folder].push(x);
});

// Stato prima
const noPdfBefore = catalog.filter(c => !c.pdf).length;
const noXlsBefore = catalog.filter(c => !c.xls).length;

/**
 * Dal nome GLB estrai la base per il match:
 * - prd-cnl-0001-0001-ac001.glb -> PRD-CNL-0001-0001-AC001
 * - prd-alm01-m-0001-ac001-x.glb -> PRD-ALM01-M-0001-AC001
 * - cmp-calm-as-p0007-x.glb -> CMP-CALM-AS-P0007
 */
function glbToBase(glbPath) {
    const name = path.basename(glbPath, '.glb');
    // Rimuovi suffisso -x se presente, poi uppercase
    let base = name.replace(/-x$/i, '').toUpperCase();
    // Rimuovi eventuali suffissi timestamp (es. _21-11-25)
    base = base.replace(/_\d{2}-\d{2}-\d{2,4}$/, '');
    return base;
}

let pdfFound = 0, xlsFound = 0;
const pdfExamples = [], xlsExamples = [];

catalog.forEach(c => {
    const base = glbToBase(c.glb);

    // Cerca PDF se mancante
    if (!c.pdf) {
        const folderPdfs = pdfByFolder[c.folder] || [];
        // Strategia 1: PDF con stesso nome base (senza suffisso variante)
        // es. base = PRD-CNL-0001-0001-AC001 -> cerca PDF che inizia con PRD-CNL-0001-0001-AC001
        let match = folderPdfs.find(p => {
            const pName = path.basename(p).replace(/\.pdf$/i, '').toUpperCase();
            // Match esatto o con suffisso variante (-A, -7016, ecc)
            return pName === base || pName.startsWith(base + '-') || pName.startsWith(base + '.');
        });

        // Strategia 2: per file con -x, cerca il PDF dove -X è sostituito con qualsiasi cosa
        if (!match && c.name.endsWith('-x')) {
            match = folderPdfs.find(p => {
                const pName = path.basename(p).replace(/\.pdf$/i, '').toUpperCase();
                return pName.startsWith(base + '-');
            });
        }

        if (match) {
            c.pdf = match;
            pdfFound++;
            if (pdfExamples.length < 15) pdfExamples.push(`  ${c.name} -> ${match}`);
        }
    }

    // Cerca XLS se mancante
    if (!c.xls) {
        const folderXls = xlsByFolder[c.folder] || [];
        let match = folderXls.find(x => {
            const xName = path.basename(x).replace(/\.xlsx?$/i, '').toUpperCase();
            // XLS può avere suffissi come '-Dettagliata', ' solo parti'
            return xName === base || xName.startsWith(base + '-') || xName.startsWith(base + ' ');
        });

        if (!match && c.name.endsWith('-x')) {
            match = folderXls.find(x => {
                const xName = path.basename(x).replace(/\.xlsx?$/i, '').toUpperCase();
                return xName.startsWith(base + '-') || xName.startsWith(base + ' ');
            });
        }

        if (match) {
            c.xls = match;
            xlsFound++;
            if (xlsExamples.length < 15) xlsExamples.push(`  ${c.name} -> ${match}`);
        }
    }
});

// Stato dopo
const noPdfAfter = catalog.filter(c => !c.pdf).length;
const noXlsAfter = catalog.filter(c => !c.xls).length;

console.log('\n=== RISULTATI ===');
console.log(`PDF linkati: +${pdfFound} nuovi`);
console.log(`XLS linkati: +${xlsFound} nuovi`);
console.log(`\nPRIMA  -> Senza PDF: ${noPdfBefore}/${catalog.length} | Senza XLS: ${noXlsBefore}/${catalog.length}`);
console.log(`DOPO   -> Senza PDF: ${noPdfAfter}/${catalog.length} | Senza XLS: ${noXlsAfter}/${catalog.length}`);
console.log(`\nCon PDF: ${catalog.length - noPdfAfter} | Con XLS: ${catalog.length - noXlsAfter}`);

if (pdfExamples.length > 0) {
    console.log('\nEsempi PDF match:');
    pdfExamples.forEach(e => console.log(e));
}
if (xlsExamples.length > 0) {
    console.log('\nEsempi XLS match:');
    xlsExamples.forEach(e => console.log(e));
}

// Salva
fs.writeFileSync(path.join(__dirname, '../public/catalog.json'), JSON.stringify(catalog, null, 2));
console.log('\ncatalog.json aggiornato!');
