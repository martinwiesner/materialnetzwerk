import { useState, useRef, useCallback, useEffect } from 'react';
import { Search, X, Plus, Loader2, Leaf, ChevronDown, ChevronUp, Trash2, AlertTriangle } from 'lucide-react';
import { EpdFullAnalysis } from './EpdAnalysis';

const PROXY = 'https://oebd-proxy.martin-wiesner.workers.dev';

// Normalize unit string for comparison: strip leading number, resolve synonyms
function normalizeUnit(u) {
  if (!u) return '';
  let s = u.trim().replace(/^[\d.,]+\s*/, '').trim().toLowerCase();
  // Synonyms: metric ton / tonne / t
  if (['metric ton', 'metric tons', 'tonne', 'tonnes', 'tonnen', 'metrische tonne'].includes(s)) s = 't';
  // m³ variants
  if (['m3', 'cubic meter', 'cubic metre', 'kubikmeter'].includes(s)) s = 'm³';
  // m² variants
  if (['m2', 'square meter', 'square metre', 'quadratmeter'].includes(s)) s = 'm²';
  // kg variants
  if (['kilogramm', 'kilogram', 'kilograms', 'kilograms'].includes(s)) s = 'kg';
  // piece
  if (['piece', 'pieces', 'stück', 'stk', 'pce', 'pcs', 'unit', 'units'].includes(s)) s = 'stk';
  return s;
}
const BASE  = 'https://oekobaudat.de/OEKOBAU.DAT/resource';

const DATASETS = [
  { id: 'cd2bda71-760b-4fcc-8a0b-3877c10000a8', label: '2023-I (aktuell)' },
  { id: 'de0ecfe8-8cdf-4ba8-a3f7-1c2e8f1c9bd9', label: '2021-II' },
];

const GWP_UUIDS = new Set([
  '77e416eb-a363-4258-a04e-171d843a6460',
  'f49d46a7-01ad-4ddc-9ae4-c40dd2e75f87',
  'd7ae2a00-76ef-4b54-b5c8-305797b49f10',
]);

const INDICATOR_ORDER = [
  'GWP-total','GWP-fossil','GWP-biogenic','GWP-luluc',
  'ODP','AP','EP-terrestrial','EP-freshwater','EP-marine','POCP',
  'ADP-elements','ADP-fossil','ADP','WDP',
  'HWD','NHWD','RWD','PERE','PENRE','PERM',
];

const MODULES_ORDER = [
  'A1','A2','A3','A1-A3','A4','A5',
  'B1','B2','B3','B4','B5','B6','B7',
  'C1','C2','C3','C4','D','total',
];

const KEY_MODULES = ['A1-A3','C3','C4','D','B6'];

// ─── API helpers ────────────────────────────────────────────────────────────

function proxyFetch(target) {
  return fetch(`${PROXY}?url=${encodeURIComponent(target)}`, { headers: { Accept: 'application/json' } })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
}

function getName(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  // Handle being passed a shortDescription/baseName array directly
  if (Array.isArray(obj)) {
    const v = obj.find(x => x['@xml:lang'] === 'de') || obj.find(x => x['@xml:lang'] === 'en') || obj[0] || {};
    return v.value || v['#text'] || v.name || '';
  }
  const nd = obj.name || obj['common:shortDescription'] || obj.shortDescription || obj.baseName || obj.common_name || [];
  if (typeof nd === 'string') return nd;
  if (Array.isArray(nd)) {
    const v = nd.find(x => x['@xml:lang'] === 'de') || nd.find(x => x['@xml:lang'] === 'en') || nd[0] || {};
    return v.value || v['#text'] || v.name || '';
  }
  return '';
}

// ─── Module parsing ──────────────────────────────────────────────────────────

function parseModules(lciaResult) {
  const anies = lciaResult?.other?.anies;
  if (!anies) {
    const amt = lciaResult?.meanAmount;
    return amt != null ? { total: Number(amt) } : {};
  }
  const arr = Array.isArray(anies) ? anies : [anies];
  if (arr.length === 0) {
    const amt = lciaResult?.meanAmount;
    return amt != null ? { total: Number(amt) } : {};
  }
  const mods = {};

  // Format C (EPD 2019): each entry has @module attribute + amount in #text or value
  // e.g. {"@name":"epd2019:amount","@module":"A1-A3","#text":"3.25"}
  // or   {"@module":"A1-A3","value":"3.25"} / {"@module":"A1-A3","meanAmount":"3.25"}
  for (const a of arr) {
    const mod = a?.['@module'] || a?.module;
    if (!mod) continue;
    const amt = a?.meanAmount ?? a?.amount ?? a?.['@amount'] ?? a?.['#text'] ?? a?.value;
    if (amt != null && amt !== '') mods[mod] = Number(amt);
  }
  if (Object.keys(mods).length > 0) return mods;

  // Format A: sequential {name:"module", value:"A1-A3"} + {name:"amount"/"meanAmount", value:"12.5"}
  // Also handles epd2019-namespaced names like "epd2019:amount"
  let curMod = null;
  for (const a of arr) {
    const n = (a?.['@name'] || a?.name || '').toLowerCase();
    if (n === 'module' || n.endsWith(':module')) {
      curMod = a?.value || a?.['#text'] || a?.['@value'] || null;
    } else if ((n === 'meanamount' || n === 'amount' || n.endsWith(':amount')) && curMod !== null) {
      const raw = a?.value ?? a?.['#text'] ?? a?.['@value'];
      const num = raw != null ? Number(raw) : NaN;
      if (!isNaN(num)) { mods[curMod] = num; curMod = null; }
    }
  }
  if (Object.keys(mods).length > 0) return mods;

  const fb = lciaResult?.meanAmount;
  return fb != null ? { total: Number(fb) } : {};
}

// Prefer exact combined key (A1-A3) before summing individuals to avoid double-counting
function sumMods(mods, keys) {
  for (const k of keys) {
    if (k in mods && mods[k] != null) return mods[k];
  }
  let s = 0, found = false;
  for (const k of Object.keys(mods)) {
    if (keys.includes(k) && mods[k] != null) { s += mods[k]; found = true; }
  }
  return found ? s : null;
}

// ─── Indicator classification ────────────────────────────────────────────────

function getIndicatorRefName(r) {
  const ref = r?.referenceToLCIAMethodDataSet;
  if (!ref) return '';
  // Try the shortDescription / common:shortDescription array directly first
  const sd = ref.shortDescription || ref['common:shortDescription'] || ref['common_shortDescription'];
  if (sd) {
    const name = getName(sd);
    if (name) return name;
  }
  return getName(ref) || '';
}

function extractUnitFromName(name) {
  const m = name.match(/\[([^\]]+)\]/);
  return m ? m[1].trim() : '';
}

function classifyIndicator(name, uuid) {
  if (GWP_UUIDS.has(uuid)) return 'GWP-total';
  const n = name.toLowerCase();
  if (n.includes('luluc')) return 'GWP-luluc';
  if ((n.includes('biogen') || n.includes('biotic')) && (n.includes('gwp') || n.includes('global warm') || n.includes('climat') || n.includes('treibh'))) return 'GWP-biogenic';
  if (n.includes('fossil') && (n.includes('gwp') || n.includes('global warm') || n.includes('climat') || n.includes('treibh'))) return 'GWP-fossil';
  if (n.includes('gwp') || n.includes('global warm') || n.includes('climate change') || n.includes('treibhaus')) return 'GWP-total';
  if (n.includes('ozon') || n.includes('odp') || n.includes('stratospheric ozone')) return 'ODP';
  if (n.includes('photoch') || n.includes('pocp') || n.includes('ozone formation')) return 'POCP';
  if ((n.includes('terrestrial') || n.includes('terrest')) && (n.includes('eutro') || n.includes('ep'))) return 'EP-terrestrial';
  if ((n.includes('freshwater') || n.includes('süßwasser') || n.includes('fresh water')) && (n.includes('eutro') || n.includes('ep'))) return 'EP-freshwater';
  if ((n.includes('marine') || n.includes('aquatisch')) && (n.includes('eutro') || n.includes('ep'))) return 'EP-marine';
  if (n.includes('acidif') || n.includes('versauerung')) return 'AP';
  if (n.includes('elements') && (n.includes('abiotic') || n.includes('adp'))) return 'ADP-elements';
  if ((n.includes('fossil') || n.includes('non-renew')) && (n.includes('abiotic') || n.includes('adp'))) return 'ADP-fossil';
  if (n.includes('abiotic') || n.includes('adp')) return 'ADP';
  if ((n.includes('freshwater') || n.includes('süßwasser')) && (n.includes('depletion') || n.includes('wdp'))) return 'WDP';
  if (n.includes('water depl') || n.includes('wdp') || n.includes('wasserverbrauch')) return 'WDP';
  if (n.includes('hazardous waste') || n.includes('hwd')) return 'HWD';
  if (n.includes('non-hazardous') || n.includes('nhwd')) return 'NHWD';
  if (n.includes('radioactive') || n.includes('rwd')) return 'RWD';
  if ((n.includes('renewable') || n.includes('erneuerbar')) && n.includes('prim')) return 'PERE';
  if ((n.includes('non-renewable') || n.includes('nicht erneuer')) && n.includes('prim')) return 'PENRE';
  if (n.includes('prim') && n.includes('energ')) return 'PERM';
  return null;
}

function guessUnit(key) {
  if (key.startsWith('GWP'))  return 'kg CO₂ eq.';
  if (key === 'ODP')          return 'kg CFC-11 eq.';
  if (key === 'AP')           return 'mol H⁺ eq.';
  if (key.startsWith('EP'))   return 'kg P eq.';
  if (key === 'POCP')         return 'kg NMVOC eq.';
  if (key === 'ADP-elements') return 'kg Sb eq.';
  if (key === 'ADP-fossil' || key === 'ADP') return 'MJ';
  if (key === 'WDP')          return 'm³ world eq.';
  if (key.endsWith('WD'))     return 'kg';
  if (key.startsWith('PE'))   return 'MJ';
  return '';
}

// ─── Unit extraction ─────────────────────────────────────────────────────────

// Extract unit abbreviation from a declared-quantity string.
// "1 m³ Beton" → "m³"  |  "1 kg"  → "kg"  |  "1 Stück" → "Stück"
function parseDeclaredUnit(str) {
  if (!str || typeof str !== 'string') return '';
  // Match a leading number then grab the next non-space, non-comma token as the unit
  const m = str.trim().match(/^[\d.,×x\s*]+\s*([^\s,()]+)/);
  if (!m) return '';
  const candidate = m[1];
  // Sanity-check: reject if it looks like a plain word (too long, all lowercase ASCII)
  if (candidate.length > 10 && /^[a-z]+$/.test(candidate)) return '';
  return candidate;
}

// ─── EPD data extraction ─────────────────────────────────────────────────────

function extractEpdData(raw) {
  try {
    const proc = raw?.processDataSet || raw;
    const info = proc?.processInformation?.dataSetInformation;

    const name = getName(info?.name || info) || '';

    let category = '';
    const classInfo = info?.classificationInformation?.classification;
    const classArr = Array.isArray(classInfo) ? classInfo : (classInfo ? [classInfo] : []);
    if (classArr.length > 0) {
      const cls = classArr[0]?.class;
      if (Array.isArray(cls)) category = cls.map(c => c?.value || c?.['#text'] || '').filter(Boolean).join(' > ');
      else if (cls) category = getName(cls);
    }

    let declaredUnit = '';
    const quantRef = proc?.processInformation?.quantitativeReference;
    if (quantRef) {
      const funco = quantRef?.functionalUnitOrOther;
      if (funco) {
        // Get full string (handles plain string, multilingual array, or object)
        let raw = '';
        if (typeof funco === 'string') raw = funco;
        else if (Array.isArray(funco)) {
          const v = funco.find(x => x['@xml:lang'] === 'de') || funco.find(x => x['@xml:lang'] === 'en') || funco[0] || {};
          raw = v['#text'] || v.value || '';
        } else {
          raw = getName(funco);
        }
        declaredUnit = parseDeclaredUnit(raw);
      }
    }
    if (!declaredUnit) {
      const exchanges = proc?.exchanges?.exchange;
      const exchArr = Array.isArray(exchanges) ? exchanges : (exchanges ? [exchanges] : []);
      const refIdx = Number(quantRef?.referenceToReferenceFlow ?? quantRef?.referenceToReferenceFlows ?? 0);
      const refFlow = exchArr.find(e => Number(e?.['@dataSetInternalID']) === refIdx) || exchArr[0];
      if (refFlow) {
        const fpArr = (() => { const fp = refFlow?.flowProperties?.flowProperty; return Array.isArray(fp) ? fp : (fp ? [fp] : []); })();
        const refFp = fpArr.find(fp => fp?.['@isReference'] === 'true' || fp?.['@isReference'] === true) || fpArr[0];
        const raw2 = refFp?.referenceUnit || refFp?.unit || '';
        declaredUnit = parseDeclaredUnit(raw2) || raw2;
      }
    }
    // Last-resort: extract from EPD name like "Acetylated wood (1 m³, 510 kg/m³)" → "m³"
    if (!declaredUnit && name) {
      const m = name.match(/\([\d.,]+\s*([^\s,()]+)/);
      if (m) declaredUnit = m[1];
    }

    let norm = '';
    const comp = proc?.modellingAndValidation?.complianceDeclarations?.compliance;
    if (comp) {
      const compArr = Array.isArray(comp) ? comp : [comp];
      for (const c of compArr) {
        const ref = c?.referenceToComplianceSystem;
        const cName = getName(ref?.shortDescription || ref?.['common:shortDescription'] || ref?.common_shortDescription || ref) || '';
        if (cName.toLowerCase().includes('15804')) { norm = cName; break; }
      }
    }

    const lciaRoot = proc?.LCIAResults || proc?.lCIAResults;
    const rawResults = lciaRoot?.LCIAResult || lciaRoot?.lCIAResult || [];
    const lciaArr = Array.isArray(rawResults) ? rawResults : (rawResults ? [rawResults] : []);

    if (lciaArr.length === 0) {
      console.warn('[Ökobaudat] No LCIA results found. Top-level keys:', Object.keys(proc || {}));
    } else {
      const first = lciaArr[0];
      console.info('[Ökobaudat] LCIA results found:', lciaArr.length,
        '| first anies sample:', JSON.stringify(first?.other?.anies?.slice?.(0, 3)));
    }

    const indicators = {};
    for (const r of lciaArr) {
      const refObj = r?.referenceToLCIAMethodDataSet;
      const uuid   = refObj?.['@refObjectId'] || '';
      const rawName = getIndicatorRefName(r);
      const key = classifyIndicator(rawName, uuid);
      if (!key || key in indicators) continue;
      const unit = extractUnitFromName(rawName) || guessUnit(key);
      indicators[key] = { mods: parseModules(r), unit, rawName };
    }

    // Synthesize GWP-total from fossil + biogenic + luluc (EN 15804+A2 style EPDs)
    if (!indicators['GWP-total']) {
      const parts = ['GWP-fossil', 'GWP-biogenic', 'GWP-luluc'].filter(k => indicators[k]);
      if (parts.length > 0) {
        const allMods = new Set(parts.flatMap(k => Object.keys(indicators[k].mods)));
        const combined = {};
        for (const mod of allMods) {
          combined[mod] = parts.reduce((s, k) => s + (indicators[k].mods[mod] ?? 0), 0);
        }
        indicators['GWP-total'] = { mods: combined, unit: indicators[parts[0]].unit || 'kg CO₂ eq.', rawName: 'GWP-total (berechnet)', synthetic: true };
      }
    }

    const gwpMods = indicators['GWP-total']?.mods || {};
    return {
      name, category, declaredUnit, norm, indicators,
      gwpA1A3: sumMods(gwpMods, ['A1-A3', 'A1', 'A2', 'A3']),
      gwpEoL:  sumMods(gwpMods, ['C3', 'C4']),
      gwpD:    gwpMods?.D ?? null,
    };
  } catch (e) {
    console.error('Ökobaudat extraction error:', e);
    return null;
  }
}

// ─── Totals across all selected materials ────────────────────────────────────

function computeTotals(selected) {
  const totals = {};
  for (const epd of selected) {
    const qty = Number(epd.quantity) || 1;
    for (const [key, ind] of Object.entries(epd.indicators || {})) {
      if (!totals[key]) totals[key] = { unit: ind.unit, mods: {} };
      for (const [mod, val] of Object.entries(ind.mods || {})) {
        if (val != null) totals[key].mods[mod] = (totals[key].mods[mod] || 0) + qty * val;
      }
    }
  }
  return totals;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  if (v === 0) return '0';
  if (Math.abs(v) < 0.0001) return v.toExponential(2);
  if (Math.abs(v) >= 1000)  return v.toFixed(0);
  if (Math.abs(v) >= 100)   return v.toFixed(1);
  if (Math.abs(v) >= 1)     return v.toFixed(2);
  return v.toPrecision(3);
}

function sortedModKeys(mods) {
  return Object.keys(mods).sort((a, b) => {
    const ia = MODULES_ORDER.indexOf(a), ib = MODULES_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

// ─── Totals summary table ────────────────────────────────────────────────────

function TotalsSummary({ selected }) {
  const totals = computeTotals(selected);
  const keys = Object.keys(totals).sort((a, b) => {
    const ia = INDICATOR_ORDER.indexOf(a), ib = INDICATOR_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  if (!keys.length) return null;

  return (
    <div className="mt-3 border border-emerald-200 rounded-xl overflow-hidden">
      <div className="bg-emerald-700 px-3 py-2">
        <p className="text-xs font-bold text-white">Gesamte Umweltwirkung (alle EPDs × Menge)</p>
        <p className="text-[10px] text-emerald-200 mt-0.5">Gesamt = A1–A3 + B6 + C3 + C4 (ohne D, da D ein Gutschrift-Modul ist)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-emerald-50">
              <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-emerald-100 whitespace-nowrap">Indikator</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 border-b border-emerald-100 whitespace-nowrap">Einheit</th>
              <th className="text-right px-2 py-2 font-semibold text-emerald-700 border-b border-emerald-100 whitespace-nowrap">A1–A3</th>
              <th className="text-right px-2 py-2 font-semibold text-gray-600 border-b border-emerald-100 whitespace-nowrap">B6</th>
              <th className="text-right px-2 py-2 font-semibold text-gray-600 border-b border-emerald-100 whitespace-nowrap">C3+C4</th>
              <th className="text-right px-2 py-2 font-semibold text-blue-600 border-b border-emerald-100 whitespace-nowrap">D</th>
              <th className="text-right px-3 py-2 font-semibold text-emerald-800 border-b border-emerald-100 whitespace-nowrap bg-emerald-100">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key, i) => {
              const { unit, mods } = totals[key];
              const a1a3    = sumMods(mods, ['A1-A3', 'A1', 'A2', 'A3']);
              const b6      = mods['B6'] ?? null;
              const eol     = sumMods(mods, ['C3', 'C4']);
              const d       = mods['D'] ?? null;
              const lifecycle = [a1a3, b6, eol].reduce((s, v) => v != null ? s + v : s, 0);
              const hasLifecycle = a1a3 != null || b6 != null || eol != null;
              return (
                <tr key={key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{key}</td>
                  <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap">{unit}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700 font-medium">{fmtNum(a1a3)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{fmtNum(b6)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{fmtNum(eol)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-blue-600">{fmtNum(d)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-bold text-emerald-800 bg-emerald-50">
                    {hasLifecycle ? fmtNum(lifecycle) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Single EPD panel (with quantity input) ──────────────────────────────────

function EpdDataPanel({ epd, onChange, onRemove }) {
  const [expanded, setExpanded] = useState(false);

  const qty = epd.quantity ?? 1;
  const unit = epd.unit ?? epd.declaredUnit ?? '';
  const uf   = epd.uncertainty_factor ?? 1;

  const sortedKeys = Object.keys(epd.indicators || {}).sort((a, b) => {
    const ia = INDICATOR_ORDER.indexOf(a), ib = INDICATOR_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  const unitMismatch = epd.declaredUnit && unit && normalizeUnit(unit) !== normalizeUnit(epd.declaredUnit);
  const scaledGwpA1A3 = epd.gwpA1A3 != null ? epd.gwpA1A3 * qty * uf : null;

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-2 p-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 leading-tight">{epd.name}</span>
            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wide">EPD</span>
            {epd.norm && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded">{epd.norm}</span>}
          </div>
          {epd.category && <p className="text-xs text-gray-400 truncate">{epd.category}</p>}

          {/* Quantity + unit row */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-xs text-gray-500 whitespace-nowrap">Menge:</span>
            <input
              type="text"
              inputMode="decimal"
              value={qty}
              onChange={e => {
                const raw = e.target.value.replace(',', '.');
                const val = parseFloat(raw);
                onChange({ ...epd, quantity: isNaN(val) ? e.target.value : val });
              }}
              className="w-24 px-2 py-1 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-400 outline-none bg-white"
            />
            <input
              type="text"
              value={unit}
              onChange={e => onChange({ ...epd, unit: e.target.value })}
              placeholder={epd.declaredUnit || 'Einheit'}
              className={`w-24 px-2 py-1 border rounded-lg text-xs focus:ring-2 outline-none bg-white ${
                unitMismatch ? 'border-amber-400 focus:ring-amber-300 text-amber-800' : 'border-gray-300 focus:ring-emerald-400'
              }`}
            />
            {epd.declaredUnit && (
              <span className="text-[10px] text-gray-400 whitespace-nowrap">
                EPD-Bezug: <strong>{epd.declaredUnit}</strong>
              </span>
            )}
          </div>

          {/* Uncertainty factor row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 whitespace-nowrap">Unsicherheit ×</span>
            <input
              type="text"
              inputMode="decimal"
              value={uf}
              onChange={e => {
                const raw = e.target.value.replace(',', '.');
                const val = parseFloat(raw);
                onChange({ ...epd, uncertainty_factor: isNaN(val) ? e.target.value : val });
              }}
              className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-400 outline-none bg-white"
            />
            <span className="text-[10px] text-gray-400">(1.0 = kein Aufschlag)</span>
          </div>

          {/* Unit mismatch warning */}
          {unitMismatch && (
            <div className="flex items-start gap-1.5 mt-1 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-amber-800 leading-snug">
                  Einheit <strong>{unit}</strong> ≠ EPD-Bezugsgröße <strong>{epd.declaredUnit}</strong>.
                  Bitte Menge direkt in <strong>{epd.declaredUnit}</strong> eingeben — der EPD-Wert bezieht sich auf genau diese Einheit.
                  Beispiel: wenn du 2&nbsp;t hast und die EPD pro kg deklariert, trage <strong>2000</strong> ein.
                </p>
              </div>
              <button type="button"
                onClick={() => onChange({ ...epd, unit: epd.declaredUnit })}
                className="text-[10px] text-amber-700 underline whitespace-nowrap hover:text-amber-900 flex-shrink-0">
                Einheit zurücksetzen
              </button>
            </div>
          )}

          {/* Quick GWP summary scaled by quantity × uncertainty */}
          {scaledGwpA1A3 != null && (
            <p className="text-xs font-medium text-emerald-700">
              GWP A1–A3 gesamt: <strong>{fmtNum(scaledGwpA1A3)} kg CO₂ eq.</strong>
              <span className="font-normal text-gray-400 ml-1">
                ({fmtNum(epd.gwpA1A3)} × {qty}{uf !== 1 ? ` × ${uf}` : ''})
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button type="button" onClick={() => setExpanded(v => !v)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            title={expanded ? 'Einklappen' : 'Alle Indikatoren'}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button type="button" onClick={onRemove}
            className="p-1.5 text-red-400 hover:text-red-600 rounded-lg transition-colors" title="Entfernen">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded: all LCIA indicators per module */}
      {expanded && (
        <div className="border-t border-emerald-200 px-3 pb-3 pt-3 space-y-3">
          {sortedKeys.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Keine LCIA-Indikatoren gefunden.</p>
          ) : (
            <div className="space-y-2.5">
              {sortedKeys.map(key => {
                const ind = epd.indicators[key];
                const mods = sortedModKeys(ind.mods);
                return (
                  <div key={key}>
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-xs font-bold text-gray-700">{key}</span>
                      {ind.synthetic && <span className="text-[10px] text-gray-400">(berechnet)</span>}
                      <span className="text-[10px] text-gray-400">[{ind.unit}]</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {mods.map(mod => {
                        const raw = ind.mods[mod];
                        const scaled = raw != null ? raw * qty : null;
                        return (
                          <span key={mod}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] ${
                              KEY_MODULES.includes(mod)
                                ? 'bg-emerald-100 text-emerald-800 font-semibold'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                            title={qty !== 1 ? `EPD-Wert: ${fmtNum(raw)}  ×  ${qty} = ${fmtNum(scaled)}` : undefined}>
                            <span className="opacity-60">{mod}:</span>
                            {qty !== 1 && scaled != null ? fmtNum(scaled) : fmtNum(raw)}
                          </span>
                        );
                      })}
                    </div>
                    {qty !== 1 && (
                      <p className="text-[10px] text-gray-400 mt-0.5">Werte × {qty} skaliert</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="pt-1 border-t border-emerald-100 text-[10px] text-gray-400 space-y-0.5">
            <div>UUID: <span className="font-mono">{epd.uuid}</span></div>
            {epd.version && <div>Version: {epd.version}</div>}
            {epd.datasetLabel && <div>Datensatz: {epd.datasetLabel}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function OekobaudatPicker({ selected = [], onChange }) {
  const [open, setOpen]             = useState(false);
  const [query, setQuery]           = useState('');
  const [dsId, setDsId]             = useState(DATASETS[0].id);
  const [results, setResults]       = useState([]);
  const [searching, setSearching]   = useState(false);
  const [fetchingId, setFetchingId] = useState(null);
  const [error, setError]           = useState('');
  // Background EPD cache: { [uuid]: 'loading' | { gwpA1A3, extracted } | null }
  const [epdCache, setEpdCache]     = useState({});
  const abortRef  = useRef(null);
  const genRef    = useRef(0); // incremented to abort old background fetches

  // ── Background GWP fetching for search results (IDEMAT-style ranking) ──────
  useEffect(() => {
    if (!results.length) { setEpdCache({}); return; }

    const gen = ++genRef.current;
    const limited = results.slice(0, 20);

    setEpdCache(() => {
      const init = {};
      for (const r of limited) {
        const uuid = r.uuid || r['@uuid'] || '';
        if (uuid) init[uuid] = 'loading';
      }
      return init;
    });

    let qi = 0;
    async function worker() {
      while (true) {
        if (genRef.current !== gen) return;
        const i = qi++;
        if (i >= limited.length) return;
        const r  = limited[i];
        const uuid    = r.uuid    || r['@uuid']    || '';
        const version = r.version || r['@version'] || '';
        if (!uuid) continue;
        try {
          const vq  = version ? `version=${encodeURIComponent(version)}&` : '';
          const raw = await proxyFetch(`${BASE}/datastocks/${dsId}/processes/${uuid}?${vq}format=JSON&view=extended`);
          if (genRef.current !== gen) return;
          const extracted = extractEpdData(raw);
          setEpdCache(prev => ({ ...prev, [uuid]: { gwpA1A3: extracted?.gwpA1A3 ?? null, extracted } }));
        } catch {
          if (genRef.current !== gen) return;
          setEpdCache(prev => ({ ...prev, [uuid]: null }));
        }
      }
    }
    // 3 concurrent workers
    worker(); worker(); worker();
  }, [results, dsId]);

  const updateItem = useCallback((idx, updated) => {
    const next = [...selected];
    next[idx] = updated;
    onChange(next);
  }, [selected, onChange]);

  const remove = useCallback((uuid) => onChange(selected.filter(s => s.uuid !== uuid)), [selected, onChange]);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setSearching(true);
    setError('');
    setResults([]);
    try {
      const url = `${BASE}/datastocks/${dsId}/processes?search=true&name=${encodeURIComponent(query.trim())}&format=JSON&pageSize=30`;
      const data = await proxyFetch(url);
      const arr = Array.isArray(data?.data || data?.processes) ? (data?.data || data?.processes) : [];
      setResults(arr);
      if (!arr.length) setError('Keine Ergebnisse gefunden.');
    } catch (e) {
      if (e.name !== 'AbortError') setError('Suche fehlgeschlagen: ' + e.message);
    } finally {
      setSearching(false);
    }
  }, [query, dsId]);

  const buildEntry = (uuid, version, dsLabel, extracted) => ({
    uuid,
    version:      version || '',
    datasetLabel: dsLabel,
    name:         extracted.name,
    category:     extracted.category,
    declaredUnit: extracted.declaredUnit,
    norm:         extracted.norm,
    gwpA1A3:      extracted.gwpA1A3,
    gwpEoL:       extracted.gwpEoL,
    gwpD:         extracted.gwpD,
    indicators:   extracted.indicators,
    quantity:     1,
    unit:         extracted.declaredUnit || '',
    added_at:     new Date().toISOString(),
  });

  const handleAdd = async (uuid, version, dsLabel) => {
    // Use cached data if the background fetch already completed
    const cached = epdCache[uuid];
    if (cached && typeof cached === 'object' && cached.extracted) {
      if (!selected.find(s => s.uuid === uuid)) {
        onChange([...selected, buildEntry(uuid, version, dsLabel, cached.extracted)]);
      }
      closeModal();
      return;
    }

    setFetchingId(uuid);
    setError('');
    try {
      const vq  = version ? `version=${encodeURIComponent(version)}&` : '';
      const raw = await proxyFetch(`${BASE}/datastocks/${dsId}/processes/${uuid}?${vq}format=JSON&view=extended`);
      const extracted = extractEpdData(raw);
      if (!extracted) throw new Error('EPD-Daten konnten nicht extrahiert werden');

      if (!selected.find(s => s.uuid === uuid)) {
        onChange([...selected, buildEntry(uuid, version, dsLabel, extracted)]);
      }
      closeModal();
    } catch (e) {
      setError('Laden fehlgeschlagen: ' + e.message);
    } finally {
      setFetchingId(null);
    }
  };

  const closeModal = () => {
    genRef.current++; // abort background fetches
    setOpen(false); setQuery(''); setResults([]); setError(''); setEpdCache({});
  };

  return (
    <div className="space-y-2">
      {/* Selected EPD panels */}
      {selected.map((epd, idx) => (
        <EpdDataPanel
          key={epd.uuid}
          epd={epd}
          onChange={(updated) => updateItem(idx, updated)}
          onRemove={() => remove(epd.uuid)}
        />
      ))}

      {/* Totals table */}
      {selected.length > 0 && <TotalsSummary selected={selected} />}

      {/* Analysis: per-material chart + breakdown table */}
      {selected.length > 0 && <EpdFullAnalysis selected={selected} />}

      {/* Add button */}
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-sm text-emerald-700 border border-dashed border-emerald-300 rounded-lg hover:bg-emerald-50 hover:border-emerald-400 transition-colors">
        <Plus className="w-4 h-4" />
        Ökobaudat-EPD suchen &amp; hinzufügen
      </button>

      {/* Search modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Ökobaudat durchsuchen</h3>
                  <p className="text-[10px] text-gray-400">Professionelle Umweltdaten für Baumaterialien (EPD)</p>
                </div>
              </div>
              <button type="button" onClick={closeModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 pt-3 flex-shrink-0">
              <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
                {DATASETS.map(ds => (
                  <button key={ds.id} type="button"
                    onClick={() => { setDsId(ds.id); setResults([]); setError(''); }}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
                      dsId === ds.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {ds.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 py-3 flex-shrink-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
                    placeholder="Material suchen (z. B. Beton, Holz, Ziegel, Dämm)…"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
                  />
                </div>
                <button type="button" onClick={search}
                  disabled={searching || !query.trim()}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors flex items-center gap-1.5">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Suchen
                </button>
              </div>
              {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {searching && (
                <div className="flex items-center justify-center py-10 gap-2 text-gray-400 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin" /> Suche läuft…
                </div>
              )}
              {!searching && results.length > 0 && (() => {
                // Sort ascending: most negative (best) → smallest positive → unknown last
                const cached = uuid => epdCache[uuid];
                const gwpOf  = r => {
                  const c = cached(r.uuid || r['@uuid'] || '');
                  return c && typeof c === 'object' ? c.gwpA1A3 : undefined;
                };
                const sorted = [...results].sort((a, b) => {
                  const ag = gwpOf(a), bg = gwpOf(b);
                  const aKnown = ag !== undefined, bKnown = bg !== undefined;
                  if (!aKnown && !bKnown) return 0;
                  if (!aKnown) return 1;  // unknowns sink to bottom
                  if (!bKnown) return -1;
                  return (ag ?? Infinity) - (bg ?? Infinity); // ascending
                });
                // Bar width relative to max positive GWP only
                const maxGwp = Math.max(0, ...Object.values(epdCache)
                  .filter(c => c && typeof c === 'object' && typeof c.gwpA1A3 === 'number' && c.gwpA1A3 > 0)
                  .map(c => c.gwpA1A3));
                const loadingCount = Object.values(epdCache).filter(c => c === 'loading').length;

                return (
                  <div className="space-y-1">
                    {loadingCount > 0 && (
                      <p className="text-[10px] text-gray-400 flex items-center gap-1 px-1 pb-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        GWP wird geladen ({Object.values(epdCache).filter(c => c && typeof c === 'object').length}/{Math.min(results.length, 20)}) — wird nach Klima­wirkung sortiert
                      </p>
                    )}
                    {sorted.map(r => {
                      const uuid       = r.uuid    || r['@uuid']    || '';
                      const version    = r.version || r['@version'] || '';
                      const name       = getName(r?.name || r) || uuid;
                      const cat        = r?.category || '';
                      const isFetching = fetchingId === uuid;
                      const isAdded    = selected.some(s => s.uuid === uuid);
                      const cacheEntry = epdCache[uuid];
                      const gwp        = cacheEntry && typeof cacheEntry === 'object' ? cacheEntry.gwpA1A3 : undefined;
                      const isNegGwp   = typeof gwp === 'number' && gwp < 0;
                      // Bar only for positive GWP, proportional to the highest positive value
                      const barPct     = typeof gwp === 'number' && gwp > 0 && maxGwp > 0
                        ? Math.max(3, (gwp / maxGwp) * 100) : 0;

                      return (
                        <div key={uuid + version}
                          className="relative overflow-hidden rounded-lg border transition-all hover:border-emerald-300 hover:shadow-sm"
                          style={{ borderColor: isAdded ? '#6ee7b7' : '#f3f4f6' }}>

                          {/* IDEMAT-style bar — sits flush behind the row, no extra div on top */}
                          {barPct > 0 && (
                            <div className="absolute inset-y-0 left-0 bg-emerald-400 transition-all duration-700 ease-out pointer-events-none"
                              style={{ width: `${barPct}%`, opacity: isAdded ? 0.22 : 0.14 }} />
                          )}
                          {/* Carbon-negative bar (teal, left side accent) */}
                          {isNegGwp && (
                            <div className="absolute inset-y-0 left-0 w-1 bg-teal-400 pointer-events-none" />
                          )}
                          {/* Loading shimmer */}
                          {cacheEntry === 'loading' && (
                            <div className="absolute inset-y-0 left-0 w-2/5 bg-gray-100 animate-pulse pointer-events-none" />
                          )}

                          {/* Content — NO background override so the bar always shows through */}
                          <div className={`relative flex items-center gap-3 px-3 py-2.5 ${isAdded ? 'bg-emerald-50/40' : ''}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate leading-snug">{name}</p>
                              {cat && <p className="text-[11px] text-gray-400 truncate">{cat}</p>}
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {version && <span className="text-[10px] text-gray-300">{version}</span>}
                                {typeof gwp === 'number' && (
                                  isNegGwp ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5">
                                      CO₂-negativ: {fmtNum(gwp)} kg CO₂ eq.
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-semibold text-emerald-700">
                                      GWP A1–A3: {fmtNum(gwp)} kg CO₂ eq.
                                    </span>
                                  )
                                )}
                                {cacheEntry === 'loading' && (
                                  <span className="text-[10px] text-gray-400 italic">GWP wird geladen…</span>
                                )}
                              </div>
                            </div>
                            {isAdded ? (
                              <span className="text-xs text-emerald-600 font-bold flex-shrink-0">✓</span>
                            ) : (
                              <button type="button"
                                onClick={() => handleAdd(uuid, version, DATASETS.find(d => d.id === dsId)?.label || '')}
                                disabled={!!fetchingId}
                                className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-emerald-600 hover:text-white hover:bg-emerald-600 border border-emerald-200 rounded-lg disabled:opacity-40 transition-colors">
                                {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
