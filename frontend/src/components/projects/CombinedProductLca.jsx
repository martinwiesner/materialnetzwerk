import { useState } from 'react';
import { Leaf, Info, AlertTriangle } from 'lucide-react';

// ── EF 3.1 conversion factors (EC JRC, EF 3.1 method, 2021) ─────────────────
// Formula: Pt = (impact_value / norm_factor) * weight_factor
// Source: EN 15804+A2 indicator → EF 3.1 normalization (unit/person·year) + weighting (dimensionless)
export const EF31_CONV = {
  'GWP-total':      { norm: 7.55e3,  wf: 0.2106, ef31: 'climate_change',      label: 'Klimawandel',               unit: 'kg CO₂ eq.' },
  'ODP':            { norm: 5.36e-2, wf: 0.0631, ef31: 'ozone_depletion',     label: 'Ozonabbau',                 unit: 'kg CFC-11 eq.' },
  'AP':             { norm: 5.56e1,  wf: 0.0620, ef31: 'acidification',       label: 'Versauerung',               unit: 'mol H⁺ eq.' },
  'EP-terrestrial': { norm: 1.77e2,  wf: 0.0371, ef31: 'eutroph_terrestrial', label: 'Eutrophierung (terrestr.)', unit: 'mol N eq.' },
  'EP-freshwater':  { norm: 1.61e0,  wf: 0.0280, ef31: 'eutroph_freshwater',  label: 'Eutrophierung (SW)',        unit: 'kg P eq.' },
  'EP-marine':      { norm: 1.95e1,  wf: 0.0296, ef31: 'eutroph_marine',      label: 'Eutrophierung (Meer)',      unit: 'kg N eq.' },
  'POCP':           { norm: 4.09e1,  wf: 0.0478, ef31: 'photochem_ozone',     label: 'Photosmog',                 unit: 'kg NMVOC eq.' },
  'ADP-fossil':     { norm: 6.50e4,  wf: 0.0832, ef31: 'resource_fossils',    label: 'Ressourcen (fossil)',       unit: 'MJ' },
  'ADP-elements':   { norm: 6.36e-2, wf: 0.0755, ef31: 'resource_minerals',   label: 'Ressourcen (mineralisch)', unit: 'kg Sb eq.' },
  'WDP':            { norm: 1.14e4,  wf: 0.0851, ef31: 'water_use',           label: 'Wassernutzung',             unit: 'm³ world eq.' },
};

// Not convertible from EN 15804+A2 — no matching standard indicator
const NOT_CONV = [
  { ef31: 'particulate_matter',  label: 'Feinstaub',               wf: 0.0896 },
  { ef31: 'human_tox_cancer',    label: 'Tox. Mensch (krebserr.)', wf: 0.0213 },
  { ef31: 'human_tox_noncancer', label: 'Tox. Mensch (nicht-k.)', wf: 0.0184 },
  { ef31: 'ionising_radiation',  label: 'Ionisierende Strahlung',  wf: 0.0501 },
  { ef31: 'ecotox_freshwater',   label: 'Ökotox. Süßwasser',       wf: 0.0192 },
  { ef31: 'land_use',            label: 'Landnutzung',             wf: 0.0794 },
];

const COVERED_WF = Object.values(EF31_CONV).reduce((s, v) => s + v.wf, 0); // ≈ 0.722

const A1A3_KEYS = ['A1-A3', 'A1', 'A2', 'A3'];
const EOL_KEYS  = ['C3', 'C4'];

// sumAll=false: first direct-key hit wins (for composite keys like 'A1-A3' > A1+A2+A3)
// sumAll=true:  always sum all found keys (for independent modules like C3 + C4)
export function sumMods(mods, keys, sumAll = false) {
  if (!sumAll) {
    for (const k of keys) if (k in mods && mods[k] != null) return mods[k];
  }
  let s = 0, found = false;
  for (const k of Object.keys(mods)) {
    if (keys.includes(k) && mods[k] != null) { s += mods[k]; found = true; }
  }
  return found ? s : null;
}

// Convert EPD indicators to EF 3.1 Pt for given module keys
export function indsToPt(indicators, modKeys, sumAll = false) {
  let pt = 0;
  let covered = [];
  for (const [indKey, { norm, wf }] of Object.entries(EF31_CONV)) {
    const mods = indicators?.[indKey]?.mods;
    if (!mods) continue;
    const v = sumMods(mods, modKeys, sumAll);
    if (v != null) { pt += (v / norm) * wf; covered.push(indKey); }
  }
  return { pt, covered };
}

// Get single EF 3.1 category value from EPD indicators, for one module set
export function indsToCatPt(indicators, ef31key, modKeys, sumAll = false) {
  const entry = Object.values(EF31_CONV).find(c => c.ef31 === ef31key);
  if (!entry) return null;
  const indKey = Object.entries(EF31_CONV).find(([, v]) => v.ef31 === ef31key)?.[0];
  if (!indKey) return null;
  const mods = indicators?.[indKey]?.mods;
  if (!mods) return null;
  const v = sumMods(mods, modKeys, sumAll);
  if (v == null) return null;
  return (v / entry.norm) * entry.wf;
}

// Generic: read a physical indicator value (own unit, e.g. kg CO₂ eq., m³, mol H⁺ eq.)
// directly from EPD indicators, for given module keys
function indsToIndicatorVal(indicators, indKey, modKeys, sumAll = false) {
  const mods = indicators?.[indKey]?.mods;
  if (!mods) return null;
  return sumMods(mods, modKeys, sumAll);
}

// GWP from EPD indicators (kg CO₂ eq.) for given module keys
export function indsToGWP(indicators, modKeys, sumAll = false) {
  return indsToIndicatorVal(indicators, 'GWP-total', modKeys, sumAll);
}

// Back-calculate GWP from IDEMAT climate_change Pt
// climate_change [Pt] = GWP [kg CO₂ eq.] / 7550 × 0.2106
// → GWP [kg CO₂ eq.] = climate_change [Pt] × 7550 / 0.2106
const GWP_NORM = 7.55e3;
const GWP_WF   = 0.2106;
export function ccPtToGWP(climatePt) {
  if (climatePt == null) return null;
  return climatePt * GWP_NORM / GWP_WF;
}

// Generic inverse of Pt = (value / norm) * wf → value = Pt × norm / wf
// Lets us back-calculate a physical value (e.g. m³ water, mol H⁺ eq.) from an
// IDEMAT process's EF 3.1 Pt sub-score for any convertible indicator.
export function ptToPhysical(indKey, pt) {
  if (pt == null) return null;
  const conv = EF31_CONV[indKey];
  if (!conv) return null;
  return pt * conv.norm / conv.wf;
}

export function fmtIndVal(v) {
  if (v == null || isNaN(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 100)      return v.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  if (a >= 1)        return v.toLocaleString('de-DE', { maximumFractionDigits: 3 });
  if (a >= 0.0001)   return v.toLocaleString('de-DE', { maximumFractionDigits: 6 });
  // Fixed-point down to 1e-8 (readable, no scientific notation) — only fall back
  // to exponential notation below that, where fixed-point would be unreadable.
  if (a >= 1e-8)     return v.toFixed(Math.min(Math.ceil(-Math.log10(a)) + 3, 12)).replace('.', ',');
  return v.toExponential(2).replace('.', ',');
}

// Heat-scale background for a table cell, relative to the row's largest value —
// makes the dominant contributor(s) per indicator visually obvious at a glance.
export function heatBg(intensity) {
  if (!intensity) return undefined;
  const alpha = 0.1 + Math.min(intensity, 1) * 0.5;
  return `rgba(220, 38, 38, ${alpha.toFixed(2)})`;
}

export function fmtPt(v) {
  if (v == null || isNaN(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 0.01)     return v.toLocaleString('de-DE', { maximumFractionDigits: 4 });
  if (a >= 0.0001)   return v.toLocaleString('de-DE', { maximumFractionDigits: 6 });
  if (a >= 0.000001) return v.toLocaleString('de-DE', { maximumFractionDigits: 8 });
  return v.toLocaleString('de-DE', { maximumFractionDigits: 10 });
}

export function fmtGWP(v) {
  if (v == null || isNaN(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1)        return v.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  if (a >= 0.001)    return v.toLocaleString('de-DE', { maximumFractionDigits: 4 });
  if (a >= 0.000001) return v.toLocaleString('de-DE', { maximumFractionDigits: 6 });
  return v.toLocaleString('de-DE', { maximumFractionDigits: 8 });
}

export function fmtPct(v) {
  if (v == null || isNaN(v) || !isFinite(v)) return '—';
  return v.toFixed(1) + ' %';
}

// Build per-entry data for the combined table
export function buildEntries(epdMats, idematItems, selectedCat) {
  const entries = [];

  for (const mat of epdMats) {
    const qty  = Number(mat.quantity) || 1;
    const inds = mat.indicators || {};

    // Scale indicators by quantity (EPD values are per declared unit)
    const scaledInds = {};
    for (const [k, ind] of Object.entries(inds)) {
      scaledInds[k] = {
        unit: ind.unit,
        mods: Object.fromEntries(
          Object.entries(ind.mods || {}).map(([m, v]) => [m, v != null ? v * qty : null])
        ),
      };
    }

    let a1a3Pt, b6Pt, eolPt, dPt, lifePt, catPt;

    if (selectedCat === 'total') {
      a1a3Pt = indsToPt(scaledInds, A1A3_KEYS);
      b6Pt   = indsToPt(scaledInds, ['B6']);
      eolPt  = indsToPt(scaledInds, EOL_KEYS, true);  // sumAll: C3 + C4 both independent
      dPt    = indsToPt(scaledInds, ['D']);
      lifePt = { pt: a1a3Pt.pt + b6Pt.pt + eolPt.pt, covered: a1a3Pt.covered };
    } else {
      const a1a3v = indsToCatPt(scaledInds, selectedCat, A1A3_KEYS);
      const b6v   = indsToCatPt(scaledInds, selectedCat, ['B6']);
      const eolv  = indsToCatPt(scaledInds, selectedCat, EOL_KEYS, true);  // sumAll
      const dv    = indsToCatPt(scaledInds, selectedCat, ['D']);
      a1a3Pt = { pt: a1a3v ?? 0 };
      b6Pt   = { pt: b6v   ?? 0 };
      eolPt  = { pt: eolv  ?? 0 };
      dPt    = { pt: dv    ?? 0 };
      lifePt = { pt: (a1a3v ?? 0) + (b6v ?? 0) + (eolv ?? 0) };
      catPt  = lifePt;
    }

    const gwpA1A3 = indsToGWP(scaledInds, A1A3_KEYS);
    const gwpB6   = indsToGWP(scaledInds, ['B6']);
    const gwpEoL  = indsToGWP(scaledInds, EOL_KEYS, true);  // sumAll: C3 + C4 both independent
    const gwpD    = indsToGWP(scaledInds, ['D']);
    const gwpLife = [gwpA1A3, gwpB6, gwpEoL].reduce((s, v) => v != null ? s + v : s, 0) || null;

    // Biogenic GWP — tracked separately for plausibility warnings (significant negatives = stored carbon)
    const gwpBioMods = scaledInds?.['GWP-biogenic']?.mods;
    const gwpBiogenic = gwpBioMods ? sumMods(gwpBioMods, A1A3_KEYS) : null;

    // Every convertible EF 3.1 indicator, in its own physical unit (not Pt) —
    // e.g. Wasserverbrauch in m³, Versauerung in mol H⁺ eq. — direct from EPD data.
    const indicatorVals = {};
    for (const indKey of Object.keys(EF31_CONV)) {
      const a1a3 = indsToIndicatorVal(scaledInds, indKey, A1A3_KEYS);
      const b6   = indsToIndicatorVal(scaledInds, indKey, ['B6']);
      const eol  = indsToIndicatorVal(scaledInds, indKey, EOL_KEYS, true);
      const d    = indsToIndicatorVal(scaledInds, indKey, ['D']);
      const life = [a1a3, b6, eol].reduce((s, v) => v != null ? s + v : s, 0) || null;
      indicatorVals[indKey] = (a1a3 != null || b6 != null || eol != null || d != null)
        ? { a1a3, b6, eol, d, life } : null;
    }

    entries.push({
      id: mat.uuid || mat.id,
      type: 'material',
      name: mat.name,
      source: mat.norm || mat.epd_id || 'EPD',
      qty,
      unit: mat.unit || mat.declaredUnit || 'kg',
      a1a3Pt: a1a3Pt.pt,
      b6Pt:   b6Pt.pt,
      eolPt:  eolPt.pt,
      dPt:    dPt.pt,
      lifePt: lifePt.pt,
      gwpA1A3, gwpB6, gwpEoL, gwpD, gwpLife, gwpBiogenic,
      indicatorVals,
      covered: a1a3Pt.covered || [],
      isLibMat: !!mat.isLibraryMaterial,
    });
  }

  for (const it of idematItems) {
    const totalPt = (it.ef31_total ?? 0) * it.quantity;
    let catPt = null;
    if (selectedCat !== 'total' && it.ef31?.[selectedCat] != null) {
      catPt = it.ef31[selectedCat] * it.quantity;
    }
    // Back-calculate GWP from EF 3.1 climate_change Pt (per process unit × quantity)
    const ccPt = it.ef31?.climate_change != null ? it.ef31.climate_change * it.quantity : null;
    const gwpEquiv = ccPtToGWP(ccPt);

    // Back-calculate every convertible indicator's physical value from the process's
    // own EF 3.1 sub-score (Pt) — same inversion used for GWP, generalized.
    const indicatorVals = {};
    for (const [indKey, conv] of Object.entries(EF31_CONV)) {
      const subPt = it.ef31?.[conv.ef31];
      const val = subPt != null ? ptToPhysical(indKey, subPt * it.quantity) : null;
      indicatorVals[indKey] = val != null ? { a1a3: val, b6: null, eol: null, d: null, life: val } : null;
    }

    entries.push({
      id: it.id,
      type: 'process',
      name: it.name,
      source: 'IDEMAT 2026',
      qty: it.quantity,
      unit: it.unit,
      a1a3Pt: selectedCat === 'total' ? totalPt : (catPt ?? 0),
      b6Pt:   0,
      eolPt:  0,
      dPt:    0,
      lifePt: selectedCat === 'total' ? totalPt : (catPt ?? 0),
      gwpA1A3: gwpEquiv,  // equivalent GWP back-calculated from climate_change Pt
      gwpB6:   null,
      gwpEoL:  null,
      gwpD:    null,
      gwpLife: gwpEquiv,
      indicatorVals,
      covered: ['IDEMAT'],
    });
  }

  return entries;
}

// ── SVG stacked bar chart ────────────────────────────────────────────────────

function StackedBarChart({ matA1A3, matB6, matEoL, matD, procPt }) {
  const [tooltip, setTooltip] = useState(null);

  const phases = [
    {
      key: 'A1-A3',
      label: 'A1–A3',
      mat: matA1A3,
      proc: procPt,
    },
    {
      key: 'B6',
      label: 'B6',
      mat: matB6,
      proc: 0,
    },
    {
      key: 'C3+C4',
      label: 'C3+C4',
      mat: matEoL,
      proc: 0,
    },
    {
      key: 'Lifecycle',
      label: 'Modul-\nSumme',
      mat: matA1A3 + matB6 + matEoL,
      proc: procPt,
    },
    {
      key: 'D',
      label: 'Modul D',
      mat: matD,
      proc: 0,
    },
  ];

  const allVals = phases.flatMap(p => [p.mat, p.proc]);
  const maxAbs = Math.max(...allVals.map(Math.abs), 0.001);

  const W = 560, H = 240, PAD_L = 60, PAD_B = 40, PAD_T = 16, PAD_R = 16;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_B - PAD_T;

  const maxPos = Math.max(...allVals.filter(v => v > 0), 0);
  const maxNeg = Math.abs(Math.min(...allVals.filter(v => v < 0), 0));
  const totalRange = maxPos + maxNeg || 1;
  const zeroY = PAD_T + (maxPos / totalRange) * chartH;

  const barW = Math.min(50, (chartW / phases.length) * 0.5);
  const gapW = chartW / phases.length;

  function ptToY(v) {
    return zeroY - (v / totalRange) * chartH;
  }

  function barRect(xCenter, val, color, label, phase) {
    if (!val || val === 0) return null;
    const y0 = ptToY(0);
    const y1 = ptToY(val);
    const top    = Math.min(y0, y1);
    const height = Math.abs(y1 - y0);
    if (height < 1) return null;
    return (
      <rect
        key={`${phase}-${label}`}
        x={xCenter - barW / 2}
        y={top}
        width={barW}
        height={height}
        fill={color}
        rx={3}
        style={{ cursor: 'default' }}
        onMouseEnter={(e) => setTooltip({
          x: e.clientX, y: e.clientY,
          text: `${phase}: ${label}`,
          val: fmtPt(val) + ' Pt',
        })}
        onMouseLeave={() => setTooltip(null)}
      />
    );
  }

  // Y-axis labels
  const steps = 4;
  const yTicks = Array.from({ length: steps + 1 }, (_, i) => {
    const v = maxPos - (totalRange / steps) * i;
    return { y: ptToY(v), v };
  });

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 260 }}>
        {/* Y-axis ticks + lines */}
        {yTicks.map(({ y, v }) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y}
              stroke={Math.abs(v) < 0.0001 ? '#374151' : '#e5e7eb'}
              strokeWidth={Math.abs(v) < 0.0001 ? 1.5 : 0.5}
              strokeDasharray={Math.abs(v) < 0.0001 ? '' : '3,3'}
            />
            <text x={PAD_L - 4} y={y + 3} textAnchor="end"
              fontSize={8} fill="#9ca3af" fontFamily="monospace">
              {fmtPt(v)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {phases.map((ph, i) => {
          const xCenter = PAD_L + gapW * i + gapW / 2;
          const matColor  = ph.mat < 0 ? '#0891b2' : '#2563eb';
          const procColor = ph.proc < 0 ? '#0d9488' : '#059669';
          const matX  = xCenter - barW * 0.02;
          const procX = xCenter + barW * 0.52;

          return (
            <g key={ph.key}>
              {barRect(matX,  ph.mat,  matColor,  'Materialien', ph.label)}
              {barRect(procX, ph.proc, procColor, 'Prozesse',    ph.label)}
              {/* Phase label */}
              <text x={xCenter} y={H - PAD_B + 14} textAnchor="middle"
                fontSize={9} fill="#374151" fontWeight="600">
                {ph.label}
              </text>
            </g>
          );
        })}

        {/* Y-axis label */}
        <text
          transform={`translate(10, ${H / 2}) rotate(-90)`}
          textAnchor="middle" fontSize={9} fill="#6b7280">
          EF 3.1 [Pt]
        </text>

        {/* Legend */}
        <rect x={PAD_L} y={4} width={10} height={8} fill="#2563eb" rx={2} />
        <text x={PAD_L + 13} y={12} fontSize={8} fill="#374151">Materialien</text>
        <rect x={PAD_L + 74} y={4} width={10} height={8} fill="#059669" rx={2} />
        <text x={PAD_L + 87} y={12} fontSize={8} fill="#374151">Prozesse</text>
      </svg>

      {tooltip && (
        <div className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 10, top: tooltip.y - 30 }}>
          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg">
            <div className="font-medium">{tooltip.text}</div>
            <div className="font-mono text-emerald-300">{tooltip.val}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

const EF31_ALL_CATS = [
  { key: 'total', label: 'EF 3.1 Gesamt (Pt)' },
  ...Object.values(EF31_CONV).map(c => ({ key: c.ef31, label: c.label })),
  ...NOT_CONV.map(c => ({ key: c.ef31, label: c.label + ' *' })),
];

export function CombinedProductLca({ epdMats = [], idematItems = [] }) {
  const [selectedCat, setSelectedCat] = useState('total');
  const [showTable, setShowTable] = useState(true);
  const [methodNote, setMethodNote] = useState(false);

  if (!epdMats.length && !idematItems.length) return null;

  const entries = buildEntries(epdMats, idematItems, selectedCat);

  const matEntries  = entries.filter(e => e.type === 'material');
  const procEntries = entries.filter(e => e.type === 'process');

  const matsA1A3   = matEntries.reduce((s, e) => s + e.a1a3Pt, 0);
  const matsB6     = matEntries.reduce((s, e) => s + e.b6Pt, 0);
  const matsEoL    = matEntries.reduce((s, e) => s + e.eolPt, 0);
  const matsD      = matEntries.reduce((s, e) => s + e.dPt, 0);
  const matsLife   = matsA1A3 + matsB6 + matsEoL;

  const procsTotal = procEntries.reduce((s, e) => s + e.lifePt, 0);

  const grandTotal = matsLife + procsTotal;
  const grandD     = matsD;

  const matShare  = grandTotal !== 0 ? (matsLife / grandTotal) * 100 : null;
  const procShare = grandTotal !== 0 ? (procsTotal / grandTotal) * 100 : null;

  // GWP totals (kg CO₂ eq.)
  const gwpMatA1A3  = matEntries.reduce((s, e) => e.gwpA1A3  != null ? s + e.gwpA1A3  : s, 0) || null;
  const gwpMatB6    = matEntries.reduce((s, e) => e.gwpB6    != null ? s + e.gwpB6    : s, 0) || null;
  const gwpMatEoL   = matEntries.reduce((s, e) => e.gwpEoL   != null ? s + e.gwpEoL   : s, 0) || null;
  const gwpMatD     = matEntries.reduce((s, e) => e.gwpD     != null ? s + e.gwpD     : s, 0) || null;
  const gwpMatLife  = [gwpMatA1A3, gwpMatB6, gwpMatEoL].reduce((s, v) => v != null ? s + v : s, 0) || null;
  const gwpProcLife = procEntries.reduce((s, e) => e.gwpLife  != null ? s + e.gwpLife  : s, 0) || null;
  const gwpTotal    = [gwpMatLife, gwpProcLife].reduce((s, v) => v != null ? s + v : s, 0) || null;
  const gwpGrandD   = gwpMatD;
  const hasProcGwp  = procEntries.some(e => e.gwpA1A3 != null);

  // Per-indicator rows for the "weitere Umweltindikatoren" table — every EF 3.1
  // indicator except GWP-total (which already has its own dedicated table above).
  const indicatorRows = Object.entries(EF31_CONV)
    .filter(([key]) => key !== 'GWP-total')
    .map(([key, conv]) => {
      const perEntry = entries.map(e => e.indicatorVals?.[key]?.life ?? null);
      const total = perEntry.reduce((s, v) => v != null ? s + v : s, 0);
      const hasAny = perEntry.some(v => v != null);
      const rowMax = Math.max(0, ...perEntry.filter(v => v != null).map(v => Math.abs(v)));
      return { key, label: conv.label, unit: conv.unit, perEntry, total, hasAny, rowMax };
    })
    .filter(r => r.hasAny);

  const hasEpdMats  = matEntries.length > 0;
  const hasProcs    = procEntries.length > 0;
  const isPartial   = hasEpdMats && selectedCat === 'total';

  // Dynamic coverage: which EF31_CONV keys actually appear in the dataset
  const coveredKeys    = new Set(matEntries.flatMap(e => e.covered || []));
  const dynamicCovWf   = [...coveredKeys].reduce((s, k) => s + (EF31_CONV[k]?.wf || 0), 0);
  // coveredPct as % of total EF 3.1 (all 16 cats sum to 1.0)
  const coveredPct     = matEntries.length > 0
    ? Math.round(dynamicCovWf * 100)
    : Math.round(COVERED_WF * 100);

  // Dynamic EOL label: show only the modules actually declared
  const eolModsAvail = { c3: false, c4: false };
  for (const mat of epdMats) {
    for (const ind of Object.values(mat.indicators || {})) {
      if (ind.mods?.C3 != null) eolModsAvail.c3 = true;
      if (ind.mods?.C4 != null) eolModsAvail.c4 = true;
    }
  }
  const eolLabel = eolModsAvail.c3 && eolModsAvail.c4 ? 'C3+C4'
                 : eolModsAvail.c3 ? 'C3'
                 : eolModsAvail.c4 ? 'C4'
                 : 'EoL';

  // Biogenic GWP warning: significant stored carbon (< −50 kg CO₂ eq. or > 20 % of GWP-total)
  const biogenicEntries = matEntries.filter(e =>
    e.gwpBiogenic != null && e.gwpBiogenic < 0 && (
      e.gwpBiogenic < -50 ||
      (e.gwpA1A3 != null && Math.abs(e.gwpBiogenic) > Math.abs(e.gwpA1A3) * 0.2)
    )
  );
  const hasBiogenicWarn = biogenicEntries.length > 0;

  // For category view: check if the selected category is not convertible from EPD
  const isNotConv   = NOT_CONV.some(c => c.ef31 === selectedCat);

  return (
    <div className="p-6 border-t-2 border-emerald-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Leaf className="w-5 h-5 text-emerald-600" />
            Gesamtproduktbilanz – EF 3.1
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Materialien (EPD → EF 3.1 Pt) + Prozesse (IDEMAT 2026 EF 3.1 Pt) · gemeinsame Produktansicht
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMethodNote(v => !v)}
          className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mt-1"
        >
          <Info className="w-4 h-4" />
          Methodik
        </button>
      </div>

      {/* Methodology note */}
      {methodNote && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-gray-700 leading-relaxed">
          <div className="flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 mb-1">Methodischer Hinweis – Indikative Bewertung</p>
              <p>
                Die Gesamtbewertung kombiniert zwei methodisch unterschiedliche Datenquellen:
                EPD-Daten nach <strong>EN 15804+A2</strong> (deklarierte Umweltindikatoren) und
                Prozessdaten aus <strong>IDEMAT 2026</strong> (TU Delft, CC BY-NC, EF 3.1).
                Die gemeinsame Darstellung in Pt ist methodisch vereinfacht und <em>indikativ</em> –
                sie dient der Orientierung, nicht der Zertifizierung.
              </p>
              <p className="mt-2">
                <strong>Materialdaten (EPD → EF 3.1 Pt, {coveredPct} % der EF 3.1-Gewichtung abgedeckt):</strong>{' '}
                {Object.values(EF31_CONV).map(c => c.label).join(', ')}.
                Umrechenbar über: Pt = (Indikatorwert / Normierungsfaktor) × Gewichtungsfaktor (EC JRC, 2021).
              </p>
              <p className="mt-1">
                <strong>Nicht umrechenbar aus EN 15804+A2 ({Math.round((1 - COVERED_WF) * 100)} % der EF 3.1-Gewichtung):</strong>{' '}
                {NOT_CONV.map(c => c.label).join(', ')}.
                Diese Kategorien fehlen im Material-Pt-Score und werden <em>nicht</em> durch null ersetzt.
              </p>
              <p className="mt-1">
                <strong>Prozessdaten (IDEMAT 2026):</strong> 16 EF 3.1-Wirkungskategorien als Datenfelder verfügbar.
                Die methodische Äquivalenz zu verifizierten EPDs ist nicht vollständig validiert.
                GWP-Werte für Prozesse werden aus dem EF 3.1 Klimawandel-Pt rückgerechnet
                (GWP = climate_change_Pt × {GWP_NORM.toLocaleString('de-DE')} / {GWP_WF}).
                Prozessen ist kein Lebenszyklusmodul zugeordnet, es sei denn, dies wurde explizit angegeben.
              </p>
              <p className="mt-1">
                Modul D (Gutschriften und Lasten außerhalb der Systemgrenzen) wird separat ausgewiesen
                und <em>nicht</em> in die indikative Gesamtbewertung eingerechnet.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Partial score warning */}
      {isPartial && hasEpdMats && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <strong>Teilscore – nicht vollständig:</strong> EPD-Materialien konnten nur für{' '}
            {coveredPct} % der EF 3.1-Gewichtung umgerechnet werden. Die nicht umrechenbaren
            Kategorien (Feinstaub, Human- und Ökotoxizität, Landnutzung, Ionisierende Strahlung,
            {' '}{Math.round((1 - COVERED_WF) * 100)} % der Gewichtung) fehlen im Material-Pt-Score.
          </p>
        </div>
      )}

      {isNotConv && hasEpdMats && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">
            Diese EF 3.1-Kategorie ist nicht aus EN 15804+A2-EPD-Daten umrechenbar.
            Materialien zeigen daher keinen Beitrag (—).
          </p>
        </div>
      )}

      {/* Category selector */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Darstellung</label>
        <select
          value={selectedCat}
          onChange={e => setSelectedCat(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
        >
          {EF31_ALL_CATS.map(c => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        <div className="bg-emerald-700 rounded-xl p-3 col-span-1">
          <p className="text-[9px] text-emerald-200 font-semibold uppercase tracking-wider">Ind. kombinierte Pt-Bewertung</p>
          <p className="text-sm font-mono font-bold text-white leading-tight">{fmtPt(grandTotal)}</p>
          <p className="text-[9px] text-emerald-300">Pt (indikativ)</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <p className="text-[9px] text-blue-700 font-semibold uppercase tracking-wider">Materialien</p>
          <p className="text-sm font-mono font-bold text-blue-900">{fmtPt(matsLife)}</p>
          <p className="text-[9px] text-blue-500">Pt{isPartial ? ` (Teilscore, ${coveredPct} %)` : ''}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <p className="text-[9px] text-emerald-700 font-semibold uppercase tracking-wider">Prozesse (IDEMAT)</p>
          <p className="text-sm font-mono font-bold text-emerald-900">{fmtPt(procsTotal)}</p>
          <p className="text-[9px] text-emerald-500">Pt (ind. EF 3.1)</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          <p className="text-[9px] text-gray-600 font-semibold uppercase tracking-wider">Modul D (sep.)</p>
          <p className="text-sm font-mono font-bold text-gray-800">{fmtPt(grandD)}</p>
          <p className="text-[9px] text-gray-400">Pt</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <p className="text-[9px] text-blue-700 font-semibold uppercase tracking-wider">Anteil Materialien</p>
          <p className="text-sm font-mono font-bold text-blue-900">{fmtPct(matShare)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <p className="text-[9px] text-emerald-700 font-semibold uppercase tracking-wider">Anteil Prozesse</p>
          <p className="text-sm font-mono font-bold text-emerald-900">{fmtPct(procShare)}</p>
        </div>
      </div>

      {/* Biogenic carbon info note */}
      {hasBiogenicWarn && (
        <div className="mb-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-900">
            <strong>Biogener Kohlenstoff:</strong>{' '}
            Der negative Klimawert in A1–A3 wird wesentlich durch die bilanzierte Aufnahme biogenen
            Kohlenstoffs verursacht. Er ist nicht mit dauerhaft vermiedenen fossilen Emissionen
            gleichzusetzen. Eine spätere Freisetzung kann in den End-of-Life-Modulen bilanziert
            werden; die Bewertung hängt daher vom betrachteten Lebenszyklus und den zugrunde
            liegenden Modellierungsregeln ab.
          </p>
        </div>
      )}

      {/* GWP Summary */}
      {(gwpTotal != null || hasProcGwp) && (
        <div className="mb-6 border border-orange-200 rounded-xl overflow-hidden">
          <div className="bg-orange-600 px-4 py-2.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white">GWP – Treibhausgaspotenzial (kg CO₂ eq.)</p>
              <p className="text-[10px] text-orange-100 mt-0.5">
                Materialien: direkt aus EPD-Indikatoren · Prozesse: aus EF 3.1 Klimawandel Pt rückgerechnet
                {hasProcGwp ? ` · GWP [kg CO₂ eq.] = climate_change [Pt] × ${GWP_NORM.toLocaleString('de-DE')} / ${GWP_WF}` : ''}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-orange-50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-orange-100 whitespace-nowrap">Pos.</th>
                  <th className="text-right px-2 py-2 font-semibold text-orange-700 border-b border-orange-100 whitespace-nowrap">A1–A3</th>
                  <th className="text-right px-2 py-2 font-semibold text-gray-600 border-b border-orange-100 whitespace-nowrap">B6</th>
                  <th className="text-right px-2 py-2 font-semibold text-gray-600 border-b border-orange-100 whitespace-nowrap">{eolLabel}</th>
                  <th className="text-right px-2 py-2 font-semibold text-gray-400 border-b border-orange-100 whitespace-nowrap">D</th>
                  <th className="text-right px-3 py-2 font-semibold text-orange-900 border-b border-orange-100 whitespace-nowrap bg-orange-100">Gesamt (deklariert)</th>
                  <th className="text-left px-2 py-2 font-semibold text-gray-400 border-b border-orange-100 whitespace-nowrap">Quelle</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-1.5 text-gray-800 font-medium max-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase ${
                          e.type === 'material' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>{e.type === 'material' ? 'Mat' : 'Proz'}</span>
                        <span className="truncate">{e.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-orange-700 font-medium">{fmtGWP(e.gwpA1A3)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{fmtGWP(e.gwpB6)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{fmtGWP(e.gwpEoL)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-cyan-700">{fmtGWP(e.gwpD)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-bold text-orange-900 bg-orange-50">{fmtGWP(e.gwpLife)}</td>
                    <td className="px-2 py-1.5 text-gray-400 text-[10px] whitespace-nowrap">
                      {e.type === 'material' ? 'EPD direkt' : 'Rückr. EF 3.1 ⁺ (ind.)'}
                    </td>
                  </tr>
                ))}
                {/* Subtotals */}
                {matEntries.length > 0 && (
                  <tr className="bg-blue-50 font-semibold border-t border-gray-200">
                    <td className="px-3 py-2 text-blue-700">Materialien (EPD)</td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-700">{fmtGWP(gwpMatA1A3)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-600">{fmtGWP(gwpMatB6)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-600">{fmtGWP(gwpMatEoL)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-cyan-600">{fmtGWP(gwpMatD)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-900 font-bold bg-blue-100">{fmtGWP(gwpMatLife)}</td>
                    <td className="px-2 py-2 text-gray-400 text-[10px]">EPD</td>
                  </tr>
                )}
                {procEntries.length > 0 && hasProcGwp && (
                  <tr className="bg-emerald-50 font-semibold border-t border-gray-200">
                    <td className="px-3 py-2 text-emerald-700">Prozesse (IDEMAT, ind. ⁺)</td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-700">{fmtGWP(gwpProcLife)}</td>
                    <td className="px-2 py-2 text-right text-emerald-300">—</td>
                    <td className="px-2 py-2 text-right text-emerald-300">—</td>
                    <td className="px-2 py-2 text-right text-emerald-300">—</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-900 font-bold bg-emerald-100">{fmtGWP(gwpProcLife)}</td>
                    <td className="px-2 py-2 text-gray-400 text-[10px]">EF 3.1 ⁺</td>
                  </tr>
                )}
                <tr className="bg-orange-700 font-bold text-white border-t-2 border-orange-500">
                  <td className="px-3 py-2">Gesamt (indikativ)</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtGWP((gwpMatA1A3 ?? 0) + (gwpProcLife ?? 0))}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtGWP(gwpMatB6)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtGWP(gwpMatEoL)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-orange-200">—</td>
                  <td className="px-3 py-2 text-right tabular-nums bg-orange-800">{fmtGWP(gwpTotal)}</td>
                  <td className="px-2 py-2 text-orange-200 text-[10px]">kg CO₂ eq.</td>
                </tr>
                {gwpGrandD != null && gwpGrandD !== 0 && (
                  <tr className="bg-gray-100 text-gray-600 border-t border-gray-200">
                    <td className="px-3 py-1.5">Modul D (Gutschriften, separat)</td>
                    <td className="px-2 py-1.5 text-right">—</td>
                    <td className="px-2 py-1.5 text-right">—</td>
                    <td className="px-2 py-1.5 text-right">—</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-cyan-700 font-semibold">{fmtGWP(gwpGrandD)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-cyan-700 font-semibold bg-cyan-50">{fmtGWP(gwpGrandD)}</td>
                    <td className="px-2 py-1.5 text-[10px]">sep.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {hasProcGwp && (
            <p className="px-4 py-2 text-[10px] text-gray-500 bg-orange-50 border-t border-orange-100">
              ⁺ GWP für Prozesse aus EF 3.1 Klimawandel (Pt) rückgerechnet:
              GWP [kg CO₂ eq.] = climate_change_Pt × {GWP_NORM.toLocaleString('de-DE')} / {GWP_WF} (EF 3.1 Normierungsfaktor / Gewichtungsfaktor, EC JRC 2021).
              Dieser Wert entspricht dem ursprünglichen IDEMAT-GWP-Midpoint und ist direkt mit EPD-GWP-Werten vergleichbar.
            </p>
          )}
        </div>
      )}

      {/* Weitere Umweltindikatoren — je Material & Prozess, physische Einheiten */}
      {indicatorRows.length > 0 && (
        <div className="mb-6 border border-cyan-200 rounded-xl overflow-hidden">
          <div className="bg-cyan-700 px-4 py-2.5">
            <p className="text-xs font-bold text-white">Weitere Umweltindikatoren – je Material &amp; Prozess</p>
            <p className="text-[10px] text-cyan-100 mt-0.5">
              Materialien: direkt aus EPD-Indikatoren · Prozesse: aus EF 3.1 Sub-Score (Pt) rückgerechnet, analog zu GWP oben ·
              Werte = deklariertes Gesamt (A1–A3 + B6 + EoL), bereits × Menge skaliert
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ tableLayout: 'fixed', width: `${190 + entries.length * 100}px`, minWidth: '100%' }}>
              <colgroup>
                <col style={{ width: '150px' }} />
                <col style={{ width: '90px' }} />
                {entries.map(e => <col key={e.id} style={{ width: '100px' }} />)}
                <col style={{ width: '100px' }} />
              </colgroup>
              <thead>
                <tr className="bg-cyan-50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-cyan-100">Indikator</th>
                  <th className="text-left px-2 py-2 font-semibold text-gray-500 border-b border-cyan-100">Einheit</th>
                  {entries.map(e => (
                    <th key={e.id} className="px-2 py-2 font-semibold text-gray-600 border-b border-cyan-100 align-bottom">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`inline-block text-[8px] px-1 py-0.5 rounded font-bold uppercase ${
                          e.type === 'material' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>{e.type === 'material' ? 'Mat' : 'Proz'}</span>
                        <span className="block w-full text-right truncate" title={e.name}>{e.name}</span>
                      </div>
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 font-semibold text-cyan-900 border-b border-cyan-100 bg-cyan-100">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {indicatorRows.map((row, i) => (
                  <tr key={row.key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-1.5 font-semibold text-gray-800 truncate" title={row.label}>{row.label}</td>
                    <td className="px-2 py-1.5 text-gray-400 truncate" title={row.unit}>{row.unit}</td>
                    {row.perEntry.map((v, j) => {
                      const intensity = row.rowMax > 0 && v != null ? Math.abs(v) / row.rowMax : 0;
                      return (
                        <td key={entries[j].id}
                          className={`px-2 py-1.5 text-right tabular-nums ${intensity > 0.6 ? 'font-bold text-red-900' : 'text-gray-700'}`}
                          style={{ backgroundColor: heatBg(intensity) }}>
                          {fmtIndVal(v)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-right tabular-nums font-bold text-cyan-800 bg-cyan-50">{fmtIndVal(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 pt-2 text-[10px] text-gray-400">
            Farbintensität = relativer Anteil am höchsten Wert je Zeile (Indikator) — zeigt, welches Material/welcher Prozess dort dominiert.
          </p>
          <p className="px-4 py-2 text-[10px] text-gray-500 bg-cyan-50 border-t border-cyan-100">
            ⁺ Prozess-Werte aus EF 3.1 Sub-Score rückgerechnet: physischer Wert = Pt × Normierungsfaktor / Gewichtungsfaktor (EC JRC 2021),
            analog zur GWP-Rückrechnung oben. „—" bedeutet: kein Wert für diesen Indikator deklariert bzw. verfügbar.
          </p>
        </div>
      )}

      {/* Chart */}
      <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="bg-gray-800 px-4 py-2.5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-white">Materialien & Prozesse nach Lebenszyklusphase</p>
            <p className="text-[10px] text-gray-300 mt-0.5">
              {selectedCat === 'total' ? 'Ind. EF 3.1 Pt (kombiniert)' : (EF31_ALL_CATS.find(c => c.key === selectedCat)?.label || selectedCat)}
              {' '} · Materialien = {isPartial ? `Teilscore (${coveredPct} % EF 3.1-Abdeckung)` : 'alle Kategorien'} · Prozesse = IDEMAT 2026 (ind.)
            </p>
          </div>
        </div>
        <div className="p-4">
          <StackedBarChart
            matA1A3={matsA1A3}
            matB6={matsB6}
            matEoL={matsEoL}
            matD={matsD}
            procPt={procsTotal}
          />
        </div>
      </div>

      {/* Combined table toggle */}
      <button
        type="button"
        onClick={() => setShowTable(v => !v)}
        className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 mb-3 flex items-center gap-1"
      >
        {showTable ? '▾' : '▸'} Detailtabelle – Materialien & Prozesse
      </button>

      {showTable && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap">Typ</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">Material / Prozess</th>
                  <th className="text-left px-2 py-2 font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Datengrundlage</th>
                  <th className="text-right px-2 py-2 font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Menge</th>
                  <th className="text-left px-2 py-2 font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Einheit</th>
                  <th className="text-right px-2 py-2 font-semibold text-blue-700 border-b border-gray-200 whitespace-nowrap">A1–A3</th>
                  <th className="text-right px-2 py-2 font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">B6</th>
                  <th className="text-right px-2 py-2 font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">{eolLabel}</th>
                  <th className="text-right px-2 py-2 font-semibold text-gray-400 border-b border-gray-200 whitespace-nowrap">D</th>
                  <th className="text-right px-2 py-2 font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">Modul-Summe</th>
                  <th className="text-right px-3 py-2 font-semibold text-emerald-800 border-b border-gray-200 whitespace-nowrap bg-emerald-50">Ind. EF 3.1 Pt</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap">Anteil</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const share = grandTotal !== 0 ? (e.lifePt / grandTotal) * 100 : null;
                  return (
                    <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {e.type === 'material' ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700">
                            Material
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700">
                            Prozess
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-gray-900 font-medium max-w-[160px]">
                        <div className="truncate">{e.name}</div>
                      </td>
                      <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap">{e.source}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-700">{e.qty}</td>
                      <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{e.unit}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-blue-700 font-medium">
                        {e.type === 'process' ? fmtPt(e.a1a3Pt) : fmtPt(e.a1a3Pt)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">
                        {e.type === 'process' ? '—' : fmtPt(e.b6Pt)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">
                        {e.type === 'process' ? '—' : fmtPt(e.eolPt)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-400">
                        {e.type === 'process' ? '—' : fmtPt(e.dPt)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-700 font-medium">
                        {fmtPt(e.lifePt)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-bold text-emerald-800 bg-emerald-50">
                        {fmtPt(e.lifePt)}
                        {isPartial && e.type === 'material' && (
                          <span className="text-[9px] text-amber-500 ml-0.5">*</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">
                        {fmtPct(share)}
                      </td>
                    </tr>
                  );
                })}

                {/* Subtotals */}
                {matEntries.length > 0 && (
                  <tr className="bg-blue-50 font-semibold border-t border-gray-200">
                    <td className="px-3 py-2 text-blue-700" colSpan={5}>Materialien gesamt</td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-700">{fmtPt(matsA1A3)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-600">{fmtPt(matsB6)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-600">{fmtPt(matsEoL)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-400">{fmtPt(matsD)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-700">{fmtPt(matsLife)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-800 bg-blue-100">{fmtPt(matsLife)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-600">{fmtPct(matShare)}</td>
                  </tr>
                )}
                {procEntries.length > 0 && (
                  <tr className="bg-emerald-50 font-semibold border-t border-gray-200">
                    <td className="px-3 py-2 text-emerald-700" colSpan={5}>Prozesse gesamt</td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-700">{fmtPt(procsTotal)}</td>
                    <td className="px-2 py-2 text-right text-emerald-300">—</td>
                    <td className="px-2 py-2 text-right text-emerald-300">—</td>
                    <td className="px-2 py-2 text-right text-emerald-300">—</td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-700">{fmtPt(procsTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-800 bg-emerald-100">{fmtPt(procsTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{fmtPct(procShare)}</td>
                  </tr>
                )}
                <tr className="bg-gray-800 font-bold text-white border-t-2 border-gray-600">
                  <td className="px-3 py-2" colSpan={5}>Indikative Gesamtbewertung</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtPt(matsA1A3 + procsTotal)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtPt(matsB6)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtPt(matsEoL)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-400">—</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtPt(grandTotal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums bg-emerald-700">{fmtPt(grandTotal)}</td>
                  <td className="px-3 py-2 text-right text-gray-300">100 %</td>
                </tr>
                {grandD !== 0 && (
                  <tr className="bg-gray-100 text-gray-600 border-t border-gray-200 text-xs">
                    <td className="px-3 py-1.5" colSpan={5}>Modul D (Gutschriften, separat)</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">—</td>
                    <td className="px-2 py-1.5 text-right">—</td>
                    <td className="px-2 py-1.5 text-right">—</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-cyan-700 font-semibold">{fmtPt(grandD)}</td>
                    <td className="px-2 py-1.5 text-right">—</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-cyan-700 font-semibold bg-cyan-50">{fmtPt(grandD)}</td>
                    <td className="px-3 py-1.5 text-right">sep.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {isPartial && (
            <p className="px-4 py-2 text-[10px] text-amber-600 bg-amber-50 border-t border-amber-100">
              * Material-Pt-Scores: Teilscore ({coveredPct} % der EF 3.1-Gewichtung, basierend auf tatsächlich deklarierten EN 15804+A2-Indikatoren).
              Fehlende Kategorien (Feinstaub, Human-/Ökotoxizität, Landnutzung, Ionisierende Strahlung) sind nicht enthalten und werden nicht durch null ersetzt.
              Prozesse (IDEMAT): indikativer EF 3.1-Score, 16 Kategorien als Datenfelder, kein Lebenszyklusmodul zugeordnet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
