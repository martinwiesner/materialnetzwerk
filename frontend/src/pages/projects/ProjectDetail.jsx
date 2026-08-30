import { useState } from 'react';
import { useT } from '../../i18n/useT';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/projectService';
import {
  ArrowLeft, Edit2, Trash2, Globe, Lock, Package,
  Calendar, User, Leaf, ChevronLeft, ChevronRight,
  MapPin, ExternalLink, BookOpen, Users, Tag, Database, FileDown, Share2
} from 'lucide-react';
import { EpdFullAnalysis } from '../../components/projects/EpdAnalysis';
import { CombinedProductLca } from '../../components/projects/CombinedProductLca';
import LcaExportDialog from '../../components/projects/LcaExportDialog';
import ShareDialog from '../../components/shared/ShareDialog';

function ImageCarousel({ images, apiBase }) {
  const t = useT();
  const [idx, setIdx] = useState(0);
  if (!images.length) return null;
  const url = (img) => `${apiBase}${img.file_path?.replace(/^\./, '')}`;
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  return (
    <div className="border-b border-gray-200">
      {/* Main image */}
      <div className="relative">
        <img
          src={url(images[idx])}
          alt={images[idx].original_name || t('projectDetail.imageAlt', { n: idx + 1 })}
          className="w-full h-72 object-cover"
        />
        {images[idx].credit && (
          <span className="absolute bottom-2 right-2 text-[10px] font-light text-white/70 tracking-wide leading-none [writing-mode:vertical-rl] rotate-180 select-none pointer-events-none">
            {images[idx].credit}
          </span>
        )}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            {/* Dot indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === idx ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-1.5 p-3 overflow-x-auto bg-gray-50">
          {images.map((img, i) => (
            <button
              key={img.id ?? i}
              onClick={() => setIdx(i)}
              className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                i === idx ? 'border-project-500' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={url(img)} alt="" className="h-14 w-20 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
import ProjectForm from '../../components/projects/ProjectForm';
import { MEDIA_BASE } from '../../services/api';
import MaterialIdSection from '../../components/shared/MaterialIdSection';
import { useAuthStore } from '../../store/authStore';
import SharePrintBar from '../../components/shared/SharePrintBar';
import BookmarkButton from '../../components/shared/BookmarkButton';
import { exportProjectPoster } from '../../utils/exportUtils';
import { formatDate } from '../../utils/dates';
import { getLicenseLabel } from '../../utils/licenses';
const API_BASE = MEDIA_BASE;

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function TagGroup({ title, items }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-gray-700 mb-2">{title}</div>
      <div className="flex flex-wrap gap-2">
        {list.map((t) => (
          <span key={t} className="px-2.5 py-1 rounded-full text-xs border border-gray-200 bg-gray-50 text-gray-800">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Ökobaudat EPD LCA helpers ────────────────────────────────────────────────

const EPD_INDICATOR_ORDER = [
  'GWP-total','GWP-fossil','GWP-biogenic','GWP-luluc',
  'ODP','AP','EP-terrestrial','EP-freshwater','EP-marine','POCP',
  'ADP-elements','ADP-fossil','ADP','WDP',
  'HWD','NHWD','RWD','PERE','PENRE','PERM',
];

function epdSumMods(mods, keys) {
  for (const k of keys) {
    if (k in mods && mods[k] != null) return mods[k];
  }
  let s = 0, found = false;
  for (const k of Object.keys(mods)) {
    if (keys.includes(k) && mods[k] != null) { s += mods[k]; found = true; }
  }
  return found ? s : null;
}

function epdFmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  if (v === 0) return '0';
  if (Math.abs(v) < 0.0001) return v.toExponential(2);
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 100)  return v.toFixed(1);
  if (Math.abs(v) >= 1)    return v.toFixed(2);
  return v.toPrecision(3);
}

function epdNormUnit(u) {
  if (!u) return '';
  let s = u.trim().replace(/^[\d.,]+\s*/, '').trim().toLowerCase();
  if (['metric ton','metric tons','tonne','tonnes','tonnen'].includes(s)) s = 't';
  if (['m3','cubic meter','cubic metre','kubikmeter'].includes(s)) s = 'm³';
  if (['kilogramm','kilogram','kilograms'].includes(s)) s = 'kg';
  return s;
}
function epdUnitConv(fromUnit, toUnit) {
  function toKg(u) { return u==='kg'?1:u==='t'?1000:u==='g'?0.001:null; }
  const f = epdNormUnit(fromUnit), t = epdNormUnit(toUnit);
  if (!f||!t||f===t) return 1;
  const fK=toKg(f), tK=toKg(t);
  return (fK!=null&&tK!=null&&tK!==0) ? fK/tK : 1;
}
function epdGetQty(epd) {
  return (Number(epd.quantity) || 1) * epdUnitConv(epd.unit, epd.declaredUnit);
}

function epdComputeTotals(selected) {
  const totals = {};
  for (const epd of selected) {
    const qty = epdGetQty(epd);
    for (const [key, ind] of Object.entries(epd.indicators || {})) {
      if (!totals[key]) totals[key] = { unit: ind.unit, mods: {} };
      for (const [mod, val] of Object.entries(ind.mods || {})) {
        if (val != null) totals[key].mods[mod] = (totals[key].mods[mod] || 0) + qty * val;
      }
    }
  }
  return totals;
}

// Convert a library material (with gwp data) into the unified EPD-entry format
function libMatToEpdEntry(m) {
  const perUnit = Number(m.effective_gwp_value) || 0;
  const indicators = {};
  if (perUnit !== 0 || m.gwp_value != null) {
    indicators['GWP-total'] = { mods: { 'A1-A3': perUnit }, unit: 'kg CO₂e' };
  }
  if (m.gwp_fossil      != null) indicators['GWP-fossil']      = { mods: { 'A1-A3': Number(m.gwp_fossil)      }, unit: 'kg CO₂e' };
  if (m.gwp_biogenic    != null) indicators['GWP-biogenic']    = { mods: { 'A1-A3': Number(m.gwp_biogenic)    }, unit: 'kg CO₂e' };
  if (m.gwp_luluc       != null) indicators['GWP-luluc']       = { mods: { 'A1-A3': Number(m.gwp_luluc)       }, unit: 'kg CO₂e' };
  if (m.adp_fossil      != null) indicators['ADP-fossil']      = { mods: { 'A1-A3': Number(m.adp_fossil)      }, unit: 'MJ' };
  if (m.adp_elements    != null) indicators['ADP-elements']    = { mods: { 'A1-A3': Number(m.adp_elements)    }, unit: 'kg Sb eq.' };
  if (m.water_consumption!=null) indicators['WDP']             = { mods: { 'A1-A3': Number(m.water_consumption)}, unit: 'm³' };
  if (m.odp             != null) indicators['ODP']             = { mods: { 'A1-A3': Number(m.odp)             }, unit: 'kg CFC-11 eq.' };
  if (m.ap              != null) indicators['AP']              = { mods: { 'A1-A3': Number(m.ap)              }, unit: 'mol H⁺ eq.' };
  if (m.ep_terrestrial  != null) indicators['EP-terrestrial']  = { mods: { 'A1-A3': Number(m.ep_terrestrial)  }, unit: 'mol N eq.' };
  if (m.ep_freshwater   != null) indicators['EP-freshwater']   = { mods: { 'A1-A3': Number(m.ep_freshwater)   }, unit: 'kg P eq.' };
  if (m.ep_marine       != null) indicators['EP-marine']       = { mods: { 'A1-A3': Number(m.ep_marine)       }, unit: 'kg N eq.' };
  if (m.pocp            != null) indicators['POCP']            = { mods: { 'A1-A3': Number(m.pocp)            }, unit: 'kg NMVOC eq.' };
  if (m.hwd             != null) indicators['HWD']             = { mods: { 'A1-A3': Number(m.hwd)             }, unit: 'kg' };
  if (m.nhwd            != null) indicators['NHWD']            = { mods: { 'A1-A3': Number(m.nhwd)            }, unit: 'kg' };
  if (m.rwd             != null) indicators['RWD']             = { mods: { 'A1-A3': Number(m.rwd)             }, unit: 'kg' };
  if (m.pere            != null) indicators['PERE']            = { mods: { 'A1-A3': Number(m.pere)            }, unit: 'MJ' };
  if (m.penre           != null) indicators['PENRE']           = { mods: { 'A1-A3': Number(m.penre)           }, unit: 'MJ' };
  if (m.perm            != null) indicators['PERM']            = { mods: { 'A1-A3': Number(m.perm)            }, unit: 'MJ' };
  const gwpDenominator = m.gwp_unit?.split('/')?.[1]?.trim() || null;
  const declaredUnit = m.declared_unit || gwpDenominator || 'kg';
  return {
    uuid:         `lib-${m.material_id || m.id}`,
    name:         m.material_name || m.name || 'Material',
    category:     m.category || '',
    declaredUnit,
    quantity:     Number(m.quantity) || 1,
    unit:         m.unit || declaredUnit,
    gwpA1A3:      perUnit !== 0 ? perUnit : null,
    gwpEoL:       null,
    gwpD:         null,
    indicators,
    isLibraryMaterial: true,
  };
}

function OekobaudatLcaSection({ project }) {
  const oekodatMaterials  = safeJsonParse(project.oekodat_materials, []);
  // Only include library materials that have a non-zero effective GWP value
  const libMatsWithGwp    = (project.materials || []).filter(
    m => m.has_gwp_data && Number(m.effective_gwp_value) !== 0
  );
  const libAsEpd          = libMatsWithGwp.map(libMatToEpdEntry);
  // Library materials first so they appear on the left in the chart
  const allMaterials      = [...libAsEpd, ...oekodatMaterials];

  if (!allMaterials.length) return null;

  const totals = epdComputeTotals(allMaterials);
  const indicatorKeys = Object.keys(totals).sort((a, b) => {
    const ia = EPD_INDICATOR_ORDER.indexOf(a), ib = EPD_INDICATOR_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  // Summary cards for GWP + key indicators
  const gwpMods = totals['GWP-total']?.mods || {};
  const gwpA1A3Total = epdSumMods(gwpMods, ['A1-A3', 'A1', 'A2', 'A3']);
  const gwpEoL      = epdSumMods(gwpMods, ['C3', 'C4']);
  const gwpLifecycle = [gwpA1A3Total, gwpMods['B6'] ?? null, gwpEoL]
    .reduce((s, v) => v != null ? s + v : s, 0);
  const hasGwpLifecycle = gwpA1A3Total != null || gwpMods['B6'] != null || gwpEoL != null;

  return (
    <div className="p-6 border-t border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-1">
        <Leaf className="w-5 h-5 text-emerald-600" />
        Umweltwirkung – Gesamtbilanz
      </h2>
      <p className="text-xs text-gray-400 mb-5">
        {[
          oekodatMaterials.length > 0 && `${oekodatMaterials.length} Ökobaudat-EPD${oekodatMaterials.length > 1 ? 's' : ''}`,
          libAsEpd.length > 0 && `${libAsEpd.length} Bibliotheks-Material${libAsEpd.length > 1 ? 'ien' : ''} mit Umweltdaten`,
        ].filter(Boolean).join(' · ')}
      </p>

      {/* Summary cards */}
      {hasGwpLifecycle && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
          {gwpA1A3Total != null && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider mb-1">GWP A1–A3</p>
              <p className="text-sm font-bold text-emerald-900 font-mono leading-tight">{epdFmtNum(gwpA1A3Total)}</p>
              <p className="text-[10px] text-emerald-600">kg CO₂ eq.</p>
            </div>
          )}
          {gwpEoL != null && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
              <p className="text-[10px] text-teal-700 font-semibold uppercase tracking-wider mb-1">GWP C3+C4 (EoL)</p>
              <p className="text-sm font-bold text-teal-900 font-mono leading-tight">{epdFmtNum(gwpEoL)}</p>
              <p className="text-[10px] text-teal-600">kg CO₂ eq.</p>
            </div>
          )}
          {hasGwpLifecycle && (
            <div className="bg-green-700 border border-green-800 rounded-xl p-3">
              <p className="text-[10px] text-green-200 font-semibold uppercase tracking-wider mb-1">GWP Gesamt (A–C)</p>
              <p className="text-sm font-bold text-white font-mono leading-tight">{epdFmtNum(gwpLifecycle)}</p>
              <p className="text-[10px] text-green-300">kg CO₂ eq.</p>
            </div>
          )}
        </div>
      )}

      {/* Material list — library materials + EPD materials */}
      <div className="space-y-2 mb-5">
        {allMaterials.map(epd => {
          const qty     = epdGetQty(epd);
          const gwpA1A3 = epd.gwpA1A3 != null ? epd.gwpA1A3 * qty : null;
          const isLib   = !!epd.isLibraryMaterial;
          return (
            <div key={epd.uuid}
              className={`flex items-center justify-between px-3 py-2.5 border rounded-lg gap-3 ${
                isLib ? 'bg-blue-50 border-blue-100' : 'bg-emerald-50 border-emerald-100'
              }`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 truncate">{epd.name}</p>
                  {isLib
                    ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wide"><Database className="w-2.5 h-2.5" />Bibliothek</span>
                    : <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wide">EPD</span>
                  }
                  {epd.norm && <span className="px-1 py-0.5 bg-blue-100 text-blue-600 text-[10px] rounded">{epd.norm}</span>}
                </div>
                {epd.category && <p className="text-xs text-gray-400 truncate mt-0.5">{epd.category}</p>}
                <p className="text-xs text-gray-500 mt-0.5">{qty} {epd.unit || epd.declaredUnit || ''}</p>
              </div>
              {gwpA1A3 != null && (
                <span className="flex-shrink-0 text-[11px] font-mono font-semibold text-emerald-700 bg-white border border-emerald-200 rounded-lg px-2 py-0.5">
                  {epdFmtNum(gwpA1A3)} kg CO₂ eq.
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Full indicator table */}
      {indicatorKeys.length > 0 && (
        <div className="border border-emerald-200 rounded-xl overflow-hidden">
          <div className="bg-emerald-700 px-3 py-2">
            <p className="text-xs font-bold text-white">Alle Umweltkategorien – Gesamtbilanz</p>
            <p className="text-[10px] text-emerald-200 mt-0.5">Gesamt = A1–A3 + B6 + C3 + C4 · D ist ein Gutschrift-Modul (separat ausgewiesen)</p>
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
                {indicatorKeys.map((key, i) => {
                  const { unit, mods } = totals[key];
                  const a1a3      = epdSumMods(mods, ['A1-A3', 'A1', 'A2', 'A3']);
                  const b6        = mods['B6'] ?? null;
                  const eol       = epdSumMods(mods, ['C3', 'C4']);
                  const d         = mods['D'] ?? null;
                  const lifecycle = [a1a3, b6, eol].reduce((s, v) => v != null ? s + v : s, 0);
                  const hasLifecycle = a1a3 != null || b6 != null || eol != null;
                  return (
                    <tr key={key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{key}</td>
                      <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap">{unit}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700 font-medium">{epdFmtNum(a1a3)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{epdFmtNum(b6)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{epdFmtNum(eol)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-blue-600">{epdFmtNum(d)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-bold text-emerald-800 bg-emerald-50">
                        {hasLifecycle ? epdFmtNum(lifecycle) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-material analysis: contribution chart + breakdown table (all sources combined) */}
      <EpdFullAnalysis selected={allMaterials} />
    </div>
  );
}

// ── IDEMAT EF 3.1 Section ────────────────────────────────────────────────────

const EF31_CATS = [
  { key: 'climate_change',      label: 'Klimawandel',               unit: 'Pt' },
  { key: 'particulate_matter',  label: 'Feinstaub',                 unit: 'Pt' },
  { key: 'acidification',       label: 'Versauerung',               unit: 'Pt' },
  { key: 'resource_fossils',    label: 'Ressourcen (fossil)',        unit: 'Pt' },
  { key: 'ecotox_freshwater',   label: 'Ökotox. Süßwasser',         unit: 'Pt' },
  { key: 'human_tox_cancer',    label: 'Tox. Mensch (krebserr.)',   unit: 'Pt' },
  { key: 'human_tox_noncancer', label: 'Tox. Mensch (nicht-k.)',   unit: 'Pt' },
  { key: 'eutroph_freshwater',  label: 'Eutrophierung (SW)',        unit: 'Pt' },
  { key: 'eutroph_marine',      label: 'Eutrophierung (Meer)',      unit: 'Pt' },
  { key: 'eutroph_terrestrial', label: 'Eutrophierung (terrestr.)', unit: 'Pt' },
  { key: 'photochem_ozone',     label: 'Photosmog',                 unit: 'Pt' },
  { key: 'ionising_radiation',  label: 'Ionisierende Strahlung',    unit: 'Pt' },
  { key: 'land_use',            label: 'Landnutzung',               unit: 'Pt' },
  { key: 'ozone_depletion',     label: 'Ozonabbau',                 unit: 'Pt' },
  { key: 'resource_minerals',   label: 'Ressourcen (mineralisch)',  unit: 'Pt' },
  { key: 'water_use',           label: 'Wassernutzung',             unit: 'Pt' },
];

function fmtPt(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  if (n === 0) return '0';
  if (Math.abs(n) >= 0.001) return n.toLocaleString('de-DE', { maximumFractionDigits: 5 });
  return n.toExponential(3);
}

function IdematLcaSection({ project }) {
  const items = safeJsonParse(project.idemat_lca_items, []);
  if (!items.length) return null;

  const grandTotal = items.reduce((s, it) => s + (it.ef31_total ?? 0) * it.quantity, 0);

  // Per-category totals across all processes
  const catTotals = EF31_CATS.map(({ key }) =>
    items.reduce((s, it) => s + ((it.ef31?.[key] ?? 0) * it.quantity), 0)
  );
  const maxCat = Math.max(...catTotals.map(Math.abs), 1e-99);

  return (
    <div className="p-6 border-t border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-1">
        <Leaf className="w-5 h-5 text-emerald-600" />
        IDEMAT 2026 – Prozess-Ökobilanz (EF 3.1)
      </h2>
      <p className="text-xs text-gray-400 mb-5">
        {items.length} Prozess{items.length > 1 ? 'e' : ''} · IDEMAT 2026 (TU Delft, CC BY-NC) · EF 3.1-Methode · Einheit: Pt (Punkte)
      </p>

      {/* Summary card */}
      <div className="bg-emerald-700 rounded-xl p-4 flex items-center gap-4 mb-6">
        <Leaf className="w-7 h-7 text-emerald-200 flex-shrink-0" />
        <div>
          <p className="text-[10px] text-emerald-200 font-semibold uppercase tracking-wider">EF 3.1 Gesamtscore</p>
          <p className="text-2xl font-mono font-bold text-white leading-tight">
            {fmtPt(grandTotal)}
            <span className="text-sm font-normal text-emerald-300 ml-2">Pt</span>
          </p>
        </div>
      </div>

      {/* Process list */}
      <div className="space-y-2 mb-6">
        {items.map((it) => {
          const subtotal = (it.ef31_total ?? 0) * it.quantity;
          const pct = grandTotal !== 0 ? Math.abs(subtotal / grandTotal) * 100 : 0;
          return (
            <div key={it.id} className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{it.name}</p>
                  <p className="text-xs text-gray-500">{it.category} · {it.quantity} {it.unit}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-mono font-bold text-emerald-800">{fmtPt(subtotal)} Pt</p>
                  <p className="text-[10px] text-gray-400">{pct.toFixed(1)} % des Gesamtscores</p>
                </div>
              </div>
              <div className="mt-2 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(2, pct)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-category bar chart */}
      <div className="border border-emerald-200 rounded-xl overflow-hidden mb-6">
        <div className="bg-emerald-700 px-4 py-2.5">
          <p className="text-xs font-bold text-white">Alle 16 EF 3.1-Kategorien – Gesamtbilanz</p>
          <p className="text-[10px] text-emerald-200 mt-0.5">Summe aller Prozesse × Menge</p>
        </div>
        <div className="p-4 space-y-3">
          {EF31_CATS.map(({ key, label }, i) => {
            const val = catTotals[i];
            const barW = maxCat > 0 ? Math.max(2, Math.abs(val) / maxCat * 100) : 2;
            return (
              <div key={key}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs text-gray-700 min-w-0 truncate">{label}</span>
                  <span className="text-xs font-mono text-gray-800 flex-shrink-0">{fmtPt(val)} Pt</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${barW}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full indicator table: rows = categories, columns = processes */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-800 px-4 py-2.5">
          <p className="text-xs font-bold text-white">Detailtabelle – EF 3.1 je Prozess</p>
          <p className="text-[10px] text-gray-300 mt-0.5">Werte = Prozess-Pt × Menge · alle Einheiten in Pt</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap sticky left-0 bg-gray-50">
                  Kategorie
                </th>
                {items.map((it) => (
                  <th key={it.id} className="text-right px-2 py-2 font-medium text-emerald-700 border-b border-gray-200 whitespace-nowrap max-w-[120px]">
                    <div className="truncate max-w-[120px]" title={it.name}>{it.name}</div>
                    <div className="text-[9px] text-gray-400 font-normal">{it.quantity} {it.unit}</div>
                  </th>
                ))}
                <th className="text-right px-3 py-2 font-semibold text-emerald-800 border-b border-gray-200 whitespace-nowrap bg-emerald-50">
                  Gesamt
                </th>
              </tr>
            </thead>
            <tbody>
              {EF31_CATS.map(({ key, label }, i) => {
                const total = catTotals[i];
                return (
                  <tr key={key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-1.5 font-medium text-gray-800 whitespace-nowrap sticky left-0" style={{ background: 'inherit' }}>
                      {label}
                    </td>
                    {items.map((it) => {
                      const val = (it.ef31?.[key] ?? 0) * it.quantity;
                      return (
                        <td key={it.id} className="px-2 py-1.5 text-right tabular-nums text-gray-600">
                          {fmtPt(val)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-right tabular-nums font-bold text-emerald-800 bg-emerald-50">
                      {fmtPt(total)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-emerald-100 font-bold">
                <td className="px-3 py-2 text-emerald-900 sticky left-0 bg-emerald-100">EF 3.1 Total</td>
                {items.map((it) => (
                  <td key={it.id} className="px-2 py-2 text-right tabular-nums text-emerald-800">
                    {fmtPt((it.ef31_total ?? 0) * it.quantity)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-900 bg-emerald-200">
                  {fmtPt(grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Helpers for LCA computation ─────────────────────────────────────────────

function computeContributions(materials, valueField, effectiveField) {
  return (materials || [])
    .map(m => {
      const gwpDenominator = m.gwp_unit?.split('/')?.[1]?.trim() || null;
      const declaredUnit   = m.declared_unit || gwpDenominator || 'kg';
      const conv = epdUnitConv(m.unit || declaredUnit, declaredUnit);
      const val = effectiveField ? m[effectiveField] : m[valueField];
      const contrib = val != null ? Number(m.quantity || 0) * conv * Number(val) : null;
      return { ...m, _contrib: contrib };
    })
    .filter(m => m._contrib != null && m._contrib !== 0)
    .sort((a, b) => Math.abs(b._contrib) - Math.abs(a._contrib));
}

const BAR_PALETTE = ['#f59e0b', '#22c55e', '#16a34a', '#10b981', '#0d9488', '#0891b2'];

function IndicatorChart({ label, unit, items, isPartial, formatVal }) {
  const t = useT();
  if (!items.length) return null;
  const total = items.reduce((s, m) => s + m._contrib, 0);
  const absMax = Math.abs(items[0]._contrib);
  const absTotal = items.reduce((s, m) => s + Math.abs(m._contrib), 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">{label}</span>
        <span className="text-[11px] font-bold text-gray-800 font-mono">
          Σ {formatVal(total)} <span className="font-normal text-gray-500">{unit}</span>
        </span>
      </div>
      {items.map((m, i) => {
        const pct = absTotal > 0 ? Math.abs(m._contrib) / absTotal * 100 : 0;
        const barW = absMax > 0 ? Math.max(2, Math.abs(m._contrib) / absMax * 100) : 2;
        const isLargest = i === 0 && items.length > 1;
        const isNegative = m._contrib < 0;
        const color = isNegative ? '#0891b2' : BAR_PALETTE[Math.min(i, BAR_PALETTE.length - 1)];
        return (
          <div key={m.material_id || m.id}>
            <div className="flex items-center justify-between gap-2 mb-0.5 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <span className="text-[11px] text-gray-700 truncate">{m.material_name}</span>
                {m.gwp_from_epd && label.startsWith('GWP') ? (
                  <span className="text-[9px] text-blue-500 bg-blue-50 border border-blue-100 rounded px-1 flex-shrink-0">EPD</span>
                ) : null}
                {isLargest && (
                  <span className="text-[9px] font-semibold flex-shrink-0" style={{ color }}>
                    ↑ {t('projectDetail.labels.largestContributor')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                <span className={`font-mono ${isNegative ? 'text-cyan-700' : 'text-gray-700'}`}>{formatVal(m._contrib)}</span>
                <span className="text-gray-400 w-7 text-right">{pct.toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${barW}%`, background: color }} />
            </div>
          </div>
        );
      })}
      {isPartial && (
        <p className="text-[10px] text-gray-400 mt-1">{t('projectDetail.labels.lcaPartialHint')}</p>
      )}
    </div>
  );
}

function OekobilanzSection({ project }) {
  const t = useT();
  const mats = project.materials || [];

  const gwpItems  = computeContributions(mats, null, 'effective_gwp_value');
  const adpFItems = computeContributions(mats, 'adp_fossil');
  const adpEItems = computeContributions(mats, 'adp_elements');
  const wdpItems  = computeContributions(mats, 'water_consumption');

  const hasAnyData = gwpItems.length || adpFItems.length || adpEItems.length || wdpItems.length;
  if (!hasAnyData) return null;

  const fmt3  = (v) => v.toLocaleString('de-DE', { maximumFractionDigits: 3 });
  const fmtE  = (v) => Number(v).toExponential(2);
  const fmt4  = (v) => v.toLocaleString('de-DE', { maximumFractionDigits: 4 });

  // "partial" = not ALL materials have data for that indicator
  const partial = (items) => items.length < mats.length;

  const withoutData = mats.filter(m => !m.has_gwp_data && m.adp_fossil == null && m.adp_elements == null && m.water_consumption == null);

  return (
    <div className="p-6 border-t border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-5">
        <Leaf className="w-5 h-5 text-green-600" />
        {t('projectDetail.labels.lcaTitle')}
      </h2>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {gwpItems.length > 0 && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-3">
            <p className="text-[10px] text-green-700 font-semibold uppercase tracking-wider mb-1">GWP</p>
            <p className="text-sm font-bold text-green-900 font-mono leading-tight">
              {fmt3(gwpItems.reduce((s, m) => s + m._contrib, 0))}
            </p>
            <p className="text-[10px] text-green-600">kg CO₂e</p>
          </div>
        )}
        {adpFItems.length > 0 && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
            <p className="text-[10px] text-orange-700 font-semibold uppercase tracking-wider mb-1">ADP fossil</p>
            <p className="text-sm font-bold text-orange-900 font-mono leading-tight">
              {fmt3(adpFItems.reduce((s, m) => s + m._contrib, 0))}
            </p>
            <p className="text-[10px] text-orange-600">MJ</p>
          </div>
        )}
        {adpEItems.length > 0 && (
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
            <p className="text-[10px] text-purple-700 font-semibold uppercase tracking-wider mb-1">ADP elements</p>
            <p className="text-sm font-bold text-purple-900 font-mono leading-tight">
              {fmtE(adpEItems.reduce((s, m) => s + m._contrib, 0))}
            </p>
            <p className="text-[10px] text-purple-600">kg Sb-Äq.</p>
          </div>
        )}
        {wdpItems.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-[10px] text-blue-700 font-semibold uppercase tracking-wider mb-1">WDP</p>
            <p className="text-sm font-bold text-blue-900 font-mono leading-tight">
              {fmt4(wdpItems.reduce((s, m) => s + m._contrib, 0))}
            </p>
            <p className="text-[10px] text-blue-600">m³</p>
          </div>
        )}
      </div>

      {/* Per-indicator breakdown charts */}
      <div className="space-y-5">
        <IndicatorChart
          label={t('projectDetail.labels.lcaGwp')}
          unit="kg CO₂e" items={gwpItems}
          isPartial={partial(gwpItems)} formatVal={fmt3}
        />
        <IndicatorChart
          label={t('projectDetail.labels.lcaAdpFossil')}
          unit="MJ" items={adpFItems}
          isPartial={partial(adpFItems)} formatVal={fmt3}
        />
        <IndicatorChart
          label={t('projectDetail.labels.lcaAdpElements')}
          unit="kg Sb-Äq." items={adpEItems}
          isPartial={partial(adpEItems)} formatVal={fmtE}
        />
        <IndicatorChart
          label={t('projectDetail.labels.lcaWater')}
          unit="m³" items={wdpItems}
          isPartial={partial(wdpItems)} formatVal={fmt4}
        />
      </div>

      {/* Materials completely without any data */}
      {withoutData.length > 0 && (
        <p className="mt-4 text-[11px] text-gray-400">
          {t('projectDetail.labels.noGwpData')}: {withoutData.map(m => m.material_name).join(', ')}
        </p>
      )}
    </div>
  );
}

// Prüft ob das Gerät genug Ressourcen für WASM hat.
// navigator.deviceMemory: Chrome/Android. Auf iOS nicht verfügbar → Desktop-Annahme.
const deviceMemory = navigator.deviceMemory ?? (window.matchMedia('(pointer: coarse)').matches ? 2 : 8);
const wasmCapable = deviceMemory >= 2;

function CadEmbed({ shareUrl }) {
  const [active, setActive] = useState(false);
  const [forceLoad, setForceLoad] = useState(false);

  const showIframe = active && (wasmCapable || forceLoad);

  return (
    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-100">
        <h2 className="text-base font-bold text-gray-900">CAD-Modell</h2>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">experimentell</span>
      </div>

      {/* Viewer */}
      {showIframe ? (
        <iframe
          src={shareUrl}
          title="CAD-Modell"
          className="w-full border-0"
          style={{ height: '520px' }}
          allow="fullscreen"
        />
      ) : wasmCapable ? (
        <button
          onClick={() => setActive(true)}
          className="w-full flex flex-col items-center justify-center gap-3 py-14 bg-gradient-to-b from-gray-50 to-gray-100 hover:from-amber-50 hover:to-amber-100 transition-colors cursor-pointer group"
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700 group-hover:text-amber-800">3D-Modell anzeigen</p>
            <p className="text-xs text-gray-400 mt-0.5">Klicken zum Laden · läuft im Browser</p>
          </div>
        </button>
      ) : (
        <div className="w-full flex flex-col items-center justify-center gap-3 py-12 bg-gradient-to-b from-gray-50 to-gray-100 px-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">3D-Modell</p>
            <p className="text-xs text-gray-400 mt-0.5">Auf diesem Gerät am besten im Browser öffnen</p>
          </div>
          <button
            onClick={() => { setActive(true); setForceLoad(true); }}
            className="text-xs text-amber-600 hover:text-amber-800 underline underline-offset-2"
          >
            Trotzdem hier laden
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-amber-100 bg-amber-50/60">
        <p className="text-xs text-gray-400">
          {showIframe
            ? 'Drehen: Maus · Zoomen: Scroll · Verschieben: Shift + Maus'
            : 'Öffnet direkt im Browser — keine Installation nötig'}
        </p>
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Im neuen Tab öffnen
        </a>
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showLcaExport, setShowLcaExport] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [visibilityLocal, setVisibilityLocal] = useState(null);

  async function handleDownloadPdf() {
    setPdfLoading(true);
    try {
      await projectService.downloadPdf(id, `projekt-${id}.pdf`);
    } catch (err) {
      console.error('PDF download failed', err);
    } finally {
      setPdfLoading(false);
    }
  }

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectService.getById(id),
  });

  const deleteMutation = useMutation({
    mutationFn: projectService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    },
  });

  const handleDelete = () => {
    if (window.confirm(t('projectDetail.deleteConfirm'))) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  if (error?.response?.status === 403) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Dieses Projekt ist privat und für dich nicht sichtbar.</p>
        <Link to="/projects" className="text-primary-600 hover:underline mt-2 inline-block">
          {t('projectDetail.backToList')}
        </Link>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">{t('projectDetail.notFound')}</p>
        <Link to="/projects" className="text-primary-600 hover:underline mt-2 inline-block">
          {t('projectDetail.backToList')}
        </Link>
      </div>
    );
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-project-50 text-project-700',
    completed: 'bg-rzz-cloud-light text-rzz-urban-ash',
    archived: 'bg-gray-100 text-gray-500',
  };

  const statusLabels = {
    draft: t('projectDetail.status.draft'),
    active: t('projectDetail.status.active'),
    completed: t('projectDetail.status.completed'),
    archived: t('projectDetail.status.archived'),
  };

  const circular = safeJsonParse(project.circular_principles, []);
  const suff = safeJsonParse(project.principles_sufficiency, []);
  const cons = safeJsonParse(project.principles_consistency, []);
  const eff = safeJsonParse(project.principles_efficiency, []);
  const gen = safeJsonParse(project.general_sustainability_principles, []);

  // Pre-computed LCA data — shared between CombinedProductLca render and LcaExportDialog
  const lcaEpdMats = (() => {
    const oekodatMats = safeJsonParse(project.oekodat_materials, []);
    const libMats = (project.materials || []).filter(m => m.has_gwp_data);
    return [...libMats.map(libMatToEpdEntry), ...oekodatMats];
  })();
  const lcaIdematItems = safeJsonParse(project.idemat_lca_items, []);
  const hasLcaData = lcaEpdMats.length > 0 || lcaIdematItems.length > 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('projectDetail.backToList')}
        </Link>
        {isAuthenticated && (project.owner_id === user?.id || user?.is_admin) && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              {t('projectDetail.editButton')}
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50"
              type="button" title="Sichtbarkeit & Freigabe"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-2 px-3 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {t('projectDetail.deleteButton')}
            </button>
          </div>
        )}
      </div>

      {/* Article */}
      <article className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Title Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[project.status] || statusColors.draft}`}>
              {statusLabels[project.status] || 'Draft'}
            </span>
            {project.is_public ? (
              <span className="inline-flex items-center gap-1 text-xs text-project-600">
                <Globe className="w-3 h-3" /> {t('projectDetail.visibility.public')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Lock className="w-3 h-3" /> {t('projectDetail.visibility.private')}
              </span>
            )}
            {project.is_available == 1 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                {t('projectDetail.labels.available')}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
          {project.description && (
            <p className="text-lg text-gray-600">{project.description}</p>
          )}

          {/* Contributors — shown prominently, above the creator */}
          {(() => {
            const contributors = safeJsonParse(project.contributors, []);
            if (!contributors.length) return null;
            return (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {t('projectDetail.sections.contributors')}:
                </span>
                {contributors.map((c, i) => {
                  const name = [c.first_name, c.last_name].filter(Boolean).join(' ');
                  return (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-primary-50 text-primary-800 border border-primary-200">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="font-medium hover:underline" title={`${name} anschreiben`}>
                          {name}
                        </a>
                      ) : (
                        <span className="font-medium">{name}</span>
                      )}
                      {c.role && <span className="text-primary-500">· {c.role}</span>}
                      {c.organization && <span className="text-primary-400">· {c.organization}</span>}
                    </span>
                  );
                })}
              </div>
            );
          })()}

          <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
            {project.owner_first_name && (
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {project.owner_first_name} {project.owner_last_name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(project.created_at)}
            </span>
          </div>
        </div>

        {/* Images carousel – all project images; step images also appear in-context below */}
        {project.images?.length > 0 && (
          <ImageCarousel images={project.images} apiBase={API_BASE} />
        )}

        {/* Content */}
        {project.content && (
          <div className="p-6 border-b border-gray-200">
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap text-gray-700">{project.content}</p>
            </div>
          </div>
        )}

        {/* Sustainability principles */}
        {(circular.length || suff.length || cons.length || eff.length || gen.length) ? (
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('projectDetail.sections.sustainability')}</h2>
            <div className="space-y-4">
              <TagGroup title={t('projectDetail.labels.circularPrinciples')} items={circular} />
              <TagGroup title={t('projectDetail.labels.sufficiency')} items={suff} />
              <TagGroup title={t('projectDetail.labels.consistency')} items={cons} />
              <TagGroup title={t('projectDetail.labels.efficiency')} items={eff} />
              <TagGroup title={t('projectDetail.labels.generalSustainability')} items={gen} />
            </div>
          </div>
        ) : null}

        {/* Materials Section */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-500" />
              {t('projectDetail.sections.materials')}
            </h2>
            {typeof project.total_gwp_value === 'number' && project.total_gwp_value !== 0 && (
              <span
                title={t('projectDetail.labels.gwpProjectTooltip', { unit: project.total_gwp_unit || 'kg CO₂e' })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-1 text-xs font-semibold text-green-800 cursor-help"
              >
                <Leaf className="w-3.5 h-3.5 text-green-600" />
                GWP total: {project.total_gwp_value.toFixed(3)} {project.total_gwp_unit || 'kg CO₂e'}
                <span className="text-green-500">ⓘ</span>
              </span>
            )}
          </div>

          {/* Materials List */}
          {project.materials && project.materials.length > 0 ? (
            <>
              <div className="space-y-2">
                {project.materials.map((material) => {
                  const effGwp = material.effective_gwp_value ?? material.gwp_value;
                  const gwpDen = material.gwp_unit?.split('/')?.[1]?.trim() || null;
                  const decU   = material.declared_unit || gwpDen || 'kg';
                  const conv   = epdUnitConv(material.unit || decU, decU);
                  const contrib = effGwp != null && material.quantity != null
                    ? Number(material.quantity) * conv * Number(effGwp)
                    : null;
                  return (
                    <div
                      key={material.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900">{material.material_name}</span>
                        <span className="text-gray-500 ml-2">
                          {material.quantity} {material.unit || t('projectDetail.labels.unit')}
                        </span>
                        {material.category && (
                          <span className="ml-2 text-xs text-gray-400">({material.category})</span>
                        )}
                      </div>
                      {contrib != null && material.has_gwp_data ? (
                        <span
                          title={t('projectDetail.labels.gwpMaterialTooltip', {
                            qty: material.quantity,
                            unit: material.unit || t('projectDetail.labels.unit'),
                            gwpValue: effGwp,
                            gwpUnit: material.gwp_unit || 'kg CO₂e',
                            total: contrib.toLocaleString('de-DE', { maximumFractionDigits: 3 }),
                          })}
                          className="ml-3 flex-shrink-0 text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-0.5 font-mono cursor-help"
                        >
                          {contrib.toLocaleString('de-DE', { maximumFractionDigits: 3 })} kg CO₂e
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

            </>
          ) : (
            <p className="text-gray-400 text-center py-4">{t('projectDetail.noMaterials')}</p>
          )}
        </div>

        {/* Ökobilanz / LCA Section (library materials) — only when no combined view is available */}
        {(() => {
          const oekodatMaterials = safeJsonParse(project.oekodat_materials, []);
          const libMatsWithGwp   = (project.materials || []).filter(m => m.has_gwp_data && Number(m.effective_gwp_value) !== 0);
          const hasCombined      = oekodatMaterials.length > 0 || libMatsWithGwp.length > 0;
          return !hasCombined ? <OekobilanzSection project={project} /> : null;
        })()}

        {/* Combined EPD + library LCA Section */}
        <OekobaudatLcaSection project={project} />

        {/* IDEMAT 2026 EF 3.1 Section */}
        <IdematLcaSection project={project} />

        {/* Combined product LCA — materials + processes in EF 3.1 Pt */}
        {hasLcaData && (
          <div className="bg-white rounded-xl border border-gray-200">
            <CombinedProductLca epdMats={lcaEpdMats} idematItems={lcaIdematItems} />
          </div>
        )}

        {/* Time effort + Tools */}
        {(project.time_effort || project.tools) && (
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('projectDetail.sections.execution')}</h2>
            {project.time_effort && (
              <div className="mb-3">
                <span className="text-sm font-semibold text-gray-600">{t('projectDetail.labels.timeEffort')} </span>
                <span className="text-sm text-gray-800">{project.time_effort}</span>
              </div>
            )}
            {project.tools && (
              <div>
                <span className="text-sm font-semibold text-gray-600">{t('projectDetail.labels.tools')} </span>
                <span className="text-sm text-gray-800">{project.tools}</span>
              </div>
            )}
          </div>
        )}

        {/* CAD-Modell */}
        {project.cad_share_url && <CadEmbed shareUrl={project.cad_share_url} />}

        {/* Step-by-step instructions */}
        {(() => {
          let steps = safeJsonParse(project.steps, []);
          if (!Array.isArray(steps)) steps = safeJsonParse(steps, []);
          if (!Array.isArray(steps)) steps = [];
          if (!steps.length) return null;
          // API_BASE is imported at the top of the file
          const stepImages = (project.images || []).filter(img => img.step_index != null);
          return (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('projectDetail.sections.steps')}</h2>
              <ol className="space-y-6">
                {steps.map((step, i) => {
                  // step_index is 1-based (Schritt 1 = index 1)
                  const stepImgs = stepImages.filter(im => im.step_index === i + 1);
                  return (
                    <li key={i} className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-sm">{i+1}</div>
                      <div className="flex-1 space-y-2">
                        {step.title && <h3 className="font-semibold text-gray-900">{step.title}</h3>}
                        {step.text && <p className="text-sm text-gray-700 whitespace-pre-wrap">{step.text}</p>}
                        {stepImgs.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {stepImgs.map(img => (
                              <img key={img.id} src={`${API_BASE}${img.file_path?.replace(/^\./,'')}`}
                                alt={step.title || t('projectDetail.stepAlt', { n: i + 1 })}
                                className="rounded-lg max-h-60 object-cover border border-gray-200" />
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })()}

        {/* Location */}
        {(project.location_name || project.address) && (
          <div className="p-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-gray-500" />
              {t('projectDetail.sections.location')}
            </h2>
            <div className="space-y-1 text-sm text-gray-700">
              {project.location_name && <p className="font-medium">{project.location_name}</p>}
              {project.address && (
                <p className="text-gray-500">
                  {t('projectDetail.labels.address')} {project.address}
                </p>
              )}
              {project.latitude && project.longitude && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${project.latitude}&mlon=${project.longitude}&zoom=16`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 mt-1"
                >
                  <ExternalLink className="w-3 h-3" /> {t('projectDetail.labels.mapsLink')}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Actors */}
        {project.actors?.length > 0 && (
          <div className="p-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-gray-500" />
              {t('projectDetail.sections.actors')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {project.actors.map(actor => (
                <span key={actor.id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200">
                  {actor.name}
                  {actor.location_name && <span className="text-gray-400">· {actor.location_name}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* References + License */}
        {(() => {
          const references = safeJsonParse(project.references, []);
          const licenseRows = [
            { key: 'hardware_license', label: t('projectDetail.labels.hardwareLicense') },
            { key: 'software_license', label: t('projectDetail.labels.softwareLicense') },
            { key: 'documentation_license', label: t('projectDetail.labels.documentationLicense') },
          ].filter(({ key }) => !!project[key]);
          const showLegacyLicense = project.license && licenseRows.length === 0;

          if (!licenseRows.length && !showLegacyLicense && !references.length) return null;

          return (
            <div className="p-6 border-t border-gray-200">
              {licenseRows.map(({ key, label }) => (
                <p key={key} className="text-sm text-gray-700 mb-1">
                  <span className="font-semibold text-gray-600"><Tag className="w-3.5 h-3.5 inline mr-1" />{label}</span> {getLicenseLabel(project[key])}
                </p>
              ))}
              {showLegacyLicense && (
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold text-gray-600"><Tag className="w-3.5 h-3.5 inline mr-1" />{t('projectDetail.labels.license')}</span> {project.license}
                </p>
              )}
              {references.length > 0 && (
                <>
                  <h2 className="text-sm font-semibold text-gray-600 flex items-center gap-1 mb-2 mt-2">
                    <BookOpen className="w-4 h-4" /> {t('projectDetail.sections.references')}
                  </h2>
                  <ul className="space-y-1">
                    {references.map((ref, i) => (
                      <li key={i} className="text-sm text-primary-600">
                        {ref.startsWith('http') ? (
                          <a href={ref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                            <ExternalLink className="w-3 h-3" /> {ref}
                          </a>
                        ) : ref}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          );
        })()}
        )}

        {/* Manufacturing files */}
        {project.files?.length > 0 && (
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('projectDetail.sections.files')}</h2>
            <ul className="space-y-2">
              {project.files.map(f => {
                // API_BASE is imported at the top of the file
                return (
                  <li key={f.id}>
                    <a href={`${API_BASE}${f.file_path?.replace(/^\./,'')}`} download={f.original_name} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 py-1">
                      ⬇ {f.original_name || f.filename}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </article>

      {project.material_id && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-5 mt-0">
          <MaterialIdSection
            materialId={project.material_id}
            passportType="project"
            entityType="projects"
            entityId={project.id}
          />
        </div>
      )}

      <SharePrintBar
        url={`${window.location.origin}/projects/${project.id}`}
        title={project.name}
        onPrint={() => exportProjectPoster(project)}
        actions={
          <>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              title="Projektdatenblatt als PDF herunterladen"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
            >
              <FileDown size={15} />
              {pdfLoading ? 'Lade…' : 'PDF'}
            </button>
            {hasLcaData && (
              <button
                onClick={() => setShowLcaExport(true)}
                title="Umweltkennwerte (LightLCA) als PDF exportieren"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                <FileDown size={15} />
                Umweltkennwerte (LightLCA)
              </button>
            )}
            <BookmarkButton entityType="project" entityId={project.id} showCount size="md" />
          </>
        }
      />

      {showForm && (
        <ProjectForm
          project={project}
          onClose={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['project', id] });
          }}
        />
      )}

      {showLcaExport && (
        <LcaExportDialog
          project={project}
          epdMats={lcaEpdMats}
          idematItems={lcaIdematItems}
          onClose={() => setShowLcaExport(false)}
        />
      )}

      {shareOpen && (
        <ShareDialog
          entityType="project"
          entityId={project.id}
          currentVisibility={visibilityLocal ?? project.visibility ?? (project.is_public ? 'public' : 'private')}
          isOwner={isAuthenticated && (project.owner_id === user?.id || user?.is_admin)}
          onClose={() => setShareOpen(false)}
          onVisibilityChange={(v) => {
            setVisibilityLocal(v);
            queryClient.invalidateQueries({ queryKey: ['project', id] });
          }}
        />
      )}
    </div>
  );
}
