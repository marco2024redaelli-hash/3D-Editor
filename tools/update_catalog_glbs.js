const fs = require('fs');
const path = require('path');

const catalogPath = 'public/models/catalog.json';
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const existingFiles = new Set(catalog.map(i => i.file.toLowerCase()));

// Load drawings index for codice lookup
const drawings = JSON.parse(fs.readFileSync('public/drawings_index.json', 'utf8'));

const folders = ['prodotti', 'componenti'];
let added = 0;

folders.forEach(folder => {
    const dir = path.join('public/models', folder);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.glb'));

    files.forEach(f => {
        const filePath = folder + '/' + f;
        if (existingFiles.has(filePath)) return;

        const name = f.replace('.glb', '').toUpperCase();

        // Find code from drawings index
        let codice = '';
        const drawing = drawings.find(d => {
            const dcode = d.code.toUpperCase().replace(/-[A-Z]$/, '-X');
            return dcode === name;
        });
        if (drawing && drawing.codice) codice = drawing.codice;

        catalog.push({
            name: name,
            file: filePath,
            code: codice
        });
        added++;
        console.log('Added: ' + name + (codice ? ' [' + codice + ']' : ''));
    });
});

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log('\nTotal added: ' + added + ', catalog now has ' + catalog.length + ' items');
