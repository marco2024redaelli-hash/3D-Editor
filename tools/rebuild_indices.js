/**
 * Rigenera distinte_index.json e drawings_index.json scansionando public/db
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const DB_DIR = path.join(BASE, 'public', 'db');
const DISTINTE_PATH = path.join(BASE, 'public', 'distinte_index.json');
const DRAWINGS_PATH = path.join(BASE, 'public', 'drawings_index.json');

const distinte = {};
const drawings = [];

function walk(dir, relBase) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = relBase + e.name;

    if (e.isDirectory()) {
      walk(full, rel + '/');
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      const nameNoExt = path.basename(e.name, path.extname(e.name));

      if (ext === '.xls' || ext === '.xlsx') {
        // chiave = nome file senza estensione, maiuscolo
        const key = nameNoExt.toUpperCase();
        distinte[key] = rel;
      } else if (ext === '.pdf') {
        const parts = rel.split('/');
        drawings.push({
          code: nameNoExt,
          codice: '',
          category: parts[0] || '',
          subcategory: parts[1] || '',
          type: parts[2] || '',
          path: rel
        });
      }
    }
  }
}

console.log('Scansione public/db...');
walk(DB_DIR, '');

// Ordina
const distinteOrdered = Object.fromEntries(
  Object.entries(distinte).sort(([a],[b]) => a.localeCompare(b))
);
drawings.sort((a, b) => a.code.localeCompare(b.code));

fs.writeFileSync(DISTINTE_PATH, JSON.stringify(distinteOrdered, null, 2), 'utf8');
fs.writeFileSync(DRAWINGS_PATH, JSON.stringify(drawings, null, 2), 'utf8');

console.log(`distinte_index.json: ${Object.keys(distinteOrdered).length} distinte`);
console.log(`drawings_index.json: ${drawings.length} disegni`);
