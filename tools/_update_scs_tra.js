const fs = require("fs");
const path = require("path");

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

function sortPriority(name) {
  const u = name.toUpperCase();
  if (u.includes("-A0")) return 0;
  if (u.includes("-AC")) return 1;
  if (u.includes("-SA")) return 2;
  if (u.includes("-S0")) return 3;
  if (u.includes("-C0")) return 4;
  if (u.includes("-P0")) return 5;
  return 6;
}

let newCount = 0;
let copyCount = 0;

["SCS", "TRA01"].forEach(fam => {
  const glbs = getFiles(path.join(BASE, fam), ".glb");
  const pdfs = getFiles(path.join(BASE, fam), ".pdf");
  const pdfMap = {};
  pdfs.forEach(p => {
    const rel = p.replace("public/db/", "");
    const base = path.basename(p, ".pdf").toUpperCase();
    pdfMap[base] = rel;
  });

  // Update db_tree
  const prdNode = dbTree.PRD || dbTree;
  if (!prdNode[fam]) prdNode[fam] = {};
  prdNode[fam]._files = glbs.map(g => path.basename(g));

  glbs.forEach(g => {
    const rel = g.replace("public/db/", "");
    if (existingGlbs.has(rel)) return;
    const bn = path.basename(g, ".glb");
    const bu = bn.toUpperCase();
    let pdf = pdfMap[bu] || null;
    if (!pdf) {
      // Try without variant suffix
      const noSuffix = bu.replace(/-[A-Z0-9]+$/, "");
      for (const k of Object.keys(pdfMap)) {
        if (k.startsWith(noSuffix)) { pdf = pdfMap[k]; break; }
      }
    }
    const folder = path.dirname(rel).split("\\").join("/");
    catalog.push({ name: bn, glb: rel, folder: folder, pdf: pdf, xls: null, code: bu.replace(/-/g, "") });
    newCount++;
  });

  // Copy to DATABASE1
  const srcDir = path.join(BASE, fam);
  const dstDir = path.join(DB1, fam);
  ensureDir(dstDir);
  [...glbs, ...pdfs].forEach(src => {
    const relToFam = src.replace(path.join(BASE, fam).split("\\").join("/") + "/", "");
    const dst = path.join(dstDir, relToFam);
    ensureDir(path.dirname(dst));
    try { fs.copyFileSync(src, dst); copyCount++; } catch(e) {}
  });
});

// Sort families
const familyMap = {};
catalog.forEach(e => {
  const fam = e.family || (e.folder ? e.folder.split("/")[1] : "?");
  if (!familyMap[fam]) familyMap[fam] = [];
  familyMap[fam].push(e);
});
["SCS", "TRA01"].forEach(fam => {
  if (familyMap[fam]) {
    familyMap[fam].sort((a, b) => {
      const pa = sortPriority(a.name);
      const pb = sortPriority(b.name);
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });
  }
});
// Rebuild catalog
const seen = new Set();
const result = [];
catalog.forEach(e => {
  const fam = e.family || (e.folder ? e.folder.split("/")[1] : "?");
  if (!seen.has(fam)) {
    seen.add(fam);
    result.push(...(familyMap[fam] || []));
  }
});

fs.writeFileSync("public/catalog.json", JSON.stringify(result, null, 2));
fs.writeFileSync("public/db_tree.json", JSON.stringify(dbTree, null, 2));

console.log("Catalog: " + newCount + " new entries (total: " + result.length + ")");
console.log("DATABASE1: " + copyCount + " files copied");
console.log("db_tree.json updated");
