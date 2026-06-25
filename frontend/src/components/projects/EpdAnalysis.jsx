import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

function normalizeUnit(u) {
  if (!u) return '';
  let s = u.trim().replace(/^[\d.,]+\s*/, '').trim().toLowerCase();
  if (['metric ton', 'metric tons', 'tonne', 'tonnes', 'tonnen', 'metrische tonne'].includes(s)) s = 't';
  if (['m3', 'cubic meter', 'cubic metre', 'kubikmeter'].includes(s)) s = 'm³';
  if (['m2', 'square meter', 'square metre', 'quadratmeter'].includes(s)) s = 'm²';
  if (['kilogramm', 'kilogram', 'kilograms'].includes(s)) s = 'kg';
  if (['piece', 'pieces', 'stück', 'stk', 'pce', 'pcs', 'unit', 'units'].includes(s)) s = 'stk';
  return s;
}

// Returns how many "toUnit" fit in one "fromUnit". Returns 1 if units are equal or incompatible.
function unitConvFactor(fromUnit, toUnit) {
  function toKg(u) {
    if (u === 'kg') return 1;
    if (u === 't')  return 1000;
    if (u === 'g')  return 0.001;
    return null;
  }
  const from = normalizeUnit(fromUnit);
  const to   = normalizeUnit(toUnit);
  if (!from || !to || from === to) return 1;
  const fK = toKg(from), tK = toKg(to);
  if (fK != null && tK != null && tK !== 0) return fK / tK;
  return 1; // incompatible units (e.g. t vs m³) — no conversion possible
}

const INDICATOR_DEFS = {
  'GWP-total':      { label: 'GWP gesamt',              unit: 'kg CO₂ eq.',    phase: 'Klimawandel',  desc: 'Gesamtes Treibhausgaspotenzial: fossil + biogen + Landnutzungsänderung.' },
  'GWP-fossil':     { label: 'GWP fossil',              unit: 'kg CO₂ eq.',    phase: 'Klimawandel',  desc: 'Emissionen aus Kohle, Öl und Gas — Haupttreiber des Klimawandels.' },
  'GWP-biogenic':   { label: 'GWP biogen',              unit: 'kg CO₂ eq.',    phase: 'Klimawandel',  desc: 'CO₂ aus nachwachsenden Rohstoffen. Bei Holz oft negativ (gespeichertes CO₂).' },
  'GWP-luluc':      { label: 'GWP LULUC',               unit: 'kg CO₂ eq.',    phase: 'Klimawandel',  desc: 'Emissionen durch Landnutzungsänderung (z. B. Rodung).' },
  'ODP':            { label: 'Ozonabbaupotenzial',       unit: 'kg CFC-11 eq.', phase: 'Ozonschicht',  desc: 'Abbau der stratosphärischen Ozonschicht durch halogenierte Verbindungen.' },
  'AP':             { label: 'Versauerungspotenzial',    unit: 'mol H⁺ eq.',    phase: 'Luft',         desc: 'Saurer Regen durch SO₂, NOₓ, NH₃ — schädigt Böden und Gewässer.' },
  'EP-terrestrial': { label: 'Eutrophierung terrestr.', unit: 'mol N eq.',      phase: 'Ökosystem',    desc: 'Stickstoffüberschuss auf Böden durch NH₃/NOₓ.' },
  'EP-freshwater':  { label: 'Eutrophierung Süßwasser', unit: 'kg P eq.',       phase: 'Ökosystem',    desc: 'Phosphateintrag in Seen/Flüsse → Algenwachstum, Sauerstoffmangel.' },
  'EP-marine':      { label: 'Eutrophierung Meer',       unit: 'kg N eq.',       phase: 'Ökosystem',    desc: 'Stickstoffeintrag in Meeresgewässer.' },
  'POCP':           { label: 'Sommersmog (POCP)',        unit: 'kg NMVOC eq.',  phase: 'Luft',         desc: 'Bodennahes Ozon aus flüchtigen organischen Verbindungen und NOₓ.' },
  'ADP-elements':   { label: 'ADP Elemente',             unit: 'kg Sb eq.',     phase: 'Ressourcen',   desc: 'Verbrauch nicht erneuerbarer Mineralien/Metalle (Antimon-Äquivalent).' },
  'ADP-fossil':     { label: 'ADP fossil',               unit: 'MJ',            phase: 'Ressourcen',   desc: 'Fossiler Energieverbrauch (Öl, Gas, Kohle) für Herstellung und Transport.' },
  'WDP':            { label: 'Wassernutzung (WDP)',       unit: 'm³',            phase: 'Wasser',       desc: 'Netto-Wasserverbrauch, gewichtet nach regionaler Wasserknappheit.' },
  'HWD':            { label: 'Gefähr. Abfall (HWD)',     unit: 'kg',            phase: 'Abfall',       desc: 'Gefährlicher Abfall zur Entsorgung.' },
  'NHWD':           { label: 'Nicht-gef. Abfall (NHWD)', unit: 'kg',            phase: 'Abfall',       desc: 'Nicht gefährlicher Abfall (z. B. Bauschutt, Kunststoffe).' },
  'RWD':            { label: 'Radioaktiver Abfall (RWD)',unit: 'kg',            phase: 'Abfall',       desc: 'Radioaktiver Abfall zur Entsorgung.' },
  'PERE':           { label: 'Erneuerb. Energie (PERE)', unit: 'MJ',            phase: 'Energie',      desc: 'Primärenergie aus erneuerbaren Quellen (Solar, Wind, Biomasse …).' },
  'PENRE':          { label: 'Nicht erneuerb. (PENRE)',  unit: 'MJ',            phase: 'Energie',      desc: 'Primärenergie aus fossilen und nuklearen Quellen.' },
  'PERM':           { label: 'Erneuerb. als Material',   unit: 'MJ',            phase: 'Energie',      desc: 'Erneuerbare Energie, die als Rohstoff (nicht Brennstoff) genutzt wird.' },
};

const PHASE_COLORS = {
  'Klimawandel': '#059669', 'Ozonschicht': '#0891b2', 'Luft': '#7c3aed',
  'Ökosystem': '#d97706', 'Ressourcen': '#dc2626', 'Wasser': '#0284c7',
  'Abfall': '#78716c', 'Energie': '#ea580c',
};

const INDICATOR_ORDER = [
  'GWP-total','GWP-fossil','GWP-biogenic','GWP-luluc',
  'ODP','AP','EP-terrestrial','EP-freshwater','EP-marine','POCP',
  'ADP-elements','ADP-fossil','ADP','WDP',
  'HWD','NHWD','RWD','PERE','PENRE','PERM',
];

const MAT_COLORS = [
  '#059669','#2563eb','#7c3aed','#d97706',
  '#e11d48','#0891b2','#65a30d','#c026d3','#ea580c','#0d9488',
];

const MODULE_GROUPS = {
  'A1–A3': ['A1-A3','A1','A2','A3'],
  'B6':    ['B6'],
  'C3+C4': ['C3','C4'],
  'D':     ['D'],
  'Lifecycle': ['A1-A3','A1','A2','A3','B6','C3','C4'],
};

function sumMods(mods, keys) {
  for (const k of keys) if (k in mods && mods[k] != null) return mods[k];
  let s = 0, found = false;
  for (const k of Object.keys(mods)) {
    if (keys.includes(k) && mods[k] != null) { s += mods[k]; found = true; }
  }
  return found ? s : null;
}

function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  if (v === 0) return '0';
  if (Math.abs(v) < 0.0001) return v.toExponential(2);
  if (Math.abs(v) >= 1000)  return v.toFixed(0);
  if (Math.abs(v) >= 100)   return v.toFixed(1);
  if (Math.abs(v) >= 1)     return v.toFixed(2);
  return v.toPrecision(3);
}

function shortLabel(name, words = 4) {
  const parts = (name || '').split(/\s+/);
  return parts.length <= words ? name : parts.slice(0, words).join(' ') + '…';
}

function getIndicators(selected) {
  return [...new Set(selected.flatMap(e => Object.keys(e.indicators || {})))]
    .sort((a, b) => {
      const ia = INDICATOR_ORDER.indexOf(a), ib = INDICATOR_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
}

function getVal(epd, indicatorKey, modKeys) {
  const conv = unitConvFactor(epd.unit, epd.declaredUnit);
  const qty  = (Number(epd.quantity) || 1) * conv;
  const uf   = Number(epd.uncertainty_factor) || 1;
  const mods = epd.indicators?.[indicatorKey]?.mods || {};
  const v    = sumMods(mods, modKeys);
  return v != null ? v * qty * uf : null;
}

// ── Stacked horizontal bar showing each material's share ─────────────────────

function ContributionBar({ selected, indicatorKey, modKeys }) {
  const vals = selected.map((epd, i) => ({
    name:  epd.name,
    unit:  epd.unit || epd.declaredUnit || '',
    qty:   Number(epd.quantity) || 1,
    val:   getVal(epd, indicatorKey, modKeys),
    color: MAT_COLORS[i % MAT_COLORS.length],
  }));

  const pos = vals.filter(v => v.val != null && v.val >= 0);
  const neg = vals.filter(v => v.val != null && v.val < 0);
  const posTotal = pos.reduce((s, v) => s + v.val, 0);
  const negTotal = Math.abs(neg.reduce((s, v) => s + v.val, 0));

  if (!pos.length && !neg.length) {
    return <p className="text-xs text-gray-400 italic py-2">Keine Daten für diesen Indikator / dieses Modul</p>;
  }

  return (
    <div className="space-y-2">
      {/* Positive bar */}
      {pos.length > 0 && posTotal > 0 && (
        <div>
          <div className="flex h-8 rounded-lg overflow-hidden border border-gray-200 shadow-inner">
            {pos.map((v, i) => (
              <div key={i}
                style={{ width: `${(v.val / posTotal) * 100}%`, backgroundColor: v.color, minWidth: v.val / posTotal > 0.04 ? 0 : 2 }}
                title={`${v.name}\n${fmtNum(v.val)} (${Math.round(v.val / posTotal * 100)}%)`}
                className="relative transition-all"
              >
                {v.val / posTotal > 0.12 && (
                  <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold drop-shadow">
                    {Math.round(v.val / posTotal * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-gray-400">Gesamt: {fmtNum(posTotal)}</span>
          </div>
        </div>
      )}

      {/* Negative bar (module D credits) */}
      {neg.length > 0 && negTotal > 0 && (
        <div>
          <p className="text-[10px] text-blue-500 mb-0.5">Gutschriften (negativ)</p>
          <div className="flex h-5 rounded overflow-hidden border border-blue-100">
            {neg.map((v, i) => (
              <div key={i}
                style={{ width: `${(Math.abs(v.val) / negTotal) * 100}%`, backgroundColor: v.color, opacity: 0.6 }}
                title={`${v.name}: ${fmtNum(v.val)}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Legend row for materials ──────────────────────────────────────────────────

function MatLegend({ selected, indicatorKey, modKeys }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
      {selected.map((epd, i) => {
        const val = getVal(epd, indicatorKey, modKeys);
        const qty = Number(epd.quantity) || 1;
        const unit = epd.unit || epd.declaredUnit || '';
        return (
          <div key={epd.uuid} className="flex items-start gap-1.5">
            <div className="w-3 h-3 rounded-sm flex-shrink-0 mt-0.5" style={{ backgroundColor: MAT_COLORS[i % MAT_COLORS.length] }} />
            <div className="min-w-0">
              <p className="text-xs text-gray-700 leading-tight max-w-[150px] truncate" title={epd.name}>{epd.name}</p>
              <p className="text-[10px] text-gray-400">{qty} {unit}{val != null ? ` · ${fmtNum(val)}` : ''}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Per-material breakdown table ──────────────────────────────────────────────

function BreakdownTable({ selected, modKeys, modLabel }) {
  const indicators = getIndicators(selected);
  if (!indicators.length) return null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-800 px-3 py-2 flex items-center gap-2">
        <p className="text-xs font-bold text-white">Materialbilanz — {modLabel}</p>
        <span className="text-[10px] text-gray-400 ml-auto">Werte × Menge skaliert</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">Indikator</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-400 whitespace-nowrap">Einheit</th>
              {selected.map((epd, i) => (
                <th key={epd.uuid} className="text-right px-3 py-2 font-semibold whitespace-nowrap">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="max-w-[100px] truncate block" style={{ color: MAT_COLORS[i % MAT_COLORS.length] }}
                      title={epd.name}>{shortLabel(epd.name, 3)}</span>
                    <span className="text-[10px] font-normal text-gray-400">
                      {Number(epd.quantity) || 1} {epd.unit || epd.declaredUnit || ''}
                    </span>
                  </div>
                </th>
              ))}
              <th className="text-right px-3 py-2 font-semibold text-gray-800 bg-gray-100 whitespace-nowrap">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((key, rowIdx) => {
              const isGwp = key === 'GWP-total';
              const unit = selected.find(e => e.indicators?.[key])?.indicators?.[key]?.unit || '';
              const matVals = selected.map(epd => getVal(epd, key, modKeys));
              const hasAny = matVals.some(v => v != null);
              const total = matVals.reduce((s, v) => v != null ? s + v : s, 0);

              const rowBg = isGwp ? 'bg-emerald-50' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60';

              return (
                <tr key={key} className={`${rowBg} border-b border-gray-100 last:border-0`}>
                  <td className={`px-3 py-2 whitespace-nowrap font-semibold ${isGwp ? 'text-emerald-800' : 'text-gray-700'}`}>
                    {key}
                  </td>
                  <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{unit}</td>
                  {matVals.map((v, mi) => {
                    const pct = hasAny && total !== 0 && v != null ? (v / total) * 100 : null;
                    return (
                      <td key={mi} className="px-3 py-2 text-right">
                        <div className="flex flex-col items-end">
                          {/* Mini bar */}
                          {v != null && hasAny && total !== 0 && (
                            <div className="h-1 rounded-full mb-1 w-16 bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.abs(v / total) * 100)}%`,
                                  backgroundColor: MAT_COLORS[mi % MAT_COLORS.length],
                                  opacity: v < 0 ? 0.5 : 1,
                                }}
                              />
                            </div>
                          )}
                          <span className={`tabular-nums ${v == null ? 'text-gray-300' : isGwp ? 'text-emerald-700 font-bold' : 'text-gray-700'}`}>
                            {fmtNum(v)}
                          </span>
                          {pct != null && Math.abs(pct) >= 1 && (
                            <span className="text-[10px] text-gray-400">{Math.round(pct)}%</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-800 bg-gray-50">
                    {hasAny ? fmtNum(total) : '—'}
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

// ── Lifecycle phase definitions for bar chart ─────────────────────────────────

const BAR_PHASES = [
  { id: 'H', label: 'Herstellung (H)', mods: ['A1-A3','A1','A2','A3','A4','A5'], color: '#2563eb' },
  { id: 'E', label: 'Erneuerung (E)',  mods: ['B1','B2','B3','B4','B5','B6','B7'], color: '#7c3aed' },
  { id: 'R', label: 'Entsorgung (R)',  mods: ['C1','C2','C3','C4'], color: '#b45309' },
  { id: 'D', label: 'D',               mods: ['D'], color: '#94a3b8' },
];

function niceStep(roughStep) {
  if (!roughStep || isNaN(roughStep) || roughStep <= 0) return 1;
  const exp = Math.floor(Math.log10(roughStep));
  const pow = Math.pow(10, exp);
  const norm = roughStep / pow;
  if (norm < 1.5) return pow;
  if (norm < 3.5) return 2 * pow;
  if (norm < 7.5) return 5 * pow;
  return 10 * pow;
}

function niceRange(min, max) {
  const span = max - min || 1;
  const step = niceStep(span / 5);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t = lo; t <= hi + step * 0.001; t = Math.round((t + step) * 1e12) / 1e12) {
    ticks.push(t);
  }
  return { ticks, lo, hi };
}

function PerMaterialBarChart({ selected }) {
  const [indicator, setIndicator] = useState('GWP-total');

  const indicators = getIndicators(selected);
  const activeInd = indicators.includes(indicator) ? indicator : (indicators[0] || 'GWP-total');
  const indicatorDef = INDICATOR_DEFS[activeInd];
  const indicatorUnit = selected.find(e => e.indicators?.[activeInd])?.indicators?.[activeInd]?.unit
    || indicatorDef?.unit || '';

  // Which phases actually have data for this indicator?
  const activePhasesForInd = BAR_PHASES.filter(ph =>
    selected.some(epd => {
      const mods = epd.indicators?.[activeInd]?.mods || {};
      return ph.mods.some(m => mods[m] != null);
    })
  );

  // Per-material, per-phase values (scaled by quantity)
  const matData = selected.map((epd, i) => {
    const qty = Number(epd.quantity) || 1;
    const mods = epd.indicators?.[activeInd]?.mods || {};
    const phaseVals = activePhasesForInd.map(ph => {
      let sum = null;
      for (const m of ph.mods) {
        if (mods[m] != null) sum = (sum ?? 0) + mods[m];
      }
      return sum != null ? sum * qty : null;
    });
    return { name: epd.name, color: MAT_COLORS[i % MAT_COLORS.length], phaseVals };
  });

  const allVals = matData.flatMap(m => m.phaseVals).filter(v => v != null);
  if (!allVals.length || !activePhasesForInd.length) {
    return (
      <div className="border border-gray-200 rounded-xl p-4 text-xs text-gray-400 italic text-center">
        Keine Phasendaten für diesen Indikator verfügbar.
      </div>
    );
  }

  const posMax = Math.max(...allVals.filter(v => v >= 0), 0);
  const negMin = Math.min(...allVals.filter(v => v < 0), 0);
  const { ticks, lo, hi } = niceRange(negMin, posMax);
  const totalRange = hi - lo || 1;

  // SVG layout
  const ML = 58, MR = 10, MT = 12, MB = 52;
  const VW = 480, VH = 220;
  const CW = VW - ML - MR;
  const CH = VH - MT - MB;
  const nMat = matData.length;
  const nPh = activePhasesForInd.length;
  const groupW = CW / nMat;
  const barW = Math.min(Math.floor(groupW / (nPh + 1)), 22);
  const groupPad = (groupW - nPh * barW) / 2;

  const yPx = (v) => MT + CH * (1 - (v - lo) / totalRange);
  const zeroY = yPx(0);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
          {indicatorDef?.label || activeInd} je Material
        </span>
        <select
          value={activeInd}
          onChange={e => setIndicator(e.target.value)}
          className="ml-auto text-xs border border-gray-300 rounded-md px-2 py-0.5 bg-white text-gray-700 focus:ring-1 focus:ring-emerald-400 outline-none">
          {indicators.map(k => (
            <option key={k} value={k}>{k} [{INDICATOR_DEFS[k]?.unit || ''}]</option>
          ))}
        </select>
      </div>

      {/* Phase legend */}
      <div className="flex flex-wrap gap-4 px-4 pt-3 pb-1">
        {activePhasesForInd.map(ph => (
          <div key={ph.id} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: ph.color }} />
            <span className="text-[11px] text-gray-600">{ph.label}</span>
          </div>
        ))}
      </div>

      {/* SVG bar chart */}
      <div className="px-2 pb-3">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ height: '220px' }}>
          {/* Y-axis */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#e5e7eb" strokeWidth={1} />

          {/* Grid lines + Y tick labels */}
          {ticks.map((t, ti) => {
            const y = yPx(t);
            if (y < MT - 2 || y > MT + CH + 2) return null;
            const isZero = Math.abs(t) < totalRange * 0.001;
            return (
              <g key={ti}>
                <line x1={ML} y1={y} x2={ML + CW} y2={y}
                  stroke={isZero ? '#6b7280' : '#e5e7eb'}
                  strokeWidth={isZero ? 1.5 : 1}
                  strokeDasharray={isZero ? undefined : '3 3'} />
                <text x={ML - 5} y={y + 3.5} textAnchor="end" fontSize={9} fill="#9ca3af">
                  {fmtNum(t)}
                </text>
              </g>
            );
          })}

          {/* Y-axis unit label */}
          <text
            x={8} y={MT + CH / 2}
            textAnchor="middle"
            fontSize={8} fill="#9ca3af"
            transform={`rotate(-90, 8, ${MT + CH / 2})`}
          >
            {indicatorUnit}
          </text>

          {/* Bars */}
          {matData.map((mat, mi) => {
            const gx = ML + mi * groupW;
            return (
              <g key={mi}>
                {mat.phaseVals.map((val, pi) => {
                  if (val == null) return null;
                  const bx = gx + groupPad + pi * barW;
                  const by = val >= 0 ? yPx(val) : zeroY;
                  const bh = Math.max(Math.abs(yPx(val) - zeroY), 1);
                  return (
                    <rect key={pi} x={bx} y={by} width={barW - 1} height={bh}
                      fill={activePhasesForInd[pi].color} opacity={0.82} rx={1.5}>
                      <title>{mat.name} — {activePhasesForInd[pi].label}: {fmtNum(val)} {indicatorUnit}</title>
                    </rect>
                  );
                })}

                {/* Material name label */}
                <text
                  x={gx + groupW / 2} y={MT + CH + 14}
                  textAnchor="middle" fontSize={9} fill="#374151"
                  style={{ fontWeight: 500 }}>
                  {shortLabel(mat.name, 2)}
                </text>
                <text
                  x={gx + groupW / 2} y={MT + CH + 24}
                  textAnchor="middle" fontSize={8} fill="#9ca3af">
                  {`${Number(selected[mi]?.quantity) || 1} ${selected[mi]?.unit || selected[mi]?.declaredUnit || ''}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Public: full analysis block (chart + table) ───────────────────────────────

export function EpdFullAnalysis({ selected }) {
  const [chartIndicator, setChartIndicator] = useState('GWP-total');
  const [modGroup, setModGroup] = useState('A1–A3');

  const indicators = getIndicators(selected);
  if (!indicators.length) return null;

  const activeIndicator = indicators.includes(chartIndicator) ? chartIndicator : indicators[0];
  const modKeys  = MODULE_GROUPS[modGroup] || MODULE_GROUPS['A1–A3'];
  const modLabel = modGroup;

  const unitMismatches = selected.filter(
    epd => epd.declaredUnit && epd.unit && normalizeUnit(epd.unit) !== normalizeUnit(epd.declaredUnit)
  );

  return (
    <div className="space-y-4 mt-4">
      {/* Unit mismatch warnings */}
      {unitMismatches.length > 0 && (
        <div className="space-y-1.5">
          {unitMismatches.map(epd => (
            <div key={epd.uuid} className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>
                <strong>{epd.name}</strong>: Einheit <strong>{epd.unit}</strong> weicht von EPD-Bezugsgröße <strong>{epd.declaredUnit}</strong> ab —
                die Menge {Number(epd.quantity) || 1} wird direkt mit dem EPD-Wert multipliziert. Bitte Menge in <strong>{epd.declaredUnit}</strong> angeben (Projekt bearbeiten → Ökobaudat-Abschnitt).
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">
          Analyse &amp; Vergleich
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Module selector */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-gray-500 font-medium">Modul:</span>
        {Object.keys(MODULE_GROUPS).map(m => (
          <button key={m} type="button" onClick={() => setModGroup(m)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all ${
              modGroup === m
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-700'
            }`}>
            {m}
          </button>
        ))}
      </div>

      {/* Chart card */}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-700">Materialvergleich</span>
          <select
            value={activeIndicator}
            onChange={e => setChartIndicator(e.target.value)}
            className="ml-1 text-xs border border-gray-300 rounded-md px-2 py-0.5 bg-white text-gray-700 focus:ring-1 focus:ring-emerald-400 outline-none">
            {indicators.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <span className="text-[10px] text-gray-400 ml-auto">{modLabel}</span>
        </div>
        <div className="px-4 py-4">
          <ContributionBar selected={selected} indicatorKey={activeIndicator} modKeys={modKeys} />
          <MatLegend selected={selected} indicatorKey={activeIndicator} modKeys={modKeys} />
        </div>
      </div>

      {/* Per-material lifecycle phase bar chart */}
      <PerMaterialBarChart selected={selected} />

      {/* Breakdown table */}
      <BreakdownTable selected={selected} modKeys={modKeys} modLabel={modLabel} />

      {/* Indicator legend */}
      <IndicatorLegend presentKeys={indicators} />
    </div>
  );
}

// ── Collapsible indicator explanation panel ───────────────────────────────────

function IndicatorLegend({ presentKeys }) {
  const [open, setOpen] = useState(false);
  const relevant = presentKeys.filter(k => INDICATOR_DEFS[k]);
  if (!relevant.length) return null;

  const byPhase = {};
  for (const k of relevant) {
    const d = INDICATOR_DEFS[k];
    if (!byPhase[d.phase]) byPhase[d.phase] = [];
    byPhase[d.phase].push({ key: k, ...d });
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
        <span className="text-xs font-semibold text-gray-600">Was bedeuten diese Indikatoren?</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {Object.entries(byPhase).map(([phase, items]) => (
            <div key={phase}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: PHASE_COLORS[phase] || '#6b7280' }}>
                {phase}
              </p>
              <div className="space-y-1.5">
                {items.map(({ key, label, unit, desc }) => (
                  <div key={key} className="text-xs">
                    <span className="font-semibold text-gray-800">{key}</span>
                    <span className="text-gray-400 ml-1">({unit})</span>
                    <span className="text-gray-500 ml-1">— {label}</span>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
