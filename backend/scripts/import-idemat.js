/**
 * One-time import: reads Idemat_2026RevB1.xlsx and writes backend/data/idemat.json
 * Uses "Idemat2026 midpoints" sheet (SheetNames[2]) which has all 16 EF 3.1 Pt values.
 *
 * Run: node scripts/import-idemat.js
 */
import XLSX from 'xlsx';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { addGermanKeywords } from './translate-idemat.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = join(__dirname, '../../data/Idemat_2026RevB1.xlsx');
const OUT_PATH  = join(__dirname, '../data/idemat.json');

const EF31_COLS = {
  73: 'ef31_total',
  74: 'acidification',
  75: 'climate_change',
  76: 'ecotox_freshwater',
  77: 'particulate_matter',
  78: 'eutroph_marine',
  79: 'eutroph_freshwater',
  80: 'eutroph_terrestrial',
  81: 'human_tox_cancer',
  82: 'human_tox_noncancer',
  83: 'ionising_radiation',
  84: 'land_use',
  85: 'ozone_depletion',
  86: 'photochem_ozone',
  87: 'resource_fossils',
  88: 'resource_minerals',
  89: 'water_use',
};

if (!existsSync(XLSX_PATH)) {
  console.error(`XLSX not found: ${XLSX_PATH}`);
  process.exit(1);
}

const wb = XLSX.readFile(XLSX_PATH);
// "Idemat2026 midpoints" is the third sheet (index 2)
const sheetName = wb.SheetNames[2];
const ws = wb.Sheets[sheetName];
const range = XLSX.utils.decode_range(ws['!ref']);

console.log(`Reading sheet "${sheetName}" (${range.e.r + 1} rows, ${range.e.c + 1} cols)…`);

function cell(r, c) {
  const ref = XLSX.utils.encode_cell({ r, c });
  return ws[ref];
}

const entries = [];

for (let r = 3; r <= range.e.r; r++) {
  const c73 = cell(r, 73);
  const c5  = cell(r, 5);

  // Skip group header rows: they have no process name or no numeric EF 3.1 total
  if (!c5 || !c5.v || !c73 || typeof c73.v !== 'number') continue;

  const rawNr = cell(r, 0)?.v ?? '';
  // ID = first whitespace-delimited token of col 0
  const id = String(rawNr).split(/\s+/)[0] || `row_${r}`;

  const entry = {
    id,
    name:     String(c5.v).trim(),
    category: String(cell(r, 1)?.v ?? '').trim(),
    unit:     String(cell(r, 4)?.v ?? '').trim(),
  };

  for (const [col, key] of Object.entries(EF31_COLS)) {
    const cv = cell(r, Number(col));
    entry[key] = (cv && typeof cv.v === 'number') ? cv.v : null;
  }

  entries.push(entry);
}

const outDir = dirname(OUT_PATH);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

addGermanKeywords(entries);

writeFileSync(OUT_PATH, JSON.stringify(entries, null, 0));
const withDe = entries.filter(e => e.name_de).length;
console.log(`✅ Written ${entries.length} entries → ${OUT_PATH} (${withDe} with name_de)`);
