import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { materialService } from '../../services/materialService';
import { projectService } from '../../services/projectService';
import { useCompareStore } from '../../store/compareStore';
import { ArrowLeft, Download, Minus } from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────

function val(v) {
  if (v === null || v === undefined || v === '') return null;
  return v;
}

function fmt(v, unit) {
  if (v === null || v === undefined || v === '') return '–';
  const n = parseFloat(v);
  if (Number.isNaN(n)) return String(v);
  return unit ? `${n.toFixed(3)} ${unit}` : String(n);
}

function bool(v) {
  if (v === true || v === 1) return '✓';
  if (v === false || v === 0) return '–';
  return '–';
}

// ─── sections definition ─────────────────────────────────────────────────────

const MAT_SECTIONS = [
  {
    title: 'Klimawirkung (GWP)',
    rows: [
      { label: 'GWP gesamt', key: 'gwp_total_value', unit: (m) => m.gwp_total_unit || 'kg CO₂e' },
      { label: 'GWP fossil', key: 'gwp_fossil', unit: () => 'kg CO₂e' },
      { label: 'GWP biogen', key: 'gwp_biogenic', unit: () => 'kg CO₂e' },
      { label: 'GWP LULUC', key: 'gwp_luluc', unit: () => 'kg CO₂e' },
      { label: 'GWP (einfach)', key: 'gwp_value', unit: (m) => m.gwp_unit || 'kg CO₂e' },
    ],
  },
  {
    title: 'Weitere Umweltindikatoren',
    rows: [
      { label: 'ADP fossil', key: 'adp_fossil', unit: () => 'MJ' },
      { label: 'ADP Elemente', key: 'adp_elements', unit: () => 'kg Sb-Äq.' },
      { label: 'Wasserverbrauch', key: 'water_consumption', unit: () => 'm³' },
    ],
  },
  {
    title: 'Technische Daten',
    rows: [
      { label: 'Rohdichte', key: 'tech_density', unit: () => '' },
      { label: 'Wärmedämmung', key: 'tech_thermal_insulation', unit: () => '' },
      { label: 'Schallschutz', key: 'tech_acoustics', unit: () => '' },
      { label: 'Brandschutz', key: 'tech_flammability', unit: () => '' },
      { label: 'Abmessungen', key: 'tech_dimensions', unit: () => '' },
      { label: 'Stärken', key: 'tech_thicknesses', unit: () => '' },
    ],
  },
  {
    title: 'Nachhaltigkeit & Kreislauf',
    rows: [
      { label: 'Recyclat-Anteil', key: 'recyclate_content', unit: () => '%', isPercent: true },
      { label: 'Kreislauffähigkeit', key: 'circularity', unit: () => '%', isPercent: true },
      { label: 'Wiederverwendbar', key: 'is_reusable', format: bool },
      { label: 'Übertragbar', key: 'is_transferable', format: bool },
      { label: 'Schenkbar', key: 'is_giftable', format: bool },
    ],
  },
  {
    title: 'Zertifizierungen',
    rows: [
      { label: 'EPD', key: 'cert_epd', format: bool },
      { label: 'Cradle to Cradle', key: 'cert_cradle_to_cradle', format: bool },
      { label: 'FSC / PEFC', key: 'cert_fsc_pefc', format: bool },
    ],
  },
];

const PROJ_SECTIONS = [
  {
    title: 'Klimawirkung',
    rows: [
      { label: 'GWP gesamt', key: 'total_gwp', unit: () => 'kg CO₂e' },
      { label: 'Materialanzahl', key: '_matCount', derive: (p) => (p.materials?.length || 0) + (p.oekobaudat_materials?.length || 0) },
    ],
  },
  {
    title: 'Allgemein',
    rows: [
      { label: 'Ort', key: 'location_name', unit: () => '' },
      { label: 'Gebäudetyp', key: 'building_type', unit: () => '' },
      { label: 'Nutzfläche', key: 'floor_area', unit: () => 'm²' },
    ],
  },
];

// ─── GWP bar chart ─────────────────────────────────────────────────────────

function GwpBar({ items, type }) {
  const gwpKey = type === 'materials' ? 'gwp_total_value' : 'total_gwp';
  const values = items.map((item) => ({
    name: item.name || item.project_name || item.id?.slice(0, 8),
    v: parseFloat(item[gwpKey]) || 0,
  }));
  const max = Math.max(...values.map((x) => x.v), 0.001);
  if (values.every((x) => x.v === 0)) return null;

  const sorted = [...values].sort((a, b) => a.v - b.v);
  const minVal = sorted[0]?.v;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">GWP Vergleich (kg CO₂e)</h3>
      <div className="space-y-3">
        {values.map((entry, i) => {
          const pct = (entry.v / max) * 100;
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

function CompareTable({ sections, items, type }) {
  function renderCell(item, row) {
    if (row.format) return row.format(item[row.key]);
    if (row.derive) return String(row.derive(item));
    const v = val(item[row.key]);
    if (v === null) return <span className="text-gray-300"><Minus className="w-3 h-3 inline" /></span>;
    const unit = row.unit ? row.unit(item) : '';
    if (row.isPercent) return fmt(parseFloat(v) * 100, '%');
    return fmt(v, unit);
  }

  // highlight best numeric value per row (lowest = best for GWP/impact)
  function isBestInRow(row, item, items) {
    if (row.format || row.derive || !row.key) return false;
    const nums = items.map((i) => parseFloat(i[row.key])).filter((n) => !Number.isNaN(n));
    if (nums.length < 2) return false;
    const best = Math.min(...nums);
    return parseFloat(item[row.key]) === best;
  }

  const colBase = 'border border-gray-100 px-3 py-2 text-sm';

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 mb-6">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-gray-50">
            <th className={`${colBase} font-semibold text-gray-600 w-44`}>Feld</th>
            {items.map((item, i) => (
              <th key={i} className={`${colBase} font-semibold text-gray-800 text-center`}>
                {item.name || item.project_name || item.id?.slice(0, 8)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <>
              <tr key={section.title} className="bg-gray-50">
                <td colSpan={items.length + 1} className="px-3 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide border border-gray-100">
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.key || row.label} className="even:bg-gray-50/40 hover:bg-blue-50/30 transition-colors">
                  <td className={`${colBase} text-gray-600`}>{row.label}</td>
                  {items.map((item, i) => {
                    const best = isBestInRow(row, item, items);
                    return (
                      <td
                        key={i}
                        className={`${colBase} text-center ${best ? 'text-green-700 font-semibold bg-green-50' : 'text-gray-700'}`}
                      >
                        {renderCell(item, row)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(items, sections, type) {
  const nameKey = type === 'materials' ? 'name' : 'project_name';
  const headers = ['Feld', ...items.map((i) => i[nameKey] || i.id)];
  const rows = [headers];

  for (const section of sections) {
    rows.push([section.title, ...items.map(() => '')]);
    for (const row of section.rows) {
      const cells = [row.label];
      for (const item of items) {
        if (row.format) cells.push(row.format(item[row.key]));
        else if (row.derive) cells.push(String(row.derive(item)));
        else cells.push(item[row.key] ?? '');
      }
      rows.push(cells);
    }
  }

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vergleich-${type}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setItems } = useCompareStore();

  const type = params.get('type') || 'materials';
  const ids = (params.get('ids') || '').split(',').filter(Boolean);

  const isMaterials = type === 'materials';
  const sections = isMaterials ? MAT_SECTIONS : PROJ_SECTIONS;

  const fetcher = isMaterials
    ? (id) => materialService.getById(id)
    : (id) => projectService.getById(id);

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: [type, id],
      queryFn: () => fetcher(id),
      enabled: !!id,
    })),
  });

  const loading = queries.some((q) => q.isLoading);
  const items = queries.map((q) => q.data).filter(Boolean);

  // sync names into compare store for bar chips — use stable key to avoid infinite loop
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
          <GwpBar items={items} type={type} />
          <CompareTable sections={sections} items={items} type={type} />
        </>
      )}
    </div>
  );
}
