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
    const glbBase = name.replace(/-x$/, '').toUpperCase();

    // Cerca PDF e XLS: stessa cartella, sottocartelle e cartella padre
    function findFiles(searchDir, searchRel, ext) {
      const results = [];
      try {
        const items = fs.readdirSync(searchDir, { withFileTypes: true });
        items.filter(f => f.isFile() && f.name.toLowerCase().endsWith(ext)).forEach(f => {
          results.push(searchRel + f.name);
        });
        items.filter(f => f.isDirectory()).forEach(f => {
          results.push(...findFiles(path.join(searchDir, f.name), searchRel + f.name + '/', ext));
        });
      } catch {}
      return results;
    }

    // Cerca nella cartella corrente + sottocartelle
    let pdfs = findFiles(dir, relBase, '.pdf');
    let xlss = findFiles(dir, relBase, '.xls').filter(f => !f.toLowerCase().includes('dettagliata'));

    // Se non trovati, cerca nella cartella padre
    if (pdfs.length === 0 || xlss.length === 0) {
      const parentDir = path.dirname(dir);
      const parentRel = relBase.replace(/[^/]+\/$/, '');
      if (parentDir !== dir) {
        if (pdfs.length === 0) pdfs = findFiles(parentDir, parentRel, '.pdf');
        if (xlss.length === 0) xlss = findFiles(parentDir, parentRel, '.xls').filter(f => !f.toLowerCase().includes('dettagliata'));
      }
    }

    // Match migliore: preferisci file il cui nome contiene il codice del GLB
    const bestPdf = pdfs.find(f => f.toUpperCase().includes(glbBase.split('-').slice(0,4).join('-'))) || pdfs[0] || null;
    const bestXls = xlss.find(f => f.toUpperCase().includes(glbBase.split('-').slice(0,4).join('-'))) || xlss[0] || null;

    const old = oldByGlb[glb] || {};
    newCatalog.push({
      name: old.name || name,
      glb,
      folder,
      pdf: old.pdf || bestPdf,
      xls: old.xls || bestXls,
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
