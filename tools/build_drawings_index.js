const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const base = path.join(__dirname, '..', 'database', 'DATABASE1');
const outPath = path.join(__dirname, '..', 'public', 'drawings_index.json');

const drawings = [];
let processed = 0;
let withCode = 0;

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.toLowerCase().endsWith('.pdf')) {
            const rel = path.relative(base, full).split(path.sep).join('/');
            const fname = e.name.replace(/\.pdf$/i, '');
            const parts = rel.split('/');

            let codice = '';
            try {
                const text = execSync(`pdftotext "${full}" -`, {
                    encoding: 'utf8',
                    timeout: 10000,
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                const lines = text.split('\n').map(l => l.trim()).filter(l => l);
                for (let i = 0; i < lines.length; i++) {
                    if (/^codice$/i.test(lines[i]) && i + 1 < lines.length) {
                        const nextLine = lines[i + 1].trim();
                        if (nextLine && /^[A-Za-z0-9\-_]+$/.test(nextLine) && nextLine.length >= 4) {
                            codice = nextLine;
                            break;
                        }
                    }
                }
            } catch (err) {
                // skip
            }

            drawings.push({
                code: fname,
                codice: codice,
                category: parts[0] || '',
                subcategory: parts[1] || '',
                type: parts[2] || '',
                path: rel
            });

            processed++;
            if (codice) withCode++;
            if (processed % 50 === 0) process.stdout.write(`\r${processed} PDF processati...`);
        }
    }
}

console.log('Scansione PDF e estrazione codici dal cartiglio...');
walk(base);
drawings.sort((a, b) => a.code.localeCompare(b.code));
fs.writeFileSync(outPath, JSON.stringify(drawings));
console.log(`\nCompletato: ${drawings.length} disegni, ${withCode} con codice nel cartiglio`);
