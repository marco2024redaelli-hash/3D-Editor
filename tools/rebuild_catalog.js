/**
 * Rebuild catalog.json from public/db/ with BOM specs integrated.
 * Single source of truth: scans public/db/ for all GLB/PDF/XLS files,
 * links them together, and enriches with BOM data.
 *
 * Usage: node tools/rebuild_catalog.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const DB_DIR = path.join(ROOT, 'public', 'db');
const CATALOG_PATH = path.join(ROOT, 'public', 'catalog.json');
const BOM_PATH = path.join(ROOT, 'public', 'bom_database.json');

// Load existing catalog to preserve manually assigned codes
const oldCatalog = fs.existsSync(CATALOG_PATH)
    ? JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'))
    : [];
const oldCodeMap = {};
for (const e of oldCatalog) {
    if (e.glb && e.code) oldCodeMap[e.glb] = e.code;
}

// Load BOM database
let bomDB = null;
if (fs.existsSync(BOM_PATH)) {
    bomDB = JSON.parse(fs.readFileSync(BOM_PATH, 'utf-8'));
    console.log(`BOM loaded: ${Object.keys(bomDB.products).length} products`);
}

// Decode model type from filename suffix
function decodeType(name) {
    const n = name.toLowerCase();
    if (n.match(/[-]ac\d/)) return 'ac';   // assemblaggio completo
    if (n.match(/[-]sa\d/)) return 'sa';   // sottoassemblaggio
    if (n.match(/[-]s\d/) && !n.match(/[-]sa\d/)) return 's'; // parte singola
    if (n.match(/[-]c\d/) && !n.match(/[-]cc/)) return 'c';   // complessivo
    if (n.match(/[-]v\d/)) return 'v';     // vista
    if (n.match(/[-]p\d/) && !n.match(/[-]pr/)) return 'p';   // particolare
    return null;
}

// Extract BOM specs for a catalog item
function extractBomSpecs(itemName, folder) {
    if (!bomDB) return null;
    const nameClean = itemName.replace(/-x$/, '').toUpperCase();

    let bestMatch = null;
    let bestKey = null;
    for (const [key, prod] of Object.entries(bomDB.products)) {
        const bomClean = key.toUpperCase().replace(/\s.*$/, '');
        if (nameClean.includes(bomClean) || bomClean.includes(nameClean)) {
            bestMatch = prod;
            bestKey = key;
            break;
        }
    }
    if (!bestMatch) return null;

    const specs = { parti: bestMatch.parts.length };
    const fullText = bestMatch.parts.map(p => (p.desc || '') + ' ' + (p.descExtra || '')).join(' ');

    // Base vibrante
    const vlMatch = fullText.match(/VL\s*(\d+)/);
    if (vlMatch) specs.baseVib = 'VL' + vlMatch[1];

    // Lunghezza
    const lenMatch = fullText.match(/L[.:=\s]*(\d{3,4})\s*(mm)?/i);
    if (lenMatch) {
        const l = parseInt(lenMatch[1]);
        if (l >= 100 && l <= 3000) specs.lunghezza = l;
    }

    // Diametro
    const diaMatch = fullText.match(/[ØO]\s*(\d{3,4})/);
    if (diaMatch) specs.diametro = parseInt(diaMatch[1]);

    // Materiali principali (top 2)
    const mats = new Set();
    bestMatch.parts.slice(0, 8).forEach(p => {
        if (p.material && !p.material.includes('non specificato')) mats.add(p.material);
    });
    if (mats.size > 0) specs.materiale = [...mats].slice(0, 2).join(', ');

    // Uscita cavo
    const cavoMatch = fullText.match(/Uscita cavo\s*(Dx|Sx)/i);
    if (cavoMatch) specs.uscitaCavo = cavoMatch[1];

    // Descrizione principale
    const mainPart = bestMatch.parts.find(p => {
        const d = (p.desc || '').toLowerCase();
        return d.includes('base') || d.includes('canale') || d.includes('cont') ||
               d.includes('coperchi') || d.includes('alimenta') || d.includes('piastr');
    });
    if (mainPart) specs.descrizione = mainPart.desc + (mainPart.descExtra ? ' ' + mainPart.descExtra : '');

    return specs;
}

// Walk public/db and build catalog
console.log(`Scanning ${DB_DIR}...`);
const catalog = [];

function walk(dir, relPath) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile());
    const dirs = entries.filter(e => e.isDirectory());

    const glbs = files.filter(f => f.name.toLowerCase().endsWith('.glb'));
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    const xlss = files.filter(f => f.name.toLowerCase().match(/\.(xls|xlsx)$/));

    for (const glb of glbs) {
        const glbRel = relPath ? relPath + '/' + glb.name : glb.name;
        const folder = relPath || '';
        const name = path.parse(glb.name).name.toLowerCase();

        // Find best matching PDF (same folder, then parent)
        let pdf = null;
        if (pdfs.length > 0) {
            // Try exact name match first
            const exactPdf = pdfs.find(f =>
                f.name.toLowerCase().replace('.pdf', '').replace(/-al$|-a$|-vb$/, '') ===
                name.replace(/-x$/, '')
            );
            pdf = (relPath ? relPath + '/' : '') + (exactPdf || pdfs[0]).name;
        }
        if (!pdf && relPath) {
            // Check parent folder
            const parentDir = path.dirname(path.join(DB_DIR, relPath));
            if (fs.existsSync(parentDir)) {
                const parentPdfs = fs.readdirSync(parentDir).filter(f => f.toLowerCase().endsWith('.pdf'));
                if (parentPdfs.length > 0) {
                    pdf = path.dirname(relPath) + '/' + parentPdfs[0];
                }
            }
        }

        // Find XLS files
        let xls = null;
        if (xlss.length > 0) {
            xls = xlss.map(x => (relPath ? relPath + '/' : '') + x.name);
        }
        if (!xls && relPath) {
            const parentDir = path.dirname(path.join(DB_DIR, relPath));
            if (fs.existsSync(parentDir)) {
                const parentXls = fs.readdirSync(parentDir).filter(f => f.toLowerCase().match(/\.(xls|xlsx)$/));
                if (parentXls.length > 0) {
                    xls = parentXls.map(x => path.dirname(relPath) + '/' + x);
                }
            }
        }

        // Extract family and series from folder
        const folderParts = folder.split('/');
        const family = folderParts.length >= 2 ? folderParts[1] : null;
        const series = folderParts.length >= 3 ? folderParts[2] : null;

        // Decode type
        const type = decodeType(name);

        // Preserve existing code
        const code = oldCodeMap[glbRel] || null;

        // Extract BOM specs
        const specs = extractBomSpecs(name, folder);

        const entry = {
            name,
            glb: glbRel,
            pdf: pdf || null,
            xls: xls || null,
            code,
            folder,
            family: family || null,
            series: series || null,
            type: type || null,
        };

        if (specs) entry.specs = specs;

        catalog.push(entry);
    }

    for (const d of dirs) {
        walk(path.join(dir, d.name), relPath ? relPath + '/' + d.name : d.name);
    }
}

walk(DB_DIR, '');

// Sort by folder then name
catalog.sort((a, b) => (a.folder + '/' + a.name).localeCompare(b.folder + '/' + b.name));

// Write catalog
fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf-8');

// Stats
const withPdf = catalog.filter(i => i.pdf).length;
const withXls = catalog.filter(i => i.xls).length;
const withSpecs = catalog.filter(i => i.specs).length;
const withCode = catalog.filter(i => i.code).length;
const families = new Set(catalog.map(i => i.family).filter(Boolean));

console.log(`\n=== CATALOG REBUILT ===`);
console.log(`Total entries:  ${catalog.length}`);
console.log(`With PDF:       ${withPdf}`);
console.log(`With XLS:       ${withXls}`);
console.log(`With BOM specs: ${withSpecs}`);
console.log(`With code:      ${withCode}`);
console.log(`Families:       ${families.size} (${[...families].sort().join(', ')})`);
console.log(`Output:         ${CATALOG_PATH}`);