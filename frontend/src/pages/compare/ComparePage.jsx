import React, { useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { materialService } from '../../services/materialService';
import { projectService } from '../../services/projectService';
import { useCompareStore } from '../../store/compareStore';
import { ArrowLeft, Download, Minus, Leaf } from 'lucide-react';

// ─── generic helpers ──────────────────────────────────────────────────────────

function safeJsonParse(v, fallback = []) {
  try { return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

function val(v) {
  if (v === null || v === undefined || v === '') return null;
  return v;
}

function fmt(v, unit) {
  if (v === null || v === undefined || v === '') return '–';
  const n = parseFloat(v);
  if (Number.isNaN(n)) return String(v);
  if (n === 0) return unit ? `0 ${unit}` : '0';
  if (Math.abs(n) < 0.0001) return `${n.toExponential(2)}${unit ? ' ' + unit : ''}`;
  if (Math.abs(n) >= 1000)  return `${n.toFixed(0)}${unit ? ' ' + unit : ''}`;
  if (Math.abs(n) >= 100)   return `${n.toFixed(1)}${unit ? ' ' + unit : ''}`;
  if (Math.abs(n) >= 1)     return `${n.toFixed(2)}${unit ? ' ' + unit : ''}`;
  return `${n.toPrecision(3)}${unit ? ' ' + unit : ''}`;
}

function bool(v) {
  if (v === true || v === 1) return '✓';
  if (v === false || v === 0) return '–';
  return '–';
}

// ─── EPD / LCA computation (mirrors ProjectDetail logic) ─────────────────────

function epdNormUnit(u) {
  if (!u) return '';
  let s = u.trim().replace(/^[\d.,]+\s*/, '').trim().toLowerCase();
  if (['metric ton','metric tons','tonne','tonnes','tonnen','metrische tonne'].includes(s)) s = 't';
  if (['m3','cubic meter','cubic metre','kubikmeter'].includes(s)) s = 'm³';
  if (['m2','square meter','square metre','quadratmeter'].includes(s)) s = 'm²';
  if (['kilogramm','kilogram','kilograms'].includes(s)) s = 'kg';
  if (['piece','pieces','stück','stk','pce','pcs','unit','units'].includes(s)) s = 'stk';
  return s;
}

function epdUnitConv(from, to) {
  function toKg(u) { return u==='kg'?1:u==='t'?1000:u==='g'?0.001:null; }
  const f = epdNormUnit(from), t = epdNormUnit(to);
  if (!f||!t||f===t) return 1;
  const fK=toKg(f), tK=toKg(t);
  return (fK!=null&&tK!=null&&tK!==0) ? fK/tK : 1;
}

function epdGetQty(epd) {
  return (Number(epd.quantity) || 1) * epdUnitConv(epd.unit, epd.declaredUnit);
}

function epdSumMods(mods, keys) {
  for (const k of keys) if (k in mods && mods[k] != null) return mods[k];
  let s = 0, found = false;
  for (const k of Object.keys(mods)) {
    if (keys.includes(k) && mods[k] != null) { s += mods[k]; found = true; }
  }
  return found ? s : null;
}

function epdComputeTotals(selected) {
  const totals = {};
  for (const epd of selected) {
    const qty = epdGetQty(epd);
    const uf  = Number(epd.uncertainty_factor) || 1;
    for (const [key, ind] of Object.entries(epd.indicators || {})) {
      if (!totals[key]) totals[key] = { unit: ind.unit, mods: {} };
      for (const [mod, v] of Object.entries(ind.mods || {})) {
        if (v != null) totals[key].mods[mod] = (totals[key].mods[mod] || 0) + qty * uf * v;
      }
    }
  }
  return totals;
}

function libMatToEpdEntry(m) {
  const f = m.gwp_fossil   != null ? Number(m.gwp_fossil)   : null;
  const b = m.gwp_biogenic != null ? Number(m.gwp_biogenic) : null;
  const l = m.gwp_luluc    != null ? Number(m.gwp_luluc)    : null;
  const hasFBL = f != null || b != null || l != null;
  const perUnit = hasFBL
    ? ((f||0)+(b||0)+(l||0))
    : (Number(m.effective_gwp_value ?? m.gwp_value) || 0);
  if (!perUnit && !hasFBL) return null;
  const indicators = {};
  if (perUnit !== 0) indicators['GWP-total']    = { mods: { 'A1-A3': perUnit }, unit: 'kg CO₂e' };
  if (f != null)     indicators['GWP-fossil']   = { mods: { 'A1-A3': f }, unit: 'kg CO₂e' };
  if (b != null)     indicators['GWP-biogenic'] = { mods: { 'A1-A3': b }, unit: 'kg CO₂e' };
  if (l != null)     indicators['GWP-luluc']    = { mods: { 'A1-A3': l }, unit: 'kg CO₂e' };
  const n = (field) => m[field] != null ? Number(m[field]) : null;
  const addInd = (k, field, unit) => { const v = n(field); if (v != null) indicators[k] = { mods: { 'A1-A3': v }, unit }; };
  addInd('ADP-fossil',     'adp_fossil',        'MJ');
  addInd('ADP-elements',   'adp_elements',      'kg Sb eq.');
  addInd('WDP',            'water_consumption', 'm³');
  addInd('ODP',            'odp',               'kg CFC-11 eq.');
  addInd('AP',             'ap',                'mol H⁺ eq.');
  addInd('EP-terrestrial', 'ep_terrestrial',    'mol N eq.');
  addInd('EP-freshwater',  'ep_freshwater',     'kg P eq.');
  addInd('EP-marine',      'ep_marine',         'kg N eq.');
  addInd('POCP',           'pocp',              'kg NMVOC eq.');
  addInd('HWD',            'hwd',               'kg');
  addInd('NHWD',           'nhwd',              'kg');
  addInd('PERE',           'pere',              'MJ');
  addInd('PENRE',          'penre',             'MJ');
  const gwpDenominator = m.gwp_unit?.split('/')?.[1]?.trim() || null;
  // gwpDenominator (Einheit aus dem Bruch, z.B. 'unit', 'kg', 't') hat Vorrang vor
  // declared_unit, damit epdUnitConv für 'unit'-Mengen korrekt 1:1 multipliziert.
  const declaredUnit   = gwpDenominator || m.declared_unit || 'kg';
  return {
    uuid: `lib-${m.material_id || m.id}`,
    name: m.material_name || m.name || 'Material',
    category: m.category || '',
    declaredUnit,
    quantity: Number(m.quantity) || 1,
    unit: m.unit || declaredUnit,
    gwpA1A3: perUnit !== 0 ? perUnit : null,
    indicators,
    isLibraryMaterial: true,
  };
}

function projectLcaTotals(project) {
  const oekodatMats  = safeJsonParse(project.oekodat_materials, []);
  const libMatsWithGwp = (project.materials || []).filter(
    m => m.has_gwp_data || m.gwp_value != null || m.gwp_fossil != null
  );
  const libAsEpd = libMatsWithGwp.map(libMatToEpdEntry).filter(Boolean);
  return epdComputeTotals([...libAsEpd, ...oekodatMats]);
}

function getA1A3(totals, indicator) {
  return epdSumMods(totals?.[indicator]?.mods || {}, ['A1-A3','A1','A2','A3']);
}

// ─── sections definition ─────────────────────────────────────────────────────

const MAT_SECTIONS = [
  {
    title: 'Klimawirkung (GWP)',
    rows: [
      { label: 'GWP gesamt',  key: 'gwp_total_value', unit: (m) => m.gwp_total_unit || 'kg CO₂e' },
      { label: 'GWP fossil',  key: 'gwp_fossil',       unit: () => 'kg CO₂e' },
      { label: 'GWP biogen',  key: 'gwp_biogenic',     unit: () => 'kg CO₂e' },
      { label: 'GWP LULUC',   key: 'gwp_luluc',        unit: () => 'kg CO₂e' },
      { label: 'GWP (einfach)',key: 'gwp_value',        unit: (m) => m.gwp_unit || 'kg CO₂e' },
    ],
  },
  {
    title: 'Weitere Umweltindikatoren',
    rows: [
      { label: 'ADP fossil',      key: 'adp_fossil',        unit: () => 'MJ' },
      { label: 'ADP Elemente',    key: 'adp_elements',      unit: () => 'kg Sb-Äq.' },
      { label: 'Wasserverbrauch', key: 'water_consumption', unit: () => 'm³' },
    ],
  },
  {
    title: 'Technische Daten',
    rows: [
      { label: 'Rohdichte',    key: 'tech_density',            unit: () => '' },
      { label: 'Wärmedämmung', key: 'tech_thermal_insulation', unit: () => '' },
      { label: 'Schallschutz', key: 'tech_acoustics',          unit: () => '' },
      { label: 'Brandschutz',  key: 'tech_flammability',       unit: () => '' },
      { label: 'Abmessungen',  key: 'tech_dimensions',         unit: () => '' },
      { label: 'Stärken',      key: 'tech_thicknesses',        unit: () => '' },
    ],
  },
  {
    title: 'Nachhaltigkeit & Kreislauf',
    rows: [
      { label: 'Recyclat-Anteil', key: 'recyclate_content', unit: () => '%', isPercent: true },
      { label: 'Kreislauffähigkeit', key: 'circularity',    unit: () => '%', isPercent: true },
      { label: 'Wiederverwendbar', key: 'is_reusable',      format: bool },
      { label: 'Übertragbar',     key: 'is_transferable',   format: bool },
      { label: 'Schenkbar',       key: 'is_giftable',       format: bool },
    ],
  },
  {
    title: 'Zertifizierungen',
    rows: [
      { label: 'EPD',             key: 'cert_epd',            format: bool },
      { label: 'Cradle to Cradle',key: 'cert_cradle_to_cradle',format: bool },
      { label: 'FSC / PEFC',      key: 'cert_fsc_pefc',       format: bool },
    ],
  },
];

// builds PROJ_SECTIONS dynamically so derive functions can reference helpers
function buildProjSections() {
  const lca = (label, indicator, unit) => ({
    label,
    unit: () => unit,
    derive: (p) => getA1A3(p._lca, indicator),
  });
  return [
    {
      title: 'Klimawirkung — A1–A3 Herstellung',
      rows: [
        lca('GWP gesamt',             'GWP-total',      'kg CO₂e'),
        lca('GWP fossil',             'GWP-fossil',     'kg CO₂e'),
        lca('GWP biogen',             'GWP-biogenic',   'kg CO₂e'),
        lca('GWP LULUC',              'GWP-luluc',      'kg CO₂e'),
      ],
    },
    {
      title: 'Weitere Umweltindikatoren — A1–A3',
      rows: [
        lca('Ozonabbau (ODP)',          'ODP',            'kg CFC-11 eq.'),
        lca('Versauerung (AP)',         'AP',             'mol H⁺ eq.'),
        lca('Eutrophierung terrestr.', 'EP-terrestrial', 'mol N eq.'),
        lca('Eutrophierung Süßwasser', 'EP-freshwater',  'kg P eq.'),
        lca('Eutrophierung Meer',      'EP-marine',      'kg N eq.'),
        lca('Sommersmog (POCP)',        'POCP',           'kg NMVOC eq.'),
        lca('ADP fossil',              'ADP-fossil',     'MJ'),
        lca('ADP Elemente',            'ADP-elements',   'kg Sb eq.'),
        lca('Wassernutzung (WDP)',      'WDP',            'm³'),
        lca('Primärenergie ern. (PERE)','PERE',          'MJ'),
        lca('Primärenergie n.-ern. (PENRE)','PENRE',     'MJ'),
        lca('Gefährl. Abfall (HWD)',   'HWD',            'kg'),
        lca('Nicht-gef. Abfall (NHWD)','NHWD',           'kg'),
      ],
    },
    {
      title: 'Materialien',
      rows: [
        {
          label: 'Bibliotheks-Materialien',
          unit: () => '',
          derive: (p) => p.materials?.length || 0,
        },
        {
          label: 'Ökobaudat-EPDs',
          unit: () => '',
          derive: (p) => safeJsonParse(p.oekodat_materials, []).length,
        },
      ],
    },
    {
      title: 'Allgemein',
      rows: [
        { label: 'Ort',        key: 'location_name', unit: () => '' },
        { label: 'Status',     key: 'status',        unit: () => '' },
        { label: 'Nutzfläche', key: 'floor_area',    unit: () => 'm²' },
      ],
    },
  ];
}

// ─── GWP summary cards ────────────────────────────────────────────────────────

function ProjGwpSummary({ items }) {
  const vals = items.map(p => ({
    name: p.name || p.id?.slice(0, 8),
    gwp:  getA1A3(p._lca, 'GWP-total'),
  })).filter(x => x.gwp != null);

  if (!vals.length) return null;

  const absMax = Math.max(...vals.map(x => Math.abs(x.gwp)), 0.001);
  const minGwp = Math.min(...vals.map(x => x.gwp));

  const COLORS = ['#2563eb','#7c3aed','#d97706','#e11d48','#0891b2','#65a30d'];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Leaf className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-gray-700">GWP gesamt A1–A3 (kg CO₂e)</h3>
      </div>
      <div className="space-y-3">
        {vals.map((entry, i) => {
          const isBest = entry.gwp === minGwp;
          const pct = (Math.abs(entry.gwp) / absMax) * 100;
          const neg = entry.gwp < 0;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-36 truncate shrink-0 font-medium">{entry.name}</span>
              <div className="flex-1 flex items-center gap-1 min-w-0">
                {neg ? (
                  <div className="flex-1 flex justify-end">
                    <div
                      className="h-4 rounded-full bg-emerald-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                ) : (
                  <div className="flex-1">
                    <div
                      className="h-4 rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                )}
              </div>
              <span className={`text-xs font-mono font-semibold w-28 text-right shrink-0 ${isBest ? 'text-emerald-700' : neg ? 'text-emerald-600' : 'text-gray-700'}`}>
                {fmt(entry.gwp, 'kg CO₂e')}
                {isBest && <span className="ml-1">↓</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GwpBar({ items, type }) {
  const gwpKey = type === 'materials' ? 'gwp_total_value' : null;
  const values = items.map((item) => ({
    name: item.name || item.project_name || item.id?.slice(0, 8),
    v: type === 'materials'
      ? (parseFloat(item[gwpKey]) || 0)
      : (getA1A3(item._lca, 'GWP-total') ?? 0),
  }));
  const max = Math.max(...values.map((x) => Math.abs(x.v)), 0.001);
  if (values.every((x) => x.v === 0)) return null;
  if (type === 'projects') return null; // handled by ProjGwpSummary

  const sorted = [...values].sort((a, b) => a.v - b.v);
  const minVal = sorted[0]?.v;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">GWP Vergleich (kg CO₂e)</h3>
      <div className="space-y-3">
        {values.map((entry, i) => {
          const pct = (Math.abs(entry.v) / max) * 100;
          const isBest = entry.v === minVal;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-28 truncate shrink-0">{entry.name}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all ${isBest ? 'bg-green-500' : 'bg-blue-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-xs font-medium w-20 text-right ${isBest ? 'text-green-700' : 'text-gray-600'}`}>
                {entry.v.toFixed(3)}
                {isBest && <span className="ml-1 text-green-600">↓</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── comparison table ────────────────────────────────────────────────────────

function CompareTable({ sections, items }) {
  function renderCell(item, row) {
    if (row.format) return row.format(item[row.key]);
    if (row.derive) {
      const v = row.derive(item);
      if (v === null || v === undefined) return <span className="text-gray-300"><Minus className="w-3 h-3 inline" /></span>;
      const unit = row.unit ? row.unit(item) : '';
      if (typeof v === 'number') return fmt(v, unit);
      return String(v);
    }
    const v = val(item[row.key]);
    if (v === null) return <span className="text-gray-300"><Minus className="w-3 h-3 inline" /></span>;
    const unit = row.unit ? row.unit(item) : '';
    if (row.isPercent) return fmt(parseFloat(v) * 100, '%');
    return fmt(v, unit);
  }

  function getNum(row, item) {
    if (row.derive) {
      const v = row.derive(item);
      return (v != null && !Number.isNaN(Number(v))) ? Number(v) : NaN;
    }
    return parseFloat(item[row.key]);
  }

  function isBestInRow(row, item) {
    if (row.format) return false;
    const nums = items.map(i => getNum(row, i)).filter(n => !Number.isNaN(n));
    if (nums.length < 2) return false;
    const best = Math.min(...nums);
    return getNum(row, item) === best;
  }

  // only render rows where at least one item has a value
  function hasAnyValue(row) {
    return items.some(item => {
      if (row.derive) { const v = row.derive(item); return v != null; }
      return item[row.key] != null && item[row.key] !== '';
    });
  }

  const colBase = 'border border-gray-100 px-3 py-2 text-sm';

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 mb-6">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-gray-50">
            <th className={`${colBase} font-semibold text-gray-600 w-52`}>Indikator</th>
            {items.map((item, i) => (
              <th key={i} className={`${colBase} font-semibold text-gray-800 text-center`}>
                {item.name || item.id?.slice(0, 8)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => {
            const visibleRows = section.rows.filter(hasAnyValue);
            if (!visibleRows.length) return null;
            return (
              <React.Fragment key={section.title}>
                <tr className="bg-emerald-50">
                  <td colSpan={items.length + 1} className="px-3 py-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wide border border-gray-100">
                    {section.title}
                  </td>
                </tr>
                {visibleRows.map((row) => (
                  <tr key={row.key || row.label} className="even:bg-gray-50/40 hover:bg-blue-50/30 transition-colors">
                    <td className={`${colBase} text-gray-600`}>{row.label}</td>
                    {items.map((item, i) => {
                      const best = isBestInRow(row, item);
                      return (
                        <td
                          key={i}
                          className={`${colBase} text-center tabular-nums ${best ? 'text-green-700 font-semibold bg-green-50' : 'text-gray-700'}`}
                        >
                          {renderCell(item, row)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(items, sections, type) {
  const nameKey = type === 'materials' ? 'name' : 'name';
  const headers = ['Indikator', ...items.map((i) => i[nameKey] || i.id)];
  const rows = [headers];

  for (const section of sections) {
    rows.push([section.title, ...items.map(() => '')]);
    for (const row of section.rows) {
      const cells = [row.label];
      for (const item of items) {
        if (row.format) cells.push(row.format(item[row.key]));
        else if (row.derive) {
          const v = row.derive(item);
          cells.push(v != null ? String(v) : '');
        } else cells.push(item[row.key] ?? '');
      }
      rows.push(cells);
    }
  }

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `vergleich-${type}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const { setItems } = useCompareStore();

  const type = params.get('type') || 'materials';
  const ids  = (params.get('ids') || '').split(',').filter(Boolean);

  const isMaterials = type === 'materials';
  const sections    = isMaterials ? MAT_SECTIONS : buildProjSections();

  const fetcher = isMaterials
    ? (id) => materialService.getById(id)
    : (id) => projectService.getById(id);

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: [type, id],
      queryFn:  () => fetcher(id),
      enabled:  !!id,
    })),
  });

  const loading  = queries.some((q) => q.isLoading);
  const rawItems = queries.map((q) => q.data).filter(Boolean);

  // augment project items with precomputed LCA totals
  const items = useMemo(
    () => isMaterials
      ? rawItems
      : rawItems.map(p => ({ ...p, _lca: projectLcaTotals(p) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawItems.map(p => p?.id).join(','), isMaterials]
  );

  const dataKey = queries.map((q) => q.data?.id || '').join(',');
  useEffect(() => {
    const loaded = queries.map((q) => q.data).filter(Boolean);
    if (loaded.length) setItems(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, setItems]);

  if (!ids.length) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center text-gray-500">
        Keine Elemente zum Vergleichen ausgewählt.
      </div>
    );
  }

  const typeLabel = isMaterials ? 'Materialien' : 'Projekte';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{typeLabel} vergleichen</h1>
            <p className="text-sm text-gray-500">{ids.length} Element{ids.length !== 1 ? 'e' : ''} ausgewählt</p>
          </div>
        </div>
        {!loading && items.length >= 2 && (
          <button
            type="button"
            onClick={() => exportCsv(items, sections, type)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV Export
          </button>
        )}
      </div>

      {loading && (
        <div className="text-center py-16 text-gray-400">Lade Daten…</div>
      )}

      {!loading && items.length < 2 && (
        <div className="text-center py-16 text-gray-400">
          Mindestens 2 Elemente werden für den Vergleich benötigt.
        </div>
      )}

      {!loading && items.length >= 2 && (
        <>
          {isMaterials
            ? <GwpBar items={items} type={type} />
            : <ProjGwpSummary items={items} />
          }
          <CompareTable sections={sections} items={items} />
        </>
      )}
    </div>
  );
}
