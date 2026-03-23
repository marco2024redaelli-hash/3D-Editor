/**
 * Rigenera db_tree.json scansionando public/db
 * e aggiorna catalog.json con i nuovi GLB.
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const DB_DIR = path.join(BASE, 'public', 'db');
const TREE_PATH = path.join(BASE, 'public', 'db_tree.json');
const CATALOG_PATH = path.join(BASE, 'public', 'catalog.json');

// Carica catalog esistente per preservare metadati
const oldCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const oldByGlb = {};
oldCatalog.forEach(e => { if (e.glb) oldByGlb[e.glb] = e; });

// Costruisce albero ricorsivamente
function buildTree(dir, relBase) {
  const node = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  const files = entries.filter(e => e.isFile() && e.name.toLowerCase().endsWith('.glb')).map(e => e.name);
  if (files.length > 0) {
    node._files = files.sort();
  }

  entries.filter(e => e.isDirectory()).sort((a,b) => a.name.localeCompare(b.name)).forEach(e => {
    const sub = buildTree(path.join(dir, e.name), relBase + e.name + '/');
    node[e.name] = sub;
  });

  return node;
}

console.log('Scansione public/db...');
const tree = buildTree(DB_DIR, '');
fs.writeFileSync(TREE_PATH, JSON.stringify(tree, null, 2), 'utf8');
console.log('db_tree.json aggiornato.');

// Aggiorna catalog.json: aggiungi nuovi GLB, preserva metadati esistenti
const newCatalog = [];

function scanGlbs(dir, relBase) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.filter(e => e.isFile() && e.name.toLowerCase().endsWith('.glb')).forEach(e => {
    const glb = relBase + e.name;
    const name = path.basename(e.name, '.glb');
    const folder = relBase.replace(/\/$/, '');

    // Cerca PDF nella stessa cartella
    let pdf = null;
    const pdfs = entries.filter(f => f.isFile() && f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length > 0) pdf = relBase + pdfs[0].name;

    const old = oldByGlb[glb] || {};
    newCatalog.push({
      name: old.name || name,
      glb,
      folder,
      pdf: old.pdf || pdf,
      xls: old.xls || null,
      code: old.code || null
    });
  });

  entries.filter(e => e.isDirectory()).forEach(e => {
    scanGlbs(path.join(dir, e.name), relBase + e.name + '/');
  });
}

scanGlbs(DB_DIR, '');
fs.writeFileSync(CATALOG_PATH, JSON.stringify(newCatalog, null, 2), 'utf8');
console.log(`catalog.json aggiornato: ${newCatalog.length} modelli (era ${oldCatalog.length}).`);
