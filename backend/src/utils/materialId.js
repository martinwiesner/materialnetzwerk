import { getDB } from '../config/db.js';

const TYPE_CODES = {
  materials: 'MAT',
  projects:  'PRJ',
  actors:    'AKT',
  inventory: 'INV',
};

/**
 * Generate the next sequential RZZ ID for an entity type.
 * Format: RZZ-{TYPE}-YYYYMM-NNNN
 * Thread-safe within a single Node.js process because better-sqlite3 is synchronous.
 */
export function generateMaterialId(entityType) {
  const db = getDB();
  const typeCode = TYPE_CODES[entityType] || 'MAT';
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const key = `${typeCode}-${yyyymm}`;

  // UPSERT: insert 1 for new month/type, else increment
  db.prepare(
    `INSERT INTO id_counters (type_month, next_number) VALUES (?, 1)
     ON CONFLICT(type_month) DO UPDATE SET next_number = next_number + 1`
  ).run(key);

  const row = db.prepare('SELECT next_number FROM id_counters WHERE type_month = ?').get(key);
  const num = String(row.next_number).padStart(4, '0');
  return `RZZ-${typeCode}-${yyyymm}-${num}`;
}

// Default passport type per known category (CPR vs ESPR).
// Unknown categories fall back to 'construction' — the dominant use-case at RZZ.
const CATEGORY_TO_PASSPORT = {
  // CPR 2024/3110 — Baumaterialien
  'Baustoffe': 'construction',
  'Dämmstoffe': 'construction',
  'Bindemittel': 'construction',
  'Holz und Holzwerkstoffe': 'construction',
  'Holz': 'construction',
  'Natursteine': 'construction',
  'Naturstein': 'construction',
  'Ziegel und Keramik': 'construction',
  'Keramik': 'construction',
  'Beton und Zement': 'construction',
  'Mineralische Baustoffe': 'construction',
  'Metalle': 'construction',
  'Nachwachsende Rohstoffe': 'construction',
  'Recycling': 'construction',
  'Landwirtschaftliche Reststoffe': 'construction',
  'Verbundwerkstoffe': 'construction',
  // ESPR 2024/1781 — Produktmaterialien
  'Textilien': 'product',
  'Kunststoffe': 'product',
  'Farben und Lacke': 'product',
  'Möbel': 'product',
  'Experimentell': 'product',
  'Glas': 'product',
};

export function getPassportType(category) {
  if (!category) return 'construction';
  return CATEGORY_TO_PASSPORT[category] || 'construction';
}
