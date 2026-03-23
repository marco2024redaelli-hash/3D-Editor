const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const catalogPath = path.join(__dirname, '..', 'public', 'models', 'catalog.json');
const db1Path = path.join(__dirname, '..', 'database', 'DATABASE1');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

// Build index of all PDFs in DATABASE1
const pdfIndex = {};
function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walkDir(full);
        else if (e.name.toLowerCase().endsWith('.pdf')) {
            const base = e.name.replace(/\.pdf$/i, '').toUpperCase();
            if (!pdfIndex[base]) pdfIndex[base] = [];
            pdfIndex[base].push(full);
        }
    }
}
walkDir(db1Path);

console.log(`Catalogo: ${catalog.length} modelli`);
console.log(`PDF trovati: ${Object.keys(pdfIndex).length} codici unici`);

// For each catalog item, find matching PDF and extract "Codice" from title block
let updated = 0;
let notFound = 0;

for (const item of catalog) {
    // Extract base code from catalog name (remove -X suffix, dates, etc.)
    const nameClean = item.name.toUpperCase()
        .replace(/\s*\(\d{2}\/\d{4}\)\s*$/,'') // remove (02/2026)
        .replace(/_?\d{2}-\d{2}-\d{4}$/, '')     // remove date suffix
        .trim();

    // Try various suffix patterns to find matching PDF
    const suffixes = ['', '-A', '-VB', '-AL', '-P', '-C45', '-A-S-VB', '-X'];
    let pdfPath = null;

    // Direct match first
    if (pdfIndex[nameClean]) {
        pdfPath = pdfIndex[nameClean][0];
    }

    // Try removing -X suffix and adding drawing suffixes
    if (!pdfPath) {
        const baseNoX = nameClean.replace(/-X$/, '');
        for (const suf of suffixes) {
            const tryKey = baseNoX + suf;
            if (pdfIndex[tryKey]) {
                pdfPath = pdfIndex[tryKey][0];
                break;
            }
        }
    }

    // Try without last segment (e.g. CMP-CALM-RIV-P0016-X -> CMP-CALM-RIV-P0016)
    if (!pdfPath) {
        const parts = nameClean.split('-');
        if (parts.length > 3) {
            const baseShort = parts.slice(0, -1).join('-');
            for (const suf of suffixes) {
                const tryKey = baseShort + suf;
                if (pdfIndex[tryKey]) {
                    pdfPath = pdfIndex[tryKey][0];
                    break;
                }
            }
        }
    }

    if (!pdfPath) {
        console.log(`[SKIP] ${item.name} - nessun PDF trovato`);
        notFound++;
        continue;
    }

    // Extract "Codice" from PDF title block
    try {
        const text = execSync(`pdftotext "${pdfPath}" -`, {
            encoding: 'utf8',
            timeout: 10000
        });

        // Find "Codice" followed by the code on the next line
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        let codice = '';
        for (let i = 0; i < lines.length; i++) {
            if (/^codice$/i.test(lines[i]) && i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                // Code should be alphanumeric (not another label)
                if (nextLine && /^[A-Za-z0-9\-_]+$/.test(nextLine) && nextLine.length >= 4) {
                    codice = nextLine;
                    break;
                }
            }
        }

        if (codice) {
            if (item.code && item.code === codice) {
                console.log(`[OK]   ${item.name} -> ${codice} (già presente)`);
            } else {
                console.log(`[UPD]  ${item.name} -> ${codice}${item.code ? ' (era: ' + item.code + ')' : ''}`);
                item.code = codice;
                updated++;
            }
        } else {
            console.log(`[SKIP] ${item.name} - codice non trovato nel cartiglio di ${path.basename(pdfPath)}`);
        }
    } catch (err) {
        console.log(`[ERR]  ${item.name} - errore lettura PDF: ${err.message.split('\n')[0]}`);
    }
}

// Save updated catalog
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log(`\nRisultato: ${updated} codici aggiornati, ${notFound} PDF non trovati`);
