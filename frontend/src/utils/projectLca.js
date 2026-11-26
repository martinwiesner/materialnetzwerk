// Project LCA ("Gesamtbilanz") — single source of truth.
// Used by ProjectDetail (Gesamtbilanz, Materialtabelle) and ComparePage so the
// project sums shown in both places are identical.
//
// Every project material — library materials (RZZ) and ÖKOBAUDAT EPDs — is turned
// into a unified entry: indicators per declared unit + quantity in declared units.
// Materials without quantity, without indicator values or with a unit that cannot
// be converted to the declared unit are skipped and reported in `skipped`.

export const EPD_INDICATOR_ORDER = [
  'GWP-total','GWP-fossil','GWP-biogenic','GWP-luluc',
  'ODP','AP','EP-terrestrial','EP-freshwater','EP-marine','POCP',
  'ADP-elements','ADP-fossil','ADP','WDP',
  'HWD','NHWD','RWD','PERE','PENRE','PERM',
];

export const A1A3_KEYS = ['A1-A3', 'A1', 'A2', 'A3'];
export const EOL_KEYS  = ['C3', 'C4'];

// sumAll=false: first direct-key hit wins (composite keys like 'A1-A3')
// sumAll=true:  sum all found keys (independent modules like C3 + C4)
export function sumMods(mods, keys, sumAll = false) {
  if (!sumAll) {
    for (const k of keys) if (k in mods && mods[k] != null) return mods[k];
  }
  let s = 0, found = false;
  for (const k of keys) {
    if (k in mods && mods[k] != null) { s += mods[k]; found = true; }
  }
  return found ? s : null;
}

// ── Units ────────────────────────────────────────────────────────────────────

const UNIT_ALIASES = {
  t:    ['t', 'metric ton', 'metric tons', 'tonne', 'tonnes', 'tonnen', 'metrische tonne'],
  kg:   ['kg', 'kilogramm', 'kilogram', 'kilograms'],
  g:    ['g', 'gramm', 'gram', 'grams'],
  'm³': ['m³', 'm3', 'cubic meter', 'cubic metre', 'kubikmeter'],
  l:    ['l', 'liter', 'litre'],
  'm²': ['m²', 'm2', 'square meter', 'square metre', 'quadratmeter'],
  m:    ['m', 'meter', 'metre', 'lfm'],
  stk:  ['stk', 'stück', 'piece', 'pieces', 'pce', 'pcs'],
};
// "unit" = one declared unit of the material itself
const GENERIC_UNITS = ['', 'unit', 'units', 'einheit', 'einheiten', 'de'];

const MASS_KG   = { kg: 1, t: 1000, g: 0.001 };
const VOLUME_M3 = { 'm³': 1, l: 0.001 };

function parseNum(s) {
  if (s == null || s === '') return null;
  let str = String(s).trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) str = str.replace(/\./g, ''); // 2.000 / 2.000,5
  const n = parseFloat(str.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// "1 t" → { amount: 1, unit: 't' } · "m3" → { amount: 1, unit: 'm³' }
export function parseUnit(u) {
  const m = String(u ?? '').trim().match(/^([\d.,]+)?\s*(.*)$/);
  const amount = parseNum(m?.[1]) || 1;
  const raw = (m?.[2] || '').trim().toLowerCase().replace(/\.$/, '');
  if (GENERIC_UNITS.includes(raw)) return { amount, unit: '' };
  for (const [norm, aliases] of Object.entries(UNIT_ALIASES)) {
    if (aliases.includes(raw)) return { amount, unit: norm };
  }
  return { amount, unit: raw };
}

// Free-text density ("1600", "2.000 kg/m³", "1,2 g/cm³") → kg/m³, or null
export function parseDensity(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v > 0 ? v : null;
  const m = String(v).trim().match(/^([\d.,]+)\s*(.*)$/);
  if (!m) return null;
  const n = parseNum(m[1]);
  if (n == null || n <= 0) return null;
  const unit = m[2].toLowerCase().replace(/\s/g, '').replace('3', '³');
  if (unit === '' ) return n >= 10 ? n : null; // unitless values < 10 are not plausible as kg/m³
  if (unit === 'kg/m³') return n;
  if (unit === 'g/cm³' || unit === 't/m³' || unit === 'kg/l' || unit === 'kg/dm³') return n * 1000;
  return null;
}

// Mass of one unit in kg, using conversion data where needed:
// conv = { density (kg/m³), areal (kg/m²), piece (kg/Stk) }
function unitKg(unit, conv) {
  if (MASS_KG[unit]) return MASS_KG[unit];
  if (VOLUME_M3[unit]) return conv.density ? VOLUME_M3[unit] * conv.density : null;
  if (unit === 'm²') return conv.areal || null;
  if (unit === 'stk') return conv.piece || null;
  return null;
}

const CONV_NEEDED = { 'm³': 'density', l: 'density', 'm²': 'areal', stk: 'piece' };
export const CONV_LABELS = {
  density: 'Dichte fehlt',
  areal:   'Flächengewicht fehlt',
  piece:   'Stückgewicht fehlt',
  unit:    'Einheit nicht umrechenbar',
};

function toConv(conv) {
  if (conv == null) return {};
  return typeof conv === 'number' ? { density: conv } : conv;
}

/**
 * Factor to convert a quantity given in `fromUnit` into multiples of `declaredUnit`.
 * Different dimensions (mass, volume, area, pieces) are bridged via mass using
 * `conv` (density number or { density, areal, piece }).
 * Returns null if no conversion is possible — see conversionGap() for the reason.
 */
export function quantityFactor(fromUnit, declaredUnit, conv = null) {
  const f = parseUnit(fromUnit), d = parseUnit(declaredUnit);
  // generic unit on either side → quantity already refers to the declared unit
  if (!f.unit || !d.unit) return 1;
  const c = toConv(conv);
  let base = null; // one fromUnit expressed in declared units
  if (f.unit === d.unit) base = 1;
  else if (VOLUME_M3[f.unit] && VOLUME_M3[d.unit]) base = VOLUME_M3[f.unit] / VOLUME_M3[d.unit];
  else {
    const fk = unitKg(f.unit, c), dk = unitKg(d.unit, c);
    if (fk != null && dk != null) base = fk / dk;
  }
  if (base == null) return null;
  return (f.amount * base) / d.amount;
}

// Why quantityFactor() returned null: 'density' | 'areal' | 'piece' | 'unit'
export function conversionGap(fromUnit, declaredUnit, conv = null) {
  const f = parseUnit(fromUnit).unit, d = parseUnit(declaredUnit).unit;
  const c = toConv(conv);
  const known = (u) => MASS_KG[u] || CONV_NEEDED[u];
  if (!known(f) || !known(d)) return 'unit';
  for (const u of [f, d]) {
    const need = CONV_NEEDED[u];
    if (need && !c[need] && !(VOLUME_M3[f] && VOLUME_M3[d])) return need;
  }
  return 'unit';
}

// Reference unit of a library material's indicator values.
// declared_unit wins: gwp_unit defaults to "kg CO2e/kg" in the material form,
// so its denominator is only a fallback.
export function libDeclaredUnit(m) {
  const den = m.gwp_unit?.split('/')?.[1]?.trim() || '';
  return m.declared_unit || den || 'kg';
}

// ── Entries ──────────────────────────────────────────────────────────────────

const LIB_FIELDS = [
  ['GWP-fossil',     'gwp_fossil',        'kg CO₂e'],
  ['GWP-biogenic',   'gwp_biogenic',      'kg CO₂e'],
  ['GWP-luluc',      'gwp_luluc',         'kg CO₂e'],
  ['ADP-fossil',     'adp_fossil',        'MJ'],
  ['ADP-elements',   'adp_elements',      'kg Sb eq.'],
  ['WDP',            'water_consumption', 'm³'],
  ['ODP',            'odp',               'kg CFC-11 eq.'],
  ['AP',             'ap',                'mol H⁺ eq.'],
  ['EP-terrestrial', 'ep_terrestrial',    'mol N eq.'],
  ['EP-freshwater',  'ep_freshwater',     'kg P eq.'],
  ['EP-marine',      'ep_marine',         'kg N eq.'],
  ['POCP',           'pocp',              'kg NMVOC eq.'],
  ['HWD',            'hwd',               'kg'],
  ['NHWD',           'nhwd',              'kg'],
  ['RWD',            'rwd',               'kg'],
  ['PERE',           'pere',              'MJ'],
  ['PENRE',          'penre',             'MJ'],
  ['PERM',           'perm',              'MJ'],
];

// Library material (project_materials row joined with materials) → unified entry
export function libMatToEpdEntry(m) {
  const indicators = {};
  const gwp = m.effective_gwp_value != null ? Number(m.effective_gwp_value) : null;
  if (m.has_gwp_data && gwp != null) indicators['GWP-total'] = { mods: { 'A1-A3': gwp }, unit: 'kg CO₂e' };
  for (const [key, field, unit] of LIB_FIELDS) {
    if (m[field] != null && m[field] !== '') indicators[key] = { mods: { 'A1-A3': Number(m[field]) }, unit };
  }
  const declaredUnit = libDeclaredUnit(m);
  return {
    uuid:         `lib-${m.material_id || m.id}`,
    name:         m.material_name || m.name || 'Material',
    category:     m.category || '',
    declaredUnit,
    quantity:     m.quantity,
    unit:         m.unit || declaredUnit,
    density:      parseDensity(m.tech_density),
    gwpA1A3:      gwp || null,
    gwpEoL:       null,
    gwpD:         null,
    indicators,
    isLibraryMaterial: true,
  };
}

// Library material as returned by /materials/:id → project_materials-like row,
// so it can run through libMatToEpdEntry (ad-hoc variants, material comparison).
export function libraryMaterialRow(m, quantity = 1, unit = null) {
  const parts = [m.gwp_fossil, m.gwp_biogenic, m.gwp_luluc].filter(v => v != null && v !== '');
  const hasGwp = (m.gwp_value != null && m.gwp_value !== '') || parts.length > 0;
  return {
    ...m,
    material_id:         m.id,
    material_name:       m.name,
    quantity,
    unit:                unit || libDeclaredUnit(m),
    has_gwp_data:        hasGwp ? 1 : 0,
    effective_gwp_value: !hasGwp ? null
      : (m.gwp_value != null && m.gwp_value !== '') ? Number(m.gwp_value)
      : parts.reduce((s, v) => s + Number(v), 0),
  };
}

// "DIN EN 15804+A2" → 'EN 15804+A2'; null if no 15804 reference is recognisable
export function normLabel(text) {
  const s = String(text || '');
  if (!/15804/.test(s)) return null;
  if (/A2/i.test(s)) return 'EN 15804+A2';
  if (/A1/i.test(s)) return 'EN 15804+A1';
  return 'EN 15804';
}

// Placeholder zeros (e.g. GWP 0.0 without any other value) do not count as data
function hasIndicatorData(entry) {
  return Object.values(entry.indicators || {}).some(ind =>
    Object.values(ind.mods || {}).some(v => v != null && Number(v) !== 0));
}

export const SKIP_REASONS = {
  quantity: 'keine Menge',
  data:     'kein Umweltkennwert',
  unit:     'Einheit nicht umrechenbar',
};

/**
 * Normalise an entry: quantity is converted to multiples of the declared unit.
 * Returns { entry } or { reason } (key of SKIP_REASONS).
 */
export function normalizeEntry(raw) {
  const qty = raw.quantity === '' || raw.quantity == null ? null : Number(String(raw.quantity).replace(',', '.'));
  if (!hasIndicatorData(raw)) return { reason: 'data' };
  if (qty == null || !Number.isFinite(qty) || qty === 0) return { reason: 'quantity' };
  const unit = raw.unit || raw.declaredUnit || '';
  const factor = quantityFactor(unit, raw.declaredUnit || unit, raw.density);
  if (factor == null) return { reason: 'unit' };
  return {
    entry: {
      ...raw,
      enteredQuantity: qty,
      enteredUnit:     unit,
      quantity:        qty * factor,
      unit:            raw.declaredUnit || unit,
    },
  };
}

// Totals per indicator and module; entries must be normalised
export function computeTotals(entries) {
  const totals = {};
  for (const e of entries) {
    const qty = Number(e.quantity) || 0;
    const uf  = Number(e.uncertainty_factor) || 1;
    for (const [key, ind] of Object.entries(e.indicators || {})) {
      if (!totals[key]) totals[key] = { unit: ind.unit, mods: {} };
      for (const [mod, v] of Object.entries(ind.mods || {})) {
        if (v != null) totals[key].mods[mod] = (totals[key].mods[mod] || 0) + qty * uf * Number(v);
      }
    }
  }
  return totals;
}

// Module breakdown of one indicator. Gesamt = A1–A3 + B6 + C3 + C4; D is reported separately.
export function indicatorModules(totals, key) {
  const t = totals?.[key];
  if (!t) return null;
  const mods = t.mods;
  const a1a3 = sumMods(mods, A1A3_KEYS);
  const b6   = mods['B6'] ?? null;
  const eol  = sumMods(mods, EOL_KEYS, true);
  const d    = mods['D'] ?? null;
  const parts = [a1a3, b6, eol].filter(v => v != null);
  return { unit: t.unit, a1a3, b6, eol, d, total: parts.length ? parts.reduce((s, v) => s + v, 0) : null };
}

// Contribution of one normalised entry to an indicator (A1–A3)
export function entryA1A3(entry, key = 'GWP-total') {
  const v = sumMods(entry.indicators?.[key]?.mods || {}, A1A3_KEYS);
  return v != null ? v * (Number(entry.quantity) || 0) * (Number(entry.uncertainty_factor) || 1) : null;
}

function safeJsonParse(v, fallback) {
  if (Array.isArray(v)) return v;
  try { return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

/**
 * Full project balance over ALL project materials (library + ÖKOBAUDAT).
 * @returns {{
 *   entries: object[],             // normalised, included entries (library first)
 *   totals: object,                // { [indicator]: { unit, mods } }
 *   indicatorKeys: string[],
 *   skipped: { name, reason, isLibraryMaterial }[],
 *   materialCount: number, libCount: number, epdCount: number,
 * }}
 */
export function buildProjectLca(project) {
  const libRaw = (project?.materials || []).map(libMatToEpdEntry);
  const epdRaw = safeJsonParse(project?.oekodat_materials, []);
  const entries = [], skipped = [];
  for (const raw of [...libRaw, ...epdRaw]) {
    const { entry, reason } = normalizeEntry(raw);
    if (entry) entries.push(entry);
    else skipped.push({ name: raw.name || 'Material', reason, isLibraryMaterial: !!raw.isLibraryMaterial });
  }
  const totals = computeTotals(entries);
  const indicatorKeys = Object.keys(totals).sort((a, b) => {
    const ia = EPD_INDICATOR_ORDER.indexOf(a), ib = EPD_INDICATOR_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  return {
    entries,
    totals,
    indicatorKeys,
    skipped,
    materialCount: libRaw.length + epdRaw.length,
    libCount: libRaw.length,
    epdCount: epdRaw.length,
  };
}

/**
 * GWP-total A1–A3 of a project for cards and badges — taken from the same
 * balance as „Umweltwirkung – Gesamtbilanz“ (library materials + ÖKOBAUDAT).
 * IDEMAT processes are reported separately there and are not included.
 */
export function projectGwpSummary(project) {
  const lca = buildProjectLca(project);
  if (!lca.materialCount) return null;
  const counted = lca.entries.filter(e => entryA1A3(e) != null).length;
  return {
    a1a3: indicatorModules(lca.totals, 'GWP-total')?.a1a3 ?? null,
    counted,
    count: lca.materialCount,
    complete: counted === lca.materialCount,
  };
}

export function formatGwp(v) {
  return v.toLocaleString('de-DE', { maximumFractionDigits: Math.abs(v) >= 10 ? 1 : 2 });
}

/** e.g. „−40,2 kg CO₂e (A1–A3)“ plus „· 2 von 3“ when materials lack values; null without any value */
export function formatProjectGwp(summary) {
  if (summary?.a1a3 == null) return null;
  const base = `${formatGwp(summary.a1a3)} kg CO₂e (A1–A3)`;
  return summary.complete ? base : `${base} · ${summary.counted} von ${summary.count}`;
}

export function projectGwpTooltip(summary) {
  if (!summary) return '';
  return `Treibhauspotenzial A1–A3 aller Projektmaterialien (Bibliothek + ÖKOBAUDAT), Kennwert × Menge – wie in „Umweltwirkung – Gesamtbilanz“.`
    + (summary.complete ? '' : `\nNur ${summary.counted} von ${summary.count} Materialien haben einen GWP-Kennwert – Summe unvollständig.`);
}

/**
 * ÖKOBAUDAT dataset (OekobaudatPicker entry) → material EPD form fields, so a
 * dataset can serve as the base of a library material. Library materials hold
 * A1–A3 per declared unit only (see LIB_FIELDS / libMatToEpdEntry), so modules
 * C and D are not carried over. Values are strings for controlled inputs.
 */
export function epdToMaterialFields(epd) {
  const fields = {};
  const a1a3 = (key) => sumMods(epd.indicators?.[key]?.mods || {}, A1A3_KEYS);
  // Indicators missing in the dataset are cleared so no stale values remain
  const gwp = a1a3('GWP-total');
  fields.gwp_value = gwp != null ? String(gwp) : '';
  for (const [key, field] of LIB_FIELDS) {
    const v = a1a3(key);
    fields[field] = v != null ? String(v) : '';
  }
  const { amount, unit } = parseUnit(epd.declaredUnit);
  if (epd.declaredUnit) fields.declared_unit = /^\s*[\d.,]/.test(epd.declaredUnit) ? epd.declaredUnit : `${amount} ${epd.declaredUnit}`;
  // Only a per-1-unit dataset maps onto the GWP unit select; declared_unit stays authoritative
  const gwpUnit = { kg: 'kg', 'm²': 'm2', 'm³': 'm3', stk: 'unit', '': 'unit' }[unit];
  if (gwpUnit && amount === 1) fields.gwp_unit = `kg CO2e/${gwpUnit}`;
  if (epd.density) fields.tech_density = String(epd.density);
  fields.lifecycle_scope = 'A1-A3';
  fields.gwp_source = `ÖKOBAUDAT ${epd.datasetLabel || ''}: ${epd.name} (UUID ${epd.uuid}${epd.version ? `, Version ${epd.version}` : ''})`.replace(/\s+:/, ':');
  if (epd.uuid) {
    fields.source_url = `https://oekobaudat.de/OEKOBAU.DAT/datasetdetail/process.xhtml?uuid=${epd.uuid}${epd.version ? `&version=${epd.version}` : ''}`;
  }
  return fields;
}

// ── Further project entries stored alongside the ÖKOBAUDAT datasets ─────────
// oekodat_materials holds every non-library entry; `source` tells them apart
// (missing = ÖKOBAUDAT, for entries saved before sources existed).
export const ENTRY_SOURCE_LABELS = { oekobaudat: 'ÖKOBAUDAT', 'epd-pdf': 'EPD (PDF)', freetext: 'Freitext' };
export const entrySource = (e) => e?.source || 'oekobaudat';

const newId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;

/**
 * EPD imported from a PDF/JSON/XML (fields as returned by the EPD import of the
 * material form) → project entry. Like a library material it carries A1–A3
 * values per declared unit only.
 */
export function epdPdfEntry(fields, fileName = '') {
  const row = libraryMaterialRow({ id: 'pdf', name: fields.name || fileName || 'EPD (PDF)', ...fields });
  const base = libMatToEpdEntry(row);
  return {
    ...base,
    uuid:         newId('pdf'),
    source:       'epd-pdf',
    isLibraryMaterial: false,
    manufacturer: fields.manufacturer || '',
    epdNumber:    fields.notes || '',
    sourceUrl:    fields.source_url || '',
    datasetType:  'EPD (PDF-Import)',
    quantity:     1,
    unit:         base.declaredUnit,
    added_at:     new Date().toISOString(),
  };
}

/** Free-text material without environmental data (minor ingredients) */
export function freetextEntry({ name = '', quantity = '', unit = '' } = {}) {
  return { uuid: newId('txt'), source: 'freetext', name, quantity, unit, indicators: {} };
}
