import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(__dirname, '../../data/idemat.json');

let _data = null;

function load() {
  if (_data) return _data;
  if (!existsSync(JSON_PATH)) {
    console.warn('[idemat] idemat.json not found – run: node scripts/import-idemat.js');
    _data = [];
    return _data;
  }
  _data = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
  console.log(`[idemat] Loaded ${_data.length} entries`);
  return _data;
}

// Normalize to lowercase, replace non-letter/digit with spaces → word-boundary matching
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9äöüßàáâãåæçèéêëìíîïñòóôõøùúûý]+/g, ' ');

export function searchIdemat(query, limit = 20) {
  const data = load();
  if (!query || query.trim().length < 2) return [];

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const scored = data
    .map((e) => {
      const nameFull = ` ${norm(e.name + ' ' + (e.name_de || ''))} `;
      const catFull  = ` ${norm(e.category + ' ' + (e.category_de || ''))} `;
      // name/name_de hits count double over category hits; word-boundary match via spaces
      const score = tokens.reduce((acc, t) => {
        const tn = ` ${norm(t)} `;
        if (nameFull.includes(tn)) return acc + 2;
        if (catFull.includes(tn))  return acc + 1;
        return acc;
      }, 0);
      return { entry: e, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.length - b.entry.name.length);

  return scored.slice(0, limit).map((s) => s.entry);
}

export function getIdematById(id) {
  const data = load();
  return data.find((e) => e.id === id) ?? null;
}
