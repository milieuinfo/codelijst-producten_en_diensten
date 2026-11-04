'use strict';
// Zet tabblad 'PDI OMG' van de PDC-excel om naar codelijst-source.csv (SKOS).
// Gebruik: node 00_xls_to_csv.js [bron.xlsx] [doel.csv]
import ExcelJS from 'exceljs';
import { writeFileSync } from 'node:fs';

const src = process.argv[2] ?? 'source/250804_PDC_DOMG.xlsx';
const out = process.argv[3] ?? 'source/codelijst-source.csv';

// Celwaarde zoals openpyxl met data_only=True: bij formules de berekende waarde.
function cellValue(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object' && !(v instanceof Date)) {
        if ('result' in v) return v.result;
        if ('richText' in v) return v.richText.map(t => t.text).join('');
        if ('text' in v) return v.text;
        if ('error' in v) return v.error;
    }
    return v;
}

function clean(v) {
    if (v === null || v === undefined) return '';
    const s = String(v).replaceAll(' ', ' ').replaceAll('|', '/');
    return s.replace(/\s+/g, ' ').trim();
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const AFD = ['BJO', 'PBM', 'VPO', 'GOP', 'HH', 'STAF', 'DWZ', 'DIGI'];
const cols = ['uri', 'type', 'topConceptOf', 'inScheme', 'prefLabel', 'notation', 'definition',
    'broader', 'note', 'collections'];
const rows = [];
const row = kw => rows.push(Object.fromEntries(cols.map(c => [c, kw[c] ?? ''])));
const blank = () => row({});

const CS = 'conceptscheme:producten_en_diensten';
row({
    uri: CS, type: 'skos:ConceptScheme',
    prefLabel: 'Producten- en dienstencatalogus Departement Omgeving',
    definition: 'Catalogus van de producten en diensten van het Departement Omgeving, '
        + 'functioneel opgebouwd in drie niveaus (dienst 1, dienst 2, dienst 3/product).',
});
blank();

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(src);
const ws = wb.getWorksheet('PDI OMG');
if (!ws) throw new Error(`Tabblad 'PDI OMG' niet gevonden in ${src}`);

const d1 = new Map(), d2 = new Map(), d3 = new Map(), colls = new Map();
for (let i = 2; i <= ws.rowCount; i++) {
    const xr = ws.getRow(i);
    const r = Array.from({ length: 22 }, (_, c) => clean(cellValue(xr.getCell(c + 1).value)));
    if (!r[4]) continue;
    const [k1, l1, k2, l2, k3, l3, prod] = r;
    if (!d1.has(k1)) d1.set(k1, l1);
    if (!d2.has(k2)) d2.set(k2, { label: l2, broader: k1 });
    if (!d3.has(k3)) d3.set(k3, { label: l3, broader: k2, products: [], colls: [] });
    const e = d3.get(k3);
    if (prod && !e.products.includes(prod)) e.products.push(prod);

    const memb = [];
    const td = capitalize(r[19]);
    memb.push(['type_dienst_' + slug(td), 'Type dienst: ' + td]);
    const m = r[20].match(/^([a-z])\. (.*)/);
    if (!m) throw new Error(`Rij ${i}: onverwachte fase beleidscyclus '${r[20]}'`);
    memb.push(['fase_beleidscyclus_' + m[1], 'Fase beleidscyclus: ' + m[2]]);
    AFD.forEach((a, j) => {
        if (r[10 + j] && r[10 + j] !== '0') memb.push(['afdeling_' + a.toLowerCase(), 'Afdeling ' + a]);
    });
    for (const [k, lab] of memb) {
        colls.set(k, lab);
        if (!e.colls.includes(k)) e.colls.push(k);
    }
}

for (const [k, l] of d1) {
    row({ uri: 'pd:' + k, type: 'skos:Concept', topConceptOf: CS, inScheme: CS, prefLabel: l, notation: k });
}
blank();
for (const [k, { label, broader }] of d2) {
    row({ uri: 'pd:' + k, type: 'skos:Concept', inScheme: CS, prefLabel: label, notation: k, broader: 'pd:' + broader });
}
blank();
for (const [k, e] of d3) {
    row({
        uri: 'pd:' + k, type: 'skos:Concept', inScheme: CS, prefLabel: e.label, notation: k,
        broader: 'pd:' + e.broader,
        note: e.products.map(p => 'Product: ' + p).join('|'),
        collections: e.colls.map(c => 'collectie:' + c).join('|'),
    });
}
blank();
for (const k of [...colls.keys()].sort()) {
    row({ uri: 'collectie:' + k, type: 'skos:Collection', inScheme: CS, prefLabel: colls.get(k) });
}

// CSV met minimale quoting, zoals Python's csv-module.
const field = s => /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
const lines = [cols.join(','), ...rows.map(r => cols.map(c => field(r[c])).join(','))];
writeFileSync(out, lines.join('\n') + '\n', 'utf-8');
console.log(`D1=${d1.size} D2=${d2.size} D3=${d3.size} collecties=${colls.size}`);
