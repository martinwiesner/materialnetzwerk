import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { materialService } from '../../services/materialService';
import { projectService } from '../../services/projectService';
import { useCompareStore } from '../../store/compareStore';
import { useT } from '../../i18n/useT';
import OekobaudatPicker from '../../components/projects/OekobaudatPicker';
import {
  buildProjectLca, indicatorModules, libMatToEpdEntry, libraryMaterialRow, libDeclaredUnit,
  quantityFactor, conversionGap, CONV_LABELS, SKIP_REASONS, parseDensity, parseUnit, normLabel,
} from '../../utils/projectLca';
import { ArrowLeft, Download, Leaf, Database, Plus, X, AlertTriangle, Search } from 'lucide-react';

// ─── generic helpers ──────────────────────────────────────────────────────────

function fmt(v) {
  if (v === null || v === undefined || v === '') return '–';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  if (n === 0) return '0';
  if (Math.abs(n) < 0.0001) return n.toExponential(2);
  if (Math.abs(n) >= 1000)  return n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 100)   return n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  if (Math.abs(n) >= 1)     return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  return n.toPrecision(3).replace('.', ',');
}

function bool(v) {
  if (v === true || v === 1) return '✓';
  return null;
}

function num(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// "kg CO2e/unit" → "kg CO₂e"; the reference unit is shown separately
function prettyUnit(u) {
  return String(u || '').replace(/CO2/g, 'CO₂');
}

const MODULES = [
  { key: 'a1a3',  label: 'A1–A3' },
  { key: 'eol',   label: 'C3+C4' },
  { key: 'd',     label: 'D' },
  { key: 'total', label: 'Gesamt (A–C)' },
];

const GWP_SPLIT = [
  ['GWP-fossil',   'GWP fossil'],
  ['GWP-biogenic', 'GWP biogen'],
  ['GWP-luluc',    'GWP LULUC'],
];

const OTHER_INDICATORS = [
  ['ODP',            'Ozonabbau (ODP)',               'kg CFC-11 eq.'],
  ['AP',             'Versauerung (AP)',              'mol H⁺ eq.'],
  ['EP-terrestrial', 'Eutrophierung terrestr.',       'mol N eq.'],
  ['EP-freshwater',  'Eutrophierung Süßwasser',       'kg P eq.'],
  ['EP-marine',      'Eutrophierung Meer',            'kg N eq.'],
  ['POCP',           'Sommersmog (POCP)',             'kg NMVOC eq.'],
  ['ADP-fossil',     'ADP fossil',                    'MJ'],
  ['ADP-elements',   'ADP Elemente',                  'kg Sb eq.'],
  ['WDP',            'Wassernutzung (WDP)',           'm³'],
  ['PERE',           'Primärenergie ern. (PERE)',     'MJ'],
  ['PENRE',          'Primärenergie n.-ern. (PENRE)', 'MJ'],
  ['HWD',            'Gefährl. Abfall (HWD)',         'kg'],
  ['NHWD',           'Nicht-gef. Abfall (NHWD)',      'kg'],
];

const TARGET_UNITS = [
  { key: 'declared', label: 'deklariert' },
  { key: 'kg',       label: 'kg' },
  { key: 'm³',       label: 'm³' },
  { key: 'm²',       label: 'm²' },
  { key: 'stk',      label: 'Stück' },
];

const DATASET_TYPE_DE = {
  'generic dataset': 'generisch', 'specific dataset': 'herstellerspezifisch',
  'average dataset': 'Durchschnitt', 'representative dataset': 'repräsentativ', 'template dataset': 'Vorlage',
};

const KIND_BADGE = {
  library: { label: 'Bibliothek',        cls: 'bg-blue-100 text-blue-700',       icon: true },
  epd:     { label: 'EPD',               cls: 'bg-emerald-100 text-emerald-700' },
  project: { label: 'Projekt',           cls: 'bg-gray-100 text-gray-600' },
  adhoc:   { label: 'Ad-hoc-Variante',   cls: 'bg-amber-100 text-amber-700' },
};

const empty = (note) => ({ v: null, note });

// Groups (A1–A3, C3+C4, D) for which GWP-total has values
function declaredGroups(indicators) {
  const m = indicatorModules(indicators, 'GWP-total');
  if (!m) return [];
  return [['A1–A3', m.a1a3], ['C3+C4', m.eol], ['D', m.d]].filter(([, v]) => v != null).map(([l]) => l);
}

// ─── column builders ─────────────────────────────────────────────────────────

function projectColumn(p) {
  return { id: p.id, name: p.name, kind: 'project', raw: p, lca: buildProjectLca(p) };
}

function adhocColumn(v) {
  const project = {
    id: v.id,
    name: v.name,
    materials: [libraryMaterialRow(v.material, v.quantity, v.unit)],
    oekodat_materials: '[]',
  };
  return { id: v.id, name: v.name, kind: 'adhoc', raw: project, lca: buildProjectLca(project), adhoc: v };
}

// EPD names often carry the density, e.g. "Acetylated wood (1 m³, 510 kg/m³)"
function densityFromName(name) {
  const m = String(name || '').match(/([\d.,]+)\s*kg\s*\/\s*m(³|3)/i);
  return m ? parseDensity(`${m[1]} kg/m³`) : null;
}
function arealFromName(name) {
  const m = String(name || '').match(/([\d.,]+)\s*kg\s*\/\s*m(²|2)/i);
  return m ? num(m[1]) : null;
}

function libraryColumn(m) {
  const entry = libMatToEpdEntry(libraryMaterialRow(m));
  return {
    id: m.id, name: m.name, kind: 'library', raw: m,
    indicators: entry.indicators,
    declaredUnit: libDeclaredUnit(m),
    conv: { density: parseDensity(m.tech_density), areal: null, piece: null },
    source: m.gwp_source || 'RZZ-Bibliothek',
    norm: normLabel(`${m.gwp_source || ''} ${m.lifecycle_scope || ''}`),
  };
}

function epdColumn(e) {
  return {
    id: e.uuid, name: e.name, kind: 'epd', raw: e,
    indicators: e.indicators || {},
    declaredUnit: e.declaredUnit || '',
    conv: { density: e.density ?? densityFromName(e.name), areal: arealFromName(e.name), piece: null },
    source: `ÖKOBAUDAT${e.datasetLabel ? ' ' + e.datasetLabel : ''}${e.datasetType ? ' · ' + (DATASET_TYPE_DE[e.datasetType] || e.datasetType) : ''}`,
    norm: normLabel(e.norm) || (e.norm || null),
  };
}

// ─── row definitions ─────────────────────────────────────────────────────────

function buildProjectRows({ t, module, fu }) {
  const per = fu.on ? ` je ${fu.unit || 'FE'}` : '';
  const divisor = (col) => (fu.on ? num(fu.qty[col.id]) : 1);

  const lcaCell = (key, mod) => (col) => {
    if (!col.lca.entries.length) return empty('keine Umweltdaten');
    const m = indicatorModules(col.lca.totals, key);
    const v = m?.[mod];
    if (v == null) return empty('nicht deklariert');
    const d = divisor(col);
    if (!d) return empty('Bezugsmenge fehlt');
    return { v: v / d };
  };

  const rows = [];
  if (fu.on) {
    rows.push({
      section: `Normierung auf funktionale Einheit`,
      rows: [{
        label: `Bezugsmenge (${fu.unit || 'FE'})`,
        input: { get: (col) => fu.qty[col.id] ?? '', set: (col, v) => fu.setQty(col.id, v), placeholder: 'z. B. 12' },
        get: (col) => ({ v: num(fu.qty[col.id]) }),
      }],
    });
  }
  rows.push({
    section: 'Datenabdeckung',
    rows: [
      {
        label: 'Materialien mit Umweltkennwerten',
        get: (col) => ({
          v: `${col.lca.entries.length} von ${col.lca.materialCount}`,
          warn: col.lca.entries.length < col.lca.materialCount,
          sub: col.lca.skipped.length
            ? 'Ausgelassen: ' + col.lca.skipped.map(s => `${s.name} (${SKIP_REASONS[s.reason]})`).join(', ')
            : null,
        }),
      },
      { label: 'Bibliotheks-Materialien', get: (col) => ({ v: String(col.lca.libCount) }) },
      { label: 'Ökobaudat-EPDs',          get: (col) => ({ v: String(col.lca.epdCount) }) },
    ],
  });
  rows.push({
    section: `Klimawirkung GWP — kg CO₂e${per}`,
    rows: [
      ...MODULES.map(({ key, label }) => ({
        label: `GWP ${label}`, lowerBetter: true, strong: key === 'total', get: lcaCell('GWP-total', key),
      })),
      ...GWP_SPLIT.map(([key, label]) => ({ label: `${label} A1–A3`, lowerBetter: true, get: lcaCell(key, 'a1a3') })),
    ],
  });
  const modLabel = MODULES.find(m => m.key === module)?.label;
  rows.push({
    section: `Weitere Umweltindikatoren — ${modLabel}${per}`,
    rows: OTHER_INDICATORS.map(([key, label, unit]) => ({
      label, unit, lowerBetter: true, hideEmpty: true, get: lcaCell(key, module),
    })),
  });
  rows.push({
    section: 'Allgemein',
    rows: [
      { label: 'Art',    get: (col) => ({ v: col.kind === 'adhoc' ? `Ad-hoc: ${col.adhoc.quantity} ${col.adhoc.unit} ${col.adhoc.material.name}` : 'Projekt' }) },
      { label: 'Ort',    hideEmpty: true, get: (col) => ({ v: col.raw.location_name || null }) },
      { label: 'Status', hideEmpty: true, get: (col) => ({ v: col.raw.status ? t(`projectDetail.status.${col.raw.status}`) : null }) },
    ],
  });
  return rows;
}

function buildMaterialRows({ module, target, conv, convInput, columns }) {
  const targetLabel = TARGET_UNITS.find(u => u.key === target)?.label;
  const per = target === 'declared' ? ' je deklarierter Einheit' : ` je ${targetLabel}`;

  // factor: indicator value per declared unit → per target unit
  const factor = (col) => {
    if (target === 'declared') return { f: 1 };
    const c = conv(col);
    const f = quantityFactor(`1 ${target}`, col.declaredUnit, c);
    return f == null ? { gap: CONV_LABELS[conversionGap(target, col.declaredUnit, c)] } : { f };
  };

  const lcaCell = (key, mod) => (col) => {
    const m = indicatorModules(col.indicators, key);
    const v = m?.[mod];
    if (v == null) return empty(m ? 'nicht deklariert' : 'keine Daten');
    const { f, gap } = factor(col);
    if (f == null) return { v: null, note: gap, muted: v, mutedUnit: col.declaredUnit };
    return { v: v * f };
  };

  const libOnly = (fn) => (col) => (col.kind === 'library' ? fn(col.raw) : empty('nur Bibliothek'));
  const text = (key) => libOnly((m) => ({ v: m[key] || null }));

  // show a conversion row when the chosen unit or a declared unit needs it, or data exists
  const UNIT_PARAM = { 'm³': 'density', 'm²': 'areal', stk: 'piece' };
  const needs = (param) => UNIT_PARAM[target] === param || columns.some(c =>
    conv(c)[param] != null || UNIT_PARAM[parseUnit(c.declaredUnit).unit] === param);
  const convRow = (param, label, unit) => ({
    label: `${label} (${unit})`, hidden: !needs(param),
    input: {
      get: (col) => convInput(col)[param] ?? '',
      set: (col, v) => conv.set(col.id, param, v),
      placeholder: 'fehlt',
    },
    get: (col) => ({ v: conv(col)[param] }),
  });

  return [
    {
      section: 'Datenbasis',
      rows: [
        { label: 'Datenquelle', get: (col) => ({ v: col.source }) },
        { label: 'Normbezug',   get: (col) => (col.norm ? { v: col.norm } : empty('nicht angegeben')) },
        { label: 'Deklarierte Einheit', get: (col) => ({ v: col.declaredUnit || null }) },
        { label: 'Deklarierte Module (GWP)', get: (col) => {
          const g = declaredGroups(col.indicators);
          return g.length ? { v: g.join(', ') } : empty('keine');
        } },
        convRow('density', 'Rohdichte',       'kg/m³'),
        convRow('areal',   'Flächengewicht',  'kg/m²'),
        convRow('piece',   'Stückgewicht',    'kg/Stk'),
      ],
    },
    {
      section: `Klimawirkung GWP — kg CO₂e${per}`,
      rows: [
        ...MODULES.map(({ key, label }) => ({
          label: `GWP ${label}`, lowerBetter: true, strong: key === 'total', get: lcaCell('GWP-total', key),
        })),
        ...GWP_SPLIT.map(([key, label]) => ({ label: `${label} A1–A3`, lowerBetter: true, hideEmpty: true, get: lcaCell(key, 'a1a3') })),
      ],
    },
    {
      section: `Weitere Umweltindikatoren — ${MODULES.find(m => m.key === module)?.label}${per}`,
      rows: OTHER_INDICATORS.map(([key, label, unit]) => ({
        label, unit, lowerBetter: true, hideEmpty: true, get: lcaCell(key, module),
      })),
    },
    {
      section: 'Technische Daten',
      rows: [
        ['Wärmedämmung', 'tech_thermal_insulation'],
        ['Schallschutz', 'tech_acoustics'],
        ['Brandschutz',  'tech_flammability'],
        ['Abmessungen',  'tech_dimensions'],
        ['Stärken',      'tech_thicknesses'],
      ].map(([label, key]) => ({ label, hideEmpty: true, get: text(key) })),
    },
    {
      section: 'Nachhaltigkeit & Kreislauf',
      rows: [
        { label: 'Recyclat-Anteil', unit: '%', hideEmpty: true, get: libOnly((m) => ({ v: m.recyclate_content != null && m.recyclate_content !== '' ? Number(m.recyclate_content) : null })) },
        { label: 'Kreislauffähigkeit', hideEmpty: true, get: text('circularity') },
        { label: 'Wiederverwendbar', hideEmpty: true, get: libOnly((m) => ({ v: bool(m.is_reusable) })) },
        { label: 'Übertragbar',      hideEmpty: true, get: libOnly((m) => ({ v: bool(m.is_transferable) })) },
        { label: 'Schenkbar',        hideEmpty: true, get: libOnly((m) => ({ v: bool(m.is_giftable) })) },
      ],
    },
    {
      section: 'Zertifizierungen',
      rows: [
        ['EPD', 'cert_epd'], ['Cradle to Cradle', 'cert_cradle_to_cradle'], ['FSC / PEFC', 'cert_fsc_pefc'],
      ].map(([label, key]) => ({ label, hideEmpty: true, get: libOnly((m) => ({ v: bool(m[key]) })) })),
    },
  ];
}

// ─── consistency hints ───────────────────────────────────────────────────────

function materialHints(columns, target, rowsGwp) {
  const hints = [];
  const norms = new Set(columns.map(c => c.norm || 'ohne Angabe'));
  if (norms.size > 1) {
    hints.push(`Unterschiedlicher Normbezug (${[...norms].join(' / ')}): Werte nach EN 15804+A1 und +A2 sind nur eingeschränkt vergleichbar (u. a. abweichende GWP-Definition).`);
  }
  const groups = columns.map(c => declaredGroups(c.indicators).join(', ') || 'keine');
  if (new Set(groups).size > 1) {
    hints.push(`Deklarierte Module unterscheiden sich (${columns.map((c, i) => `${c.name}: ${groups[i]}`).join(' · ')}). „Gesamt“ ist nur bei gleichen Modulen vergleichbar.`);
  }
  if (target === 'declared') {
    const units = new Set(columns.map(c => c.declaredUnit || '?'));
    if (units.size > 1) hints.push(`Unterschiedliche deklarierte Einheiten (${[...units].join(', ')}) – für einen Vergleich oben eine gemeinsame Bezugseinheit wählen.`);
  } else {
    const gaps = columns.map(c => ({ c, cell: rowsGwp(c) })).filter(x => x.cell.note && x.cell.muted != null);
    if (gaps.length) hints.push(`Keine Umrechnung möglich für: ${gaps.map(x => `${x.c.name} (${x.cell.note})`).join(', ')}. Fehlende Werte können unter „Datenbasis“ ergänzt werden.`);
  }
  return hints;
}

function projectHints(columns, fu) {
  const hints = [];
  const withData = columns.filter(c => c.lca.entries.length);
  const groups = withData.map(c => {
    const m = indicatorModules(c.lca.totals, 'GWP-total');
    return [['A1–A3', m?.a1a3], ['C3+C4', m?.eol], ['D', m?.d]].filter(([, v]) => v != null).map(([l]) => l).join(', ') || 'keine';
  });
  if (new Set(groups).size > 1) {
    hints.push(`Deklarierte Module unterscheiden sich (${withData.map((c, i) => `${c.name}: ${groups[i]}`).join(' · ')}). „Gesamt“ ist nur bei gleichen Modulen vergleichbar.`);
  }
  const incomplete = columns.filter(c => c.lca.entries.length < c.lca.materialCount);
  if (incomplete.length) {
    hints.push(`Unvollständige Datenbasis: ${incomplete.map(c => `${c.name} (${c.lca.entries.length} von ${c.lca.materialCount} Materialien)`).join(', ')}. Die Summen enthalten nur Materialien mit Menge und Kennwert.`);
  }
  if (fu.on && columns.some(c => !num(fu.qty[c.id]))) {
    hints.push('Für die Normierung fehlt bei mindestens einer Spalte die Bezugsmenge.');
  }
  return hints;
}

// ─── GWP summary bar ─────────────────────────────────────────────────────────

function GwpSummary({ columns, getGwp, title }) {
  const vals = columns.map(c => ({ name: c.name, kind: c.kind, cell: getGwp(c) }));
  const nums = vals.filter(x => typeof x.cell.v === 'number');
  if (!nums.length) return null;
  const absMax = Math.max(...nums.map(x => Math.abs(x.cell.v)), 0.001);
  const minV = Math.min(...nums.map(x => x.cell.v));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Leaf className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="space-y-3">
        {vals.map((x, i) => {
          const v = x.cell.v;
          const has = typeof v === 'number';
          const pct = has ? (Math.abs(v) / absMax) * 100 : 0;
          const isBest = has && nums.length > 1 && v === minV;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-40 truncate shrink-0 font-medium" title={x.name}>{x.name}</span>
              <div className="flex-1 min-w-0">
                {has ? (
                  <div className={`h-4 rounded-full ${v < 0 ? 'bg-emerald-400' : isBest ? 'bg-green-500' : 'bg-blue-400'}`} style={{ width: `${Math.max(pct, 1)}%` }} />
                ) : (
                  <span className="text-xs text-gray-400 italic">{x.cell.note || 'keine Daten'}</span>
                )}
              </div>
              <span className={`text-xs font-mono font-semibold w-28 text-right shrink-0 ${isBest ? 'text-emerald-700' : 'text-gray-700'}`}>
                {has ? fmt(v) : '–'}{isBest && <span className="ml-1">↓</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── comparison table ────────────────────────────────────────────────────────

function CellContent({ cell, row }) {
  if (cell.v == null || cell.v === '') {
    return (
      <span className="text-gray-400 text-xs italic" title={cell.note || undefined}>
        {cell.muted != null && <span className="block not-italic font-mono text-gray-300 line-through">{fmt(cell.muted)} /{cell.mutedUnit}</span>}
        {cell.note || '–'}
      </span>
    );
  }
  const text = typeof cell.v === 'number' ? fmt(cell.v) : String(cell.v);
  return (
    <>
      <span className={`${row.strong ? 'font-semibold' : ''} ${cell.warn ? 'text-amber-700' : ''} ${typeof cell.v === 'string' && cell.v.length > 60 ? 'block text-left text-xs line-clamp-3' : ''}`} title={typeof cell.v === 'string' ? cell.v : undefined}>
        {text}
      </span>
      {cell.sub && <span className="block text-[10px] text-amber-700 mt-0.5 text-left">{cell.sub}</span>}
    </>
  );
}

function CompareTable({ sections, columns, onRemove }) {
  const colBase = 'border border-gray-100 px-3 py-2 text-sm';

  function bestValue(row) {
    if (!row.lowerBetter) return null;
    const nums = columns.map(c => row.get(c).v).filter(v => typeof v === 'number');
    return nums.length >= 2 ? Math.min(...nums) : null;
  }
  const visible = (row) => !row.hidden && (row.input || !row.hideEmpty || columns.some(c => {
    const cell = row.get(c);
    return (cell.v != null && cell.v !== '') || cell.muted != null;
  }));

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 mb-6">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-gray-50">
            <th className={`${colBase} font-semibold text-gray-600 w-56`}>Indikator</th>
            {columns.map((col) => {
              const badge = KIND_BADGE[col.kind];
              return (
                <th key={col.id} className={`${colBase} font-semibold text-gray-800 text-center align-top`}>
                  <div className="flex items-start justify-center gap-1">
                    <span className="line-clamp-2" title={col.name}>{col.name}</span>
                    {onRemove && (
                      <button type="button" onClick={() => onRemove(col)} title="Aus Vergleich entfernen"
                        className="text-gray-300 hover:text-gray-600 shrink-0 mt-0.5">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wide ${badge.cls}`}>
                    {badge.icon && <Database className="w-2.5 h-2.5" />}{badge.label}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => {
            const rows = section.rows.filter(visible);
            if (!rows.length) return null;
            return (
              <React.Fragment key={section.section}>
                <tr className="bg-emerald-50">
                  <td colSpan={columns.length + 1} className="px-3 py-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wide border border-gray-100">
                    {section.section}
                  </td>
                </tr>
                {rows.map((row) => {
                  const best = bestValue(row);
                  return (
                    <tr key={row.label} className="even:bg-gray-50/40 hover:bg-blue-50/30 transition-colors">
                      <td className={`${colBase} text-gray-600`}>
                        {row.label}
                        {row.unit && <span className="text-gray-400 text-xs ml-1">[{row.unit}]</span>}
                      </td>
                      {columns.map((col) => {
                        const cell = row.get(col);
                        const isBest = best != null && cell.v === best;
                        return (
                          <td key={col.id}
                            className={`${colBase} text-center tabular-nums ${isBest ? 'text-green-700 font-semibold bg-green-50' : 'text-gray-700'}`}>
                            {row.input ? (
                              <input
                                type="number" min="0" step="any"
                                value={row.input.get(col)}
                                onChange={(e) => row.input.set(col, e.target.value)}
                                placeholder={row.input.placeholder}
                                className="w-24 px-2 py-1 text-xs text-right border border-gray-200 rounded focus:ring-1 focus:ring-emerald-400 outline-none"
                              />
                            ) : (
                              <CellContent cell={cell} row={row} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(columns, sections, type) {
  const rows = [['Indikator', ...columns.map(c => `${c.name} [${KIND_BADGE[c.kind].label}]`)]];
  for (const section of sections) {
    rows.push([section.section, ...columns.map(() => '')]);
    for (const row of section.rows) {
      rows.push([
        row.unit ? `${row.label} [${row.unit}]` : row.label,
        ...columns.map(c => {
          const cell = row.get(c);
          if (cell.v == null || cell.v === '') return cell.note || '';
          return typeof cell.v === 'number' ? String(cell.v).replace('.', ',') : String(cell.v);
        }),
      ]);
    }
  }
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `vergleich-${type}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── toolbar pieces ──────────────────────────────────────────────────────────

function Segmented({ value, options, onChange }) {
  return (
    <div className="inline-flex p-0.5 bg-gray-100 rounded-lg">
      {options.map(o => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${value === o.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AdhocVariantForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [material, setMaterial] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: ['compare', 'material-search', query],
    queryFn: () => materialService.getAll({ search: query, limit: 20 }),
    enabled: open && query.trim().length >= 2,
  });
  const results = Array.isArray(data) ? data : (data?.data || []);

  function pick(m) {
    setMaterial(m);
    setUnit(libDeclaredUnit(m).replace(/^[\d.,]+\s*/, ''));
  }

  function submit() {
    const q = num(quantity);
    if (!material || !q) return;
    onAdd({
      id: `adhoc-${material.id}-${Date.now()}`,
      name: `${material.name} (${quantity} ${unit})`,
      material, quantity: q, unit,
    });
    setOpen(false); setQuery(''); setMaterial(null); setQuantity('1');
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-dashed border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors">
        <Plus className="w-4 h-4" /> Material mit Menge hinzufügen
      </button>
    );
  }

  return (
    <div className="w-full bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Ad-hoc-Variante: ein Material mit Menge</p>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      {!material ? (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Bibliotheksmaterial suchen…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 outline-none" />
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {isFetching && <p className="text-xs text-gray-400">Suche…</p>}
            {results.map(m => (
              <button key={m.id} type="button" onClick={() => pick(m)}
                className="w-full text-left px-3 py-2 rounded-lg bg-white border border-gray-100 hover:border-amber-300 text-sm">
                <span className="font-medium text-gray-800">{m.name}</span>
                {m.category && <span className="text-xs text-gray-400 ml-2">{m.category}</span>}
                {m.gwp_value != null && <span className="text-xs text-emerald-700 ml-2">{fmt(m.gwp_value)} {prettyUnit(m.gwp_unit)}</span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <p className="text-xs text-gray-500">Material</p>
            <p className="text-sm font-medium text-gray-800">{material.name}
              <button type="button" onClick={() => setMaterial(null)} className="ml-2 text-xs text-amber-700 underline">ändern</button>
            </p>
            <p className="text-[11px] text-gray-400">Kennwert je {libDeclaredUnit(material)}</p>
          </div>
          <label className="text-xs text-gray-500">Menge
            <input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)}
              className="block w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
          </label>
          <label className="text-xs text-gray-500">Einheit
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg"
              className="block w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
          </label>
          <button type="button" onClick={submit} disabled={!num(quantity)}
            className="px-4 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-40">
            Hinzufügen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const navigate  = useNavigate();
  const { setItems, toggle, refEpds, setRefEpds, adhocVariants, setAdhocVariants } = useCompareStore();

  const type = params.get('type') || 'materials';
  const ids  = (params.get('ids') || '').split(',').filter(Boolean);
  const isMaterials = type === 'materials';

  const [module, setModule] = useState('total');
  const [target, setTarget] = useState('kg');
  const [convOverrides, setConvOverrides] = useState({});
  const [fu, setFu] = useState({ on: false, unit: 'm²', qty: {} });

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['compare', type, id],
      queryFn:  () => (isMaterials ? materialService.getById(id) : projectService.getById(id)),
      enabled:  !!id,
    })),
  });

  const loading = queries.some((q) => q.isLoading);
  const dataKey = queries.map((q) => `${q.data?.id || ''}:${q.dataUpdatedAt}`).join(',');

  useEffect(() => {
    const loaded = queries.map((q) => q.data).filter(Boolean);
    if (loaded.length) setItems(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, setItems]);

  const columns = useMemo(() => {
    const loaded = queries.map((q) => q.data).filter(Boolean);
    return isMaterials
      ? [...loaded.map(libraryColumn), ...refEpds.map(epdColumn)]
      : [...loaded.map(projectColumn), ...adhocVariants.map(adhocColumn)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, isMaterials, refEpds, adhocVariants]);

  // conversion data per column: overrides from the table win over stored values
  const conv = useMemo(() => {
    const fn = (col) => {
      const o = convOverrides[col.id] || {};
      const pick = (k) => (o[k] !== undefined ? num(o[k]) : col.conv?.[k] ?? null);
      return { density: pick('density'), areal: pick('areal'), piece: pick('piece') };
    };
    fn.set = (id, param, v) => setConvOverrides(prev => ({ ...prev, [id]: { ...prev[id], [param]: v } }));
    return fn;
  }, [convOverrides]);
  // raw input text for the table inputs (keeps what the user typed)
  const convInput = useMemo(() => (col) => {
    const o = convOverrides[col.id] || {};
    const base = col.conv || {};
    return Object.fromEntries(['density', 'areal', 'piece'].map(k => [k, o[k] !== undefined ? o[k] : base[k]]));
  }, [convOverrides]);

  const fuState = useMemo(() => ({
    ...fu,
    setQty: (id, v) => setFu(prev => ({ ...prev, qty: { ...prev.qty, [id]: v } })),
  }), [fu]);

  const sections = useMemo(() => {
    if (!isMaterials) return buildProjectRows({ t, module, fu: fuState });
    return buildMaterialRows({ module, target, conv, convInput, columns });
  }, [isMaterials, t, module, fuState, target, conv, convInput, columns]);

  const gwpRow = sections.flatMap(s => s.rows).find(r => r.label === 'GWP A1–A3');
  const hints = isMaterials
    ? materialHints(columns, target, gwpRow ? gwpRow.get : () => ({}))
    : projectHints(columns, fuState);

  function removeColumn(col) {
    if (col.kind === 'epd') return setRefEpds(refEpds.filter(e => e.uuid !== col.id));
    if (col.kind === 'adhoc') return setAdhocVariants(adhocVariants.filter(v => v.id !== col.id));
    toggle(type, col.id);
    const next = ids.filter(i => i !== col.id);
    setParams({ type, ids: next.join(',') }, { replace: true });
  }

  const typeLabel = isMaterials ? 'Materialien' : 'Projekte';
  const targetLabel = TARGET_UNITS.find(u => u.key === target)?.label;
  const summaryTitle = isMaterials
    ? `GWP A1–A3 (kg CO₂e ${target === 'declared' ? 'je deklarierter Einheit' : 'je ' + targetLabel})`
    : `GWP A1–A3 (kg CO₂e${fu.on ? ' je ' + (fu.unit || 'FE') : ''})`;

  if (!ids.length && !(isMaterials ? refEpds.length : adhocVariants.length)) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center text-gray-500">
        Keine Elemente zum Vergleichen ausgewählt.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-28">
      {/* header */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{typeLabel} vergleichen</h1>
            <p className="text-sm text-gray-500">{columns.length} Spalte{columns.length !== 1 ? 'n' : ''}</p>
          </div>
        </div>
        {!loading && columns.length >= 2 && (
          <button type="button" onClick={() => exportCsv(columns, sections, type)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
            <Download className="w-4 h-4" /> CSV Export
          </button>
        )}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-5">
        {isMaterials ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Bezugseinheit</span>
              <Segmented value={target} options={TARGET_UNITS} onChange={setTarget} />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[320px]">
              <OekobaudatPicker
                searchOnly
                selected={refEpds}
                onChange={setRefEpds}
                buttonLabel="Referenzprodukt aus ÖKOBAUDAT hinzufügen"
              />
            </div>
          </>
        ) : (
          <>
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={fu.on} onChange={(e) => setFu(prev => ({ ...prev, on: e.target.checked }))} />
              Je funktionaler Einheit
              {fu.on && (
                <input value={fu.unit} onChange={(e) => setFu(prev => ({ ...prev, unit: e.target.value }))}
                  placeholder="m², Stück…" className="w-20 px-2 py-1 border border-gray-300 rounded text-xs" />
              )}
            </label>
            <AdhocVariantForm onAdd={(v) => setAdhocVariants([...adhocVariants, v])} />
          </>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Modul weitere Indikatoren</span>
          <Segmented value={module} options={MODULES} onChange={setModule} />
        </div>
      </div>

      {loading && <div className="text-center py-16 text-gray-400">Lade Daten…</div>}

      {!loading && columns.length < 2 && (
        <div className="text-center py-16 text-gray-400">
          Mindestens 2 Elemente werden für den Vergleich benötigt.
          {isMaterials && <span className="block text-xs mt-1">Tipp: ein Referenzprodukt aus ÖKOBAUDAT hinzufügen.</span>}
        </div>
      )}

      {!loading && columns.length >= 2 && (
        <>
          {hints.length > 0 && (
            <div className="mb-5 space-y-1.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              {hints.map((h, i) => (
                <p key={i} className="flex gap-2 text-xs text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {h}
                </p>
              ))}
            </div>
          )}
          <GwpSummary columns={columns} getGwp={gwpRow ? gwpRow.get : () => ({})} title={summaryTitle} />
          <CompareTable sections={sections} columns={columns} onRemove={removeColumn} />
          <p className="text-[11px] text-gray-400">
            {isMaterials
              ? 'Kennwerte je Bezugseinheit; Umrechnung über Rohdichte, Flächengewicht bzw. Stückgewicht. Gesamt = A1–A3 + B6 + C3 + C4, D wird separat ausgewiesen.'
              : 'Projektbilanz wie in der Gesamtbilanz der Projektseite: Bibliotheksmaterialien und ÖKOBAUDAT-EPDs, Kennwert × Menge (umgerechnet auf die deklarierte Einheit). Gesamt = A1–A3 + B6 + C3 + C4, D wird separat ausgewiesen.'}
          </p>
        </>
      )}
    </div>
  );
}
