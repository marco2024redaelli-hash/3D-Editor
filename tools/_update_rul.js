const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BASE = "public/db/PRD";
const DB1 = "C:/Users/Marco Redaelli/Desktop/DATABASE1/PRD";
const catalog = JSON.parse(fs.readFileSync("public/catalog.json", "utf8"));
const dbTree = JSON.parse(fs.readFileSync("public/db_tree.json", "utf8"));
const existingGlbs = new Set(catalog.map(e => e.glb));

function getFiles(dir, ext) {
  const results = [];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    fs.readdirSync(d).forEach(f => {
      const fp = path.join(d, f);
      if (fs.statSync(fp).isDirectory()) walk(fp);
      else if (f.toLowerCase().endsWith(ext)) results.push(fp.split("\\").join("/"));
    });
  }
  walk(dir);
  return results;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

let newCount = 0;
let copyCount = 0;

["RUL-01", "RUL-02"].forEach(rul => {
  const glbs = getFiles(path.join(BASE, rul), ".glb");
  const pdfs = getFiles(path.join(BASE, rul), ".pdf");
  const pdfMap = {};
  pdfs.forEach(p => {
    const rel = p.replace("public/db/", "");
    const base = path.basename(p, ".pdf").toUpperCase();
    pdfMap[base] = rel;
  });

  // Collect all GLB filenames for db_tree
  const glbNames = glbs.map(g => path.basename(g));

  // Update db_tree - find or create RUL entry
  const prdNode = dbTree.PRD || dbTree;
  if (!prdNode[rul]) prdNode[rul] = {};
  prdNode[rul]._files = glbNames;

  glbs.forEach(g => {
    const rel = g.replace("public/db/", "");
    if (existingGlbs.has(rel)) return;

    const bn = path.basename(g, ".glb");
    const bu = bn.toUpperCase();
    let pdf = pdfMap[bu] || null;
    if (!pdf) {
      const noSuffix = bu.replace(/-[A-Z0-9]+$/, "");
      for (const k of Object.keys(pdfMap)) {
        if (k.startsWith(noSuffix)) { pdf = pdfMap[k]; break; }
      }
    }
    const folder = path.dirname(rel).split("\\").join("/");
    catalog.push({ name: bn, glb: rel, folder: folder, pdf: pdf, xls: null, code: bu.replace(/-/g, "") });
    newCount++;
  });

  // Copy files to DATABASE1
  const srcDir = path.join(BASE, rul);
  const dstDir = path.join(DB1, rul);
  ensureDir(dstDir);

  [...glbs, ...pdfs].forEach(src => {
    const relToRul = src.replace(path.join(BASE, rul).split("\\").join("/") + "/", "");
    const dst = path.join(dstDir, relToRul);
    ensureDir(path.dirname(dst));
    try {
      fs.copyFileSync(src, dst);
      copyCount++;
    } catch(e) {
      console.log("COPY FAIL: " + src + " -> " + e.message);
    }
  });
});

// Save catalog
fs.writeFileSync("public/catalog.json", JSON.stringify(catalog, null, 2));
// Save db_tree
fs.writeFileSync("public/db_tree.json", JSON.stringify(dbTree, null, 2));

console.log("Catalog: " + newCount + " new entries added (total: " + catalog.length + ")");
console.log("DATABASE1: " + copyCount + " files copied");
console.log("db_tree.json updated");
