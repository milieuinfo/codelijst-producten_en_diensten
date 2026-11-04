
'use strict';
// Zet tabblad 'PDI OMG' van de PDC-excel om naar codelijst-source.csv (SKOS).
// Schrijft daarnaast de diensten en outputs volgens CPSV-AP naar cpsv-source.csv.
// Gebruik: node 00_xls_to_csv.js [bron.xlsx] [skos.csv] [cpsv.csv] [organisaties.csv]
import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2] ?? 'source/250804_PDC_DOMG.xlsx';
const out = process.argv[3] ?? 'source/codelijst-source.csv';
const outCpsv = process.argv[4] ?? 'source/cpsv-source.csv';
const orgCsv = process.argv[5] ?? 'source/organisaties.csv';

// Celwaarde zoals openpyxl met data_only=True: bij formules de berekende waarde.
function cellValue(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object' && !(v instanceof Date)) {
        if ('result' in v) return v.result;
        // Doorstreepte tekst geldt als geschrapt.
        if ('richText' in v) return v.richText.map(t => t.font?.strike ? ' ' : t.text).join('');
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

// Kolom W 'key product': vaste sleutel P-nnnn per product. Ze bepaalt de IRI output:P-nnnn en wordt
// nooit hergebruikt; een nieuw product krijgt het volgende vrije nummer.
const KEY_PRODUCT = 22;
const productKey = new Map(); // P-nnnn -> "D3-nnnn|product"
const d1 = new Map(), d2 = new Map(), d3 = new Map(), colls = new Map();
for (let i = 2; i <= ws.rowCount; i++) {
    const xr = ws.getRow(i);
    const r = Array.from({ length: 23 }, (_, c) => clean(cellValue(xr.getCell(c + 1).value)));
    if (!r[4]) continue;
    const [k1, l1, k2, l2, k3, l3, prod] = r;
    if (!d1.has(k1)) d1.set(k1, l1);
    if (!d2.has(k2)) d2.set(k2, { label: l2, broader: k1 });
    if (!d3.has(k3)) d3.set(k3, { label: l3, broader: k2, products: [], productKeys: {}, colls: [], afd: [] });
    const e = d3.get(k3);
    if (prod) {
        const pk = r[KEY_PRODUCT];
        if (!/^P-[0-9]{4}$/.test(pk)) throw new Error(`Rij ${i}: ontbrekende of ongeldige 'key product' '${pk}' (verwacht P-nnnn)`);
        const id = `${k3}|${prod}`;
        if (productKey.has(pk) && productKey.get(pk) !== id) throw new Error(`Rij ${i}: 'key product' ${pk} is al gebruikt voor ${productKey.get(pk)}`);
        if (e.productKeys[prod] && e.productKeys[prod] !== pk) throw new Error(`Rij ${i}: product '${prod}' van ${k3} heeft twee sleutels (${e.productKeys[prod]}, ${pk})`);
        productKey.set(pk, id);
        e.productKeys[prod] = pk;
    }
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
    const gericht = r[18].replaceAll(' ', '');
    if (gericht) {
        if (!['E', 'I', 'E/I'].includes(gericht)) throw new Error(`Rij ${i}: onverwacht intern/extern '${r[18]}'`);
        if (gericht.includes('E')) memb.push(['gericht_extern', 'Gericht: extern']);
        if (gericht.includes('I')) memb.push(['gericht_intern', 'Gericht: intern']);
    }
    const trigger = r[21].toLowerCase();
    if (trigger) {
        const t = trigger.match(/^(intern|extern)e trigger/);
        if (!t) throw new Error(`Rij ${i}: onverwachte trigger '${r[21]}'`);
        memb.push(['trigger_' + t[1], 'Trigger: ' + t[1]]);
    }
    AFD.forEach((a, j) => {
        if (r[10 + j] && r[10 + j] !== '0' && !e.afd.includes(a)) e.afd.push(a);
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

// CPSV-AP: elke dienst van niveau 3 is een cpsv:PublicService, elk product een cv:Output.
// Een betrokken afdeling is een cv:Participation met rol 'betrokken afdeling' en de afdeling als deelnemer.
// Afkortingen van afdelingen worden via organisaties.csv (altLabel) naar OVO-URI's vertaald.

// Eenvoudige CSV-parser (RFC 4180: velden tussen dubbele aanhalingstekens, "" als escape).
function parseCsv(text) {
    const records = [];
    let rec = [], fld = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { fld += '"'; i++; }
            else if (ch === '"') quoted = false;
            else fld += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { rec.push(fld); fld = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            rec.push(fld); records.push(rec); rec = []; fld = '';
        } else fld += ch;
    }
    if (fld || rec.length) { rec.push(fld); records.push(rec); }
    const [header, ...data] = records.filter(r => r.some(Boolean));
    return data.map(r => Object.fromEntries(header.map((h, j) => [h, r[j] ?? ''])));
}

const orgs = parseCsv(readFileSync(orgCsv, 'utf-8'));
const org = Object.fromEntries(orgs.map(o => [o.altLabel, o]));
for (const a of [...AFD, 'DOMG']) if (!org[a]) throw new Error(`Afdeling ${a} ontbreekt in ${orgCsv}`);
const BEVOEGD = org['DOMG'].uri;
const ROL = 'participatierol:betrokken_afdeling';
const ROLSCHEMA = 'conceptscheme:participatierol';

const cpsvCols = ['uri', 'type', 'dct_identifier', 'title', 'description', 'prefLabel', 'definition',
    'inScheme', 'topConceptOf', 'hasTopConcept', 'isClassifiedBy', 'hasCompetentAuthority', 'hasParticipation',
    'role', 'hasParticipant', 'produces'];
const cpsvRows = [];
const cpsvRow = kw => cpsvRows.push(cpsvCols.map(c => field(kw[c] ?? '')).join(','));
const cpsvBlank = () => cpsvRows.push(cpsvCols.map(() => '').join(','));
const outputs = [], participaties = [];
for (const [k, e] of d3) {
    const outIds = e.products.map(p => {
        const id = e.productKeys[p];
        outputs.push({ id, title: p });
        return 'output:' + id;
    });
    const partIds = e.afd.map(a => {
        const id = `${k}-${a}`;
        participaties.push({ id, org: org[a], dienst: e.label });
        return 'participatie:' + id;
    });
    cpsvRow({
        uri: 'publicservice:' + k, type: 'cpsv:PublicService', dct_identifier: k, title: e.label,
        // Plaatshouder: de bron bevat geen beschrijvingen, CPSV-AP vraagt er een.
        description: 'TODO',
        isClassifiedBy: 'pd:' + k, hasCompetentAuthority: BEVOEGD,
        hasParticipation: partIds.join('|'), produces: outIds.join('|'),
    });
}
cpsvBlank();
for (const o of outputs) cpsvRow({ uri: 'output:' + o.id, type: 'cv:Output', dct_identifier: o.id, title: o.title });
cpsvBlank();
for (const p of participaties) {
    cpsvRow({
        uri: 'participatie:' + p.id, type: 'cv:Participation', dct_identifier: p.id,
        description: `${p.org.prefLabel} (${p.org.altLabel}) is betrokken bij de dienst '${p.dienst}'.`,
        role: ROL, hasParticipant: p.org.uri,
    });
}
cpsvBlank();
// De rol van een participatie, als kleine eigen codelijst.
cpsvRow({
    uri: ROLSCHEMA, type: 'skos:ConceptScheme', prefLabel: 'Participatierollen producten en diensten', hasTopConcept: ROL,
    definition: 'De rollen die een organisatie kan hebben in een dienst uit de producten- en dienstencatalogus van het Departement Omgeving.',
});
cpsvRow({
    uri: ROL, type: 'skos:Concept', prefLabel: 'betrokken afdeling', inScheme: ROLSCHEMA, topConceptOf: ROLSCHEMA,
    definition: 'Een afdeling van het Departement Omgeving die volgens de producten- en dienstencatalogus betrokken is bij de dienst.',
});
cpsvBlank();
// Getypeerde verwijzing naar het gebied, zodat de range dct:Location van CPSV-AP geldt.
for (const sp of new Set(orgs.map(o => o.spatial))) cpsvRow({ uri: sp, type: 'dct:Location' });
writeFileSync(outCpsv, [cpsvCols.join(','), ...cpsvRows].join('\n') + '\n', 'utf-8');
console.log(`diensten=${d3.size} outputs=${outputs.length} participaties=${participaties.length}`);
