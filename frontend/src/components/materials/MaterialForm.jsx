import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { materialService, materialActorService, parseEpdPdf, parseDocumentForMaterial, analyzeImages } from '../../services/materialService';
import { actorService } from '../../services/actorService';
import { inventoryService } from '../../services/inventoryService';
import { MapPin, X, Plus, Trash2, Users, Package, Upload, Search, Tag,
  ChevronDown, ChevronUp, Leaf, Wrench, Recycle, FlaskConical, Info,
  FileText, CheckCircle2, AlertCircle, Loader2, Check, Image as ImageIcon,
  Globe, Lock, Building2 } from 'lucide-react';
import GeolocateButton from '../shared/GeolocateButton';
import LocationPicker from '../shared/LocationPicker';
import ImageUploader from '../shared/ImageUploader';
import FileUploader from '../shared/FileUploader';
import InfoTooltip from '../shared/InfoTooltip';
import { idematService } from '../../services/idematService';

import { MEDIA_BASE } from '../../services/api';
import { useToast } from '../../store/toastStore';
import { useT } from '../../i18n/useT';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import InlineUserPicker from '../shared/InlineUserPicker';
const API_BASE = MEDIA_BASE;

// ── IDEMAT process linker (used inside AccordionSection) ──────────────────────
function IdematLinker({ processId, onSelect, onClear }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['idemat-search', q],
    queryFn: () => idematService.search(q),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  });

  const { data: linked } = useQuery({
    queryKey: ['idemat-process', processId],
    queryFn: () => idematService.getById(processId),
    enabled: Boolean(processId),
    staleTime: 5 * 60_000,
  });

  function openDropdown() {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
    setOpen(true);
  }

  function fmtPt(v) {
    if (v == null) return '—';
    if (Math.abs(v) >= 0.001) return v.toLocaleString('de-DE', { maximumFractionDigits: 5 });
    return v.toExponential(3);
  }

  function handleResultMouseDown(e, r) {
    e.preventDefault();
    onSelect(r);
    setQ('');
    setOpen(false);
  }

  const dropdown = open && q.trim().length >= 2 && rect ? createPortal(
    <div
      style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 99999 }}
      className="bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto"
    >
      {isFetching && <div className="px-3 py-2 text-xs text-gray-400">Suche…</div>}
      {!isFetching && results.length === 0 && (
        <div className="px-3 py-2 text-xs text-gray-400">Keine Treffer</div>
      )}
      {results.map((r) => (
        <button key={r.id} type="button"
          onMouseDown={(e) => handleResultMouseDown(e, r)}
          className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-b border-gray-50 last:border-0">
          <div className="text-xs font-medium text-gray-900 truncate">{r.name}</div>
          <div className="flex gap-2 mt-0.5">
            <span className="text-[10px] text-gray-500">{r.category}</span>
            <span className="text-[10px] text-gray-400">/{r.unit}</span>
            <span className="text-[10px] font-mono text-emerald-700">{fmtPt(r.ef31_total)} Pt</span>
          </div>
        </button>
      ))}
    </div>,
    document.getElementById('root')
  ) : null;

  return (
    <div className="space-y-2">
      {linked && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <Leaf className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-gray-900 truncate">{linked.name}</div>
            <div className="text-[10px] text-emerald-700 font-mono">{fmtPt(linked.ef31_total)} Pt · EF 3.1</div>
          </div>
          <button type="button" onClick={onClear}
            className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => { setQ(e.target.value); openDropdown(); }}
            onFocus={openDropdown}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={linked ? 'Prozess ändern…' : 'Prozess suchen (z.B. steel, wood, concrete)…'}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>
        {dropdown}
      </div>
    </div>
  );
}

// ── Accordion section ─────────────────────────────────────────────────────────

function AccordionSection({ icon: Icon, title, color = '#6b7280', filled = false, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          {filled && !open && (
            <span className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" title="Daten vorhanden" />
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-4 pb-5 pt-4 space-y-4">{children}</div>}
    </div>
  );
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// ── EPD field metadata for the import preview ─────────────────────────────────
const EPD_FIELD_LABELS = {
  name: 'Produktname', short_description: 'Kurzbeschreibung', manufacturer: 'Hersteller',
  category: 'Kategorie', material_type: 'Materialtyp',
  declared_unit: 'Deklarierte Einheit', lifecycle_scope: 'Systemgrenze',
  tech_density: 'Dichte (kg/m³)',
  cert_epd: 'EPD-Zertifizierung', cert_cradle_to_cradle: 'Cradle-to-Cradle', cert_fsc_pefc: 'FSC / PEFC',
  gwp_fossil: 'GWP fossil (kg CO₂e)', gwp_biogenic: 'GWP biogen (kg CO₂e)', gwp_luluc: 'GWP luluc (kg CO₂e)', gwp_value: 'GWP gesamt (kg CO₂e)',
  odp: 'ODP', ap: 'AP', ep_terrestrial: 'EP terrestrisch', ep_freshwater: 'EP Süßwasser',
  ep_marine: 'EP Meeresgewässer', pocp: 'POCP', adp_elements: 'ADPE', adp_fossil: 'ADPF (MJ)',
  water_consumption: 'WDP (m³)', hwd: 'HWD', nhwd: 'NHWD', rwd: 'RWD',
  pere: 'PERE (MJ)', penre: 'PENRE (MJ)', perm: 'PERM (MJ)',
  sust_climate_description: 'Klimawandel (Beschreibung)',
  circularity: 'Kreislauffähigkeit',
  human_health: 'Human Health (VOC)',
  processing_sustainability: 'Be- & Verarbeitung',
  principles_consistency: 'Konsistenz',
  principles_efficiency: 'Effizienz',
  source_url: 'EPD-URL', notes: 'EPD-Nummer',
};

const EPD_MT_LABELS = {
  primary: 'Neuware', secondary_rückbau: 'Rückbau', secondary_restposten: 'Produktionsrest',
  secondary_überschuss: 'Überschuss', secondary_upcycling: 'Upcycling', secondary_eigenproduktion: 'Eigenproduktion',
};

const EPD_GROUP_ORDER = [
  ['name', 'short_description', 'manufacturer', 'category', 'material_type'],
  ['declared_unit', 'lifecycle_scope', 'tech_density', 'cert_epd', 'cert_cradle_to_cradle', 'cert_fsc_pefc'],
  ['gwp_value', 'gwp_fossil', 'gwp_biogenic', 'gwp_luluc'],
  ['odp', 'ap', 'ep_terrestrial', 'ep_freshwater', 'ep_marine', 'pocp'],
  ['adp_elements', 'adp_fossil', 'water_consumption', 'hwd', 'nhwd', 'rwd'],
  ['pere', 'penre', 'perm'],
  ['sust_climate_description', 'circularity', 'human_health', 'processing_sustainability'],
  ['principles_consistency', 'principles_efficiency'],
  ['source_url', 'notes'],
];

// Confidence level → visual style
const CONF_STYLE = {
  high:   { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Hoch' },
  medium: { dot: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     label: 'Mittel' },
  low:    { dot: 'bg-red-400',     text: 'text-red-700',     bg: 'bg-red-50 border-red-200',          label: 'Gering' },
};

function ConfidenceDot({ level }) {
  const s = CONF_STYLE[level] || CONF_STYLE.medium;
  return (
    <span title={`Konfidenz: ${s.label}`}
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1 ${s.dot}`} />
  );
}

function EpdPdfDropZone({ onApply }) {
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | preview | error
  const [extracted, setExtracted] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState({});
  const inputRef = useRef(null);

  const processFile = async (file) => {
    const name = file?.name?.toLowerCase() ?? '';
    const ok = name.endsWith('.pdf') || name.endsWith('.json') || name.endsWith('.xml');
    if (!file || !ok) {
      setError('Bitte eine PDF-, JSON- oder XML-Datei auswählen.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const result = await parseEpdPdf(file);
      const data = result.data || {};
      setExtracted(data);
      setConfidence(result.confidence || null);
      setMeta(result.meta || null);
      const init = {};
      Object.keys(data).forEach(k => {
        if (!EPD_FIELD_LABELS[k]) return;
        // Skip empty arrays
        if (Array.isArray(data[k]) && data[k].length === 0) return;
        init[k] = true;
      });
      setSelected(init);
      setStatus('preview');
    } catch (e) {
      setError(e?.response?.data?.message || 'EPD-Analyse fehlgeschlagen');
      setStatus('error');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  };

  const handleApply = () => {
    const toApply = {};
    Object.entries(selected).forEach(([k, on]) => {
      if (on && extracted[k] !== undefined) toApply[k] = extracted[k];
    });
    onApply(toApply);
    setStatus('idle');
    setExtracted(null);
    setConfidence(null);
    setMeta(null);
  };

  const toggleAll = (val) => {
    const next = {};
    Object.keys(selected).forEach(k => { next[k] = val; });
    setSelected(next);
  };

  if (status === 'preview' && extracted) {
    const groups = EPD_GROUP_ORDER
      .map(keys => keys.filter(k => extracted[k] !== undefined && EPD_FIELD_LABELS[k]))
      .filter(g => g.length > 0);
    const totalFields = Object.keys(selected).length;
    const checkedFields = Object.values(selected).filter(Boolean).length;
    const conf = confidence;
    const overallLevel = conf?.overall || 'medium';
    const confScore = conf?.score;
    const overallStyle = CONF_STYLE[overallLevel] || CONF_STYLE.medium;

    return (
      <div className="border border-violet-200 rounded-xl overflow-hidden bg-violet-50/20 mb-3">

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-violet-100/60 border-b border-violet-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-violet-600" />
            <span className="text-xs font-semibold text-violet-800">EPD erkannt – {totalFields} Felder</span>
            {meta?.usedVision && (
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-medium">+ Vision</span>
            )}
          </div>
          <button type="button" onClick={() => { setStatus('idle'); setExtracted(null); setConfidence(null); }}
            className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </div>

        {/* Confidence banner */}
        {conf && (
          <div className={`flex items-start gap-2 px-3 py-2 border-b ${overallStyle.bg} border-opacity-60`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-semibold ${overallStyle.text}`}>
                  Konfidenz: {overallStyle.label}
                  {confScore != null && ` (${confScore}/100)`}
                </span>
                {meta?.usedVision && (
                  <span className="text-[10px] text-blue-600">Seitenbilder analysiert (Seiten {meta.epdPages?.join(', ')})</span>
                )}
                {!meta?.usedVision && (
                  <span className="text-[10px] text-gray-400">Nur Textanalyse</span>
                )}
              </div>
              {conf.summary && (
                <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">{conf.summary}</p>
              )}
            </div>
          </div>
        )}

        {/* Stichproben-Hinweis */}
        <div className="flex items-start gap-1.5 px-3 py-2 bg-amber-50 border-b border-amber-100">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 leading-snug">
            <strong>Bitte stichprobenhaft prüfen:</strong> Vergleiche 2–3 numerische Werte (z. B. GWP fossil, ODP) mit der Original-EPD, bevor du speicherst. Besonders bei Feldern mit mittlerer oder geringer Konfidenz.
          </p>
        </div>

        {/* Field list */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[11px] text-gray-500">{checkedFields} von {totalFields} ausgewählt</span>
            <button type="button" onClick={() => toggleAll(true)} className="text-[11px] text-violet-600 hover:underline">Alle</button>
            <button type="button" onClick={() => toggleAll(false)} className="text-[11px] text-gray-400 hover:underline">Keine</button>
            <div className="ml-auto flex items-center gap-2 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />sicher</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />unsicher</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />prüfen</span>
            </div>
          </div>

          <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
            {groups.map((keys, gi) => (
              <div key={gi} className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                {keys.map(k => {
                  const fieldConf = conf?.per_field?.[k] || 'medium';
                  return (
                    <label key={k} className="flex items-start gap-1.5 cursor-pointer py-0.5">
                      <input type="checkbox" checked={!!selected[k]}
                        onChange={() => setSelected(p => ({ ...p, [k]: !p[k] }))}
                        className="mt-0.5 w-3.5 h-3.5 text-violet-600 border-gray-300 rounded flex-shrink-0" />
                      <ConfidenceDot level={fieldConf} />
                      <span className="text-[11px] text-gray-500 leading-tight flex-shrink-0 min-w-[110px]">
                        {EPD_FIELD_LABELS[k]}
                      </span>
                      <span className="text-[11px] font-medium text-gray-800 leading-tight truncate"
                        title={Array.isArray(extracted[k]) ? extracted[k].join(', ') : String(extracted[k])}>
                        {Array.isArray(extracted[k])
                          ? extracted[k].join(', ')
                          : typeof extracted[k] === 'boolean'
                            ? (extracted[k] ? '✓' : '✗')
                            : k === 'material_type'
                              ? (EPD_MT_LABELS[extracted[k]] || extracted[k])
                              : String(extracted[k])}
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-3">
            <button type="button" onClick={handleApply} disabled={checkedFields === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors">
              <Check className="w-3.5 h-3.5" /> {checkedFields} Felder übernehmen
            </button>
            <button type="button" onClick={() => { setStatus('idle'); setExtracted(null); setConfidence(null); }}
              className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      {status === 'loading' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-3 py-3 border border-violet-200 rounded-xl bg-violet-50/40 text-xs text-violet-700">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            <div>
              <p className="font-medium">EPD wird analysiert…</p>
              <p className="text-[10px] text-violet-500 mt-0.5">Text-Extraktion → EPD-Seiten erkennen → Screenshots → KI-Analyse</p>
            </div>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-start gap-2 px-3 py-2.5 border border-red-200 rounded-xl bg-red-50 text-xs text-red-700 mb-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
          <button type="button" onClick={() => setStatus('idle')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {(status === 'idle' || status === 'error') && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-1.5 px-4 py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-center
            ${dragOver ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/30 bg-gray-50/50'}`}
        >
          <FileText className={`w-6 h-6 ${dragOver ? 'text-violet-500' : 'text-gray-300'}`} />
          <span className="text-xs font-medium text-gray-500">EPD hier ablegen</span>
          <span className="text-[10px] text-gray-400">PDF · JSON · XML · EN 15804+A2 · KI-Analyse</span>
          <input ref={inputRef} type="file" accept=".pdf,.json,.xml,application/pdf,application/json,application/xml,text/xml" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} />
        </div>
      )}
    </div>
  );
}

// ── KI field labels (used for both document and image analysis previews) ──────
const KI_FIELD_LABELS = {
  name:                        'Materialname',
  short_description:           'Kurzbeschreibung',
  description:                 'Beschreibung',
  category:                    'Kategorie',
  origin_acquisition:          'Herstellung / Gewinnung',
  use_processing:              'Verarbeitung / Einbau',
  use_where:                   'Einsatzbereiche',
  use_not_suitable:            'Nicht geeignet für',
  previous_use:                'Vorherige Nutzung',
  tech_dimensions:             'Abmessungen / Format',
  tech_density:                'Rohdichte (kg/m³)',
  tech_thermal_insulation:     'Wärmeleitfähigkeit λ (W/m·K)',
  tech_compressive_strength:   'Druckfestigkeit',
  tech_flammability:           'Brandschutz',
  contact_person:              'Ansprechpartner',
  notes:                       'Hinweise / TRL-Status',
  principles_consistency:      'Prinzipien (Konsistenz)',
  principles_efficiency:       'Prinzipien (Effizienz)',
  // EPD fields (auto-detected)
  gwp_fossil:                  'GWP fossil (kg CO₂e)',
  gwp_biogenic:                'GWP biogen (kg CO₂e)',
  gwp_value:                   'GWP gesamt (kg CO₂e)',
  cert_epd:                    'EPD vorhanden',
  manufacturer:                'Hersteller',
  declared_unit:               'Deklarierte Einheit',
  sust_climate_description:    'Klimawirkung (Beschreibung)',
  circularity:                 'Kreislauffähigkeit',
  human_health:                'Gesundheit / VOC',
  processing_sustainability:   'Verarbeitung / Entsorgung',
};

// Unified KI drop zone — accepts PDF, DOCX and images in one area
function KiDropZone({ onApply, onImages }) {
  const [dragOver, setDragOver] = useState(null); // null | 'img' | 'doc'

  // Independent loading states — both can be true simultaneously
  const [imgLoading, _setImgLoading] = useState(false);
  const [imgError,   setImgError]    = useState('');
  const [imgMsg,     setImgMsg]      = useState('');
  const [docLoading, _setDocLoading] = useState(false);
  const [docError,   setDocError]    = useState('');

  // Refs for current-value access inside async callbacks (avoids stale closure)
  const imgLoadingRef = useRef(false);
  const docLoadingRef = useRef(false);
  const imgResultRef  = useRef(null); // latest image analysis data
  const docResultRef  = useRef(null); // latest doc analysis { data, confidence }

  const setImgLoading = (v) => { imgLoadingRef.current = v; _setImgLoading(v); };
  const setDocLoading = (v) => { docLoadingRef.current = v; _setDocLoading(v); };

  // Preview state
  const [status,        setStatus]       = useState('idle'); // 'idle' | 'preview'
  const [extracted,     setExtracted]    = useState(null);
  const [confidence,    setConfidence]   = useState(null);
  const [selected,      setSelected]     = useState({});
  const [previewSource, setPreviewSource] = useState(null); // 'image' | 'doc' | 'merged'

  const imgInputRef = useRef(null);
  const docInputRef = useRef(null);

  const isImage = (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name);
  const isDoc   = (f) => /\.(pdf|docx)$/i.test(f.name) || f.type === 'application/pdf' || f.type.includes('wordprocessingml');

  // Merge accumulated results and display — called after each analysis finishes
  const tryShowPreview = () => {
    if (imgLoadingRef.current || docLoadingRef.current) return; // still waiting for the other
    const imgData   = imgResultRef.current;
    const docResult = docResultRef.current;
    if (!imgData && !docResult) return;

    let data, source, conf;
    if (imgData && docResult) {
      data   = { ...imgData, ...docResult.data }; // doc wins on conflict
      source = 'merged';
      conf   = docResult.confidence;
    } else if (docResult) {
      data = docResult.data; source = 'doc'; conf = docResult.confidence;
    } else {
      data = imgData; source = 'image'; conf = null;
    }

    const init = {};
    Object.keys(data).forEach(k => {
      if (!KI_FIELD_LABELS[k]) return;
      if (Array.isArray(data[k]) && data[k].length === 0) return;
      init[k] = true;
    });
    setExtracted(data);
    setConfidence(conf || null);
    setSelected(init);
    setPreviewSource(source);
    setStatus('preview');
  };

  const runImageAnalysis = async (files) => {
    if (files.length > 0 && onImages) onImages(files);
    setImgError('');
    setImgMsg(`${files.length > 1 ? files.length + ' Bilder werden' : 'Bild wird'} analysiert…`);
    setImgLoading(true);
    imgResultRef.current = null;
    try {
      const result = await analyzeImages(files, 'material');
      imgResultRef.current = result.data || {};
    } catch (e) {
      setImgError(e?.response?.data?.message || 'Bildanalyse fehlgeschlagen');
    } finally {
      setImgLoading(false);
      tryShowPreview();
    }
  };

  const runDocAnalysis = async (file) => {
    setDocError('');
    setDocLoading(true);
    docResultRef.current = null;
    // Close image-only preview so we can re-show merged result when doc finishes
    setStatus(s => s === 'preview' ? 'idle' : s);
    try {
      const result = await parseDocumentForMaterial(file);
      docResultRef.current = { data: result.data || {}, confidence: result.confidence };
    } catch (e) {
      setDocError(e?.response?.data?.message || 'Dokument-Analyse fehlgeschlagen');
    } finally {
      setDocLoading(false);
      tryShowPreview();
    }
  };

  const processFiles = (files) => {
    const imgFiles = files.filter(isImage);
    const docFiles = files.filter(isDoc);
    if (imgFiles.length > 0) runImageAnalysis(imgFiles);
    if (docFiles.length > 0) runDocAnalysis(docFiles[0]);
    if (imgFiles.length === 0 && docFiles.length === 0)
      setDocError('Bitte Bilder oder Dokumente (PDF, DOCX) ablegen.');
  };

  const handleApply = () => {
    const toApply = {};
    Object.entries(selected).forEach(([k, on]) => {
      if (on && extracted[k] !== undefined) toApply[k] = extracted[k];
    });
    onApply(toApply);
    reset();
  };

  const reset = () => {
    setStatus('idle');
    setExtracted(null);
    setConfidence(null);
    setSelected({});
    setPreviewSource(null);
    setImgError('');
    setDocError('');
    imgResultRef.current = null;
    docResultRef.current = null;
  };

  const toggleAll = (val) => setSelected(prev => Object.fromEntries(Object.keys(prev).map(k => [k, val])));

  // ── Doc zone (reused in both preview and idle states) ──────────────────────
  const DocZone = (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver('doc'); }}
      onDragLeave={() => setDragOver(null)}
      onDrop={e => { e.preventDefault(); setDragOver(null); if (!docLoading) processFiles(Array.from(e.dataTransfer.files)); }}
      onClick={() => !docLoading && docInputRef.current?.click()}
      className={`flex items-center gap-3 px-4 py-3 border border-dashed rounded-xl transition-all select-none
        ${docLoading
          ? 'border-gray-200 cursor-default'
          : dragOver === 'doc'
            ? 'border-gray-400 bg-gray-50 scale-[1.005] cursor-pointer'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 cursor-pointer'}`}
    >
      {docLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 text-gray-400" />
          <span className="text-[11px] text-gray-500">Dokument wird analysiert…</span>
        </>
      ) : (
        <>
          <FileText className={`w-5 h-5 flex-shrink-0 ${dragOver === 'doc' ? 'text-gray-500' : 'text-gray-300'}`} />
          {docError ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[11px] text-red-500 flex-1 truncate">{docError}</span>
              <button type="button" onClick={e => { e.stopPropagation(); setDocError(''); }}
                className="text-red-400 hover:text-red-600 flex-shrink-0 text-xs">✕</button>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 leading-snug">
              {dragOver === 'doc'
                ? 'Loslassen zum Analysieren'
                : 'Hast du neben Bildern auch Dokumente mit Daten? Auch die kannst du hier reindroppen'}
            </p>
          )}
        </>
      )}
      <input ref={docInputRef} type="file" disabled={docLoading}
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) processFiles(fs); e.target.value = ''; }} />
    </div>
  );

  // ── Preview state ──────────────────────────────────────────────────────────
  if (status === 'preview' && extracted) {
    const fields       = Object.keys(KI_FIELD_LABELS).filter(k => extracted[k] !== undefined);
    const checkedCount = Object.values(selected).filter(Boolean).length;
    const totalCount   = fields.length;
    const confStyle    = CONF_STYLE[confidence?.overall] || CONF_STYLE.medium;
    const sourceLabel  = previewSource === 'merged' ? 'Bild + Dok. gemergt'
      : previewSource === 'doc' ? 'aus Dokument' : 'aus Bildanalyse';

    return (
      <div className="space-y-2">
        <div className="border border-violet-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-violet-100/60 border-b border-violet-200">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle2 className="w-4 h-4 text-violet-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-violet-800">{totalCount} Felder erkannt</span>
              <span className="text-[10px] font-medium text-violet-500 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                {sourceLabel}
              </span>
              {confidence && (
                <span className={`text-[10px] font-medium ${confStyle.text}`}>
                  · Konfidenz {confStyle.label}{confidence.score != null ? ` ${confidence.score}/100` : ''}
                </span>
              )}
            </div>
            <button type="button" onClick={reset} className="text-gray-400 hover:text-gray-600 text-xs ml-2">✕</button>
          </div>

          {confidence?.summary && (
            <p className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[10px] text-gray-500 italic leading-snug">
              {confidence.summary}
            </p>
          )}

          {/* Fields */}
          <div className="px-3 py-2">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-[11px] text-gray-500">{checkedCount}/{totalCount} ausgewählt</span>
              <button type="button" onClick={() => toggleAll(true)}  className="text-[11px] text-violet-600 hover:underline">Alle</button>
              <button type="button" onClick={() => toggleAll(false)} className="text-[11px] text-gray-400 hover:underline">Keine</button>
            </div>

            <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
              {fields.map(k => {
                const val     = extracted[k];
                const display = Array.isArray(val) ? val.join(', ') : String(val);
                return (
                  <label key={k} className="flex items-start gap-1.5 cursor-pointer py-0.5">
                    <input type="checkbox" checked={!!selected[k]}
                      onChange={() => setSelected(p => ({ ...p, [k]: !p[k] }))}
                      className="mt-0.5 w-3.5 h-3.5 text-violet-600 border-gray-300 rounded flex-shrink-0" />
                    <span className="text-[11px] text-gray-500 leading-tight flex-shrink-0 min-w-[140px]">
                      {KI_FIELD_LABELS[k]}
                    </span>
                    <span className="text-[11px] font-medium text-gray-800 leading-tight truncate" title={display}>
                      {display}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex gap-2 mt-3">
              <button type="button" onClick={handleApply} disabled={checkedCount === 0}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors">
                <Check className="w-3.5 h-3.5" />
                {checkedCount} Felder übernehmen
              </button>
              <button type="button" onClick={reset}
                className="px-3 py-2 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition-colors">
                Abbrechen
              </button>
            </div>
          </div>
        </div>

        {/* Doc zone stays available below preview when only images were analyzed */}
        {previewSource === 'image' && DocZone}
      </div>
    );
  }

  // ── Idle / loading state ───────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* Image zone — spinner while loading, drop zone otherwise */}
      {imgLoading ? (
        <div className="flex items-center gap-2.5 px-3 py-3 border border-violet-200 rounded-xl bg-violet-50/50 text-xs text-violet-700">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span className="font-medium">{imgMsg}</span>
        </div>
      ) : (
        <>
          {imgError && (
            <div className="flex items-start gap-2 px-3 py-2.5 border border-red-200 rounded-xl bg-red-50 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{imgError}</span>
              <button type="button" onClick={() => setImgError('')} className="ml-auto text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
            </div>
          )}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver('img'); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => { e.preventDefault(); setDragOver(null); processFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => imgInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center select-none
              ${dragOver === 'img'
                ? 'border-violet-400 bg-violet-50 scale-[1.01]'
                : 'border-violet-200 bg-violet-50/20 hover:border-violet-300 hover:bg-violet-50/40'}`}
          >
            <ImageIcon className={`w-7 h-7 ${dragOver === 'img' ? 'text-violet-400' : 'text-violet-300'}`} />
            <div>
              <p className={`text-sm font-semibold ${dragOver === 'img' ? 'text-violet-700' : 'text-violet-600'}`}>
                {dragOver === 'img' ? 'Loslassen zum Analysieren' : 'Mit KI ausfüllen'}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Bild(er) hochladen → Felder werden vorausgefüllt</p>
            </div>
            <input ref={imgInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/*" className="hidden"
              onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) processFiles(fs); e.target.value = ''; }} />
          </div>
        </>
      )}

      {/* Doc zone — always visible, shows inline spinner when processing */}
      {DocZone}
    </div>
  );
}

const PRINCIPLES = {
  consistency: ['Nachwachsende Rohstoffe', 'Recycelte Rohstoffe', 'Recyclinggerecht', 'Kompostierbar'],
  efficiency: ['Schadstofffrei', 'Naturraumerhaltend', 'Faire Materialgewinnung', 'Regional'],
};

function toggleInArray(arr, value) {
  const set = new Set(arr || []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set);
}

const initialFormState = {
  name: '',
  category: '',
  description: '',

  // Extended details
  short_description: '',
  origin_acquisition: '',
  use_processing: '',
  use_indoor_outdoor: '',
  use_limitations: '',
  similar_material_ids_input: '',

  // Technical data
  tech_thicknesses: '',
  tech_dimensions: '',
  tech_density: '',
  tech_flammability: '',
  tech_acoustics: '',
  tech_thermal_insulation: '',
  tech_compressive_strength: '',
  tech_tensile_strength: '',

  // Sustainability
  sust_climate_description: '',
  gwp_total_value: '',
  gwp_total_unit: 'kg CO2e',
  recyclate_content: '',
  recycling_percentage: '',
  voc_values: '',
  circularity: '',
  human_health: '',
  processing_sustainability: '',
  principles_sufficiency: [],
  principles_consistency: [],
  principles_efficiency: [],

  // Origin
  origin_source: '',
  previous_use: '',

  // Application limits
  use_indoor: true,
  use_outdoor: false,
  use_where: '',
  use_not_suitable: '',

  // Certifications
  cert_epd: false,
  cert_cradle_to_cradle: false,
  cert_fsc_pefc: false,

  // Further info / appendix
  env_links_input: '',
  appendix: '',

  manufacturer: '',
  sku: '',
  gwp_value: '',
  gwp_unit: 'kg CO2e/kg',
  recyclable: false,
  recycled_content: '',
  biodegradable: false,
  certifications: '',
  source_url: '',
  notes: '',
  contact_person: '',

  // Location
  latitude: '51.0532575',
  longitude: '12.1287658',
  location_name: '',
  address: '',

  // EPD / Ökobilanz-Grunddaten (EN 15804)
  declared_unit: '',
  gwp_fossil: '',
  gwp_biogenic: '',
  gwp_luluc: '',
  adp_fossil: '',
  adp_elements: '',
  lifecycle_scope: '',
  water_consumption: '',
  odp: '',
  ap: '',
  ep_terrestrial: '',
  ep_freshwater: '',
  ep_marine: '',
  pocp: '',
  hwd: '',
  nhwd: '',
  rwd: '',
  pere: '',
  penre: '',
  perm: '',
  idemat_process_id: null,

  // Visibility / sharing
  visibility: 'private',
  share_actor_id: '',
  shared_actor_ids: [],
  selectedUsers: [],
  actor_members_can_edit: false,
};

// ── Offer accordion helpers ───────────────────────────────────────────────────
const OFFER_TRANSACTION_OPTIONS = ['Verkauf', 'Vermietung', 'Leasing', 'Tausch', 'Kooperation'];
const OFFER_LOGISTICS_OPTIONS = ['Selbstabholung', 'Lieferung möglich'];
const OFFER_VALUE_TYPES = [
  { value: '', label: 'Bitte wählen' },
  { value: 'swap', label: 'Tausch' },
  { value: 'free', label: 'Kostenlos' },
  { value: 'loan', label: 'Leihe' },
  { value: 'negotiable', label: 'Verhandelbar' },
  { value: 'fixed', label: 'Festpreis' },
];
const OFFER_CONDITIONS = [
  { value: '', label: 'Zustand wählen' },
  { value: 'new', label: 'Neu' },
  { value: 'used', label: 'Gebraucht' },
  { value: 'damaged', label: 'Beschädigt' },
  { value: 'tested', label: 'Geprüft' },
];

function OfferCheckboxGroup({ options, value = [], onChange }) {
  const toggle = (opt) => {
    const s = new Set(value);
    s.has(opt) ? s.delete(opt) : s.add(opt);
    onChange(Array.from(s));
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <label key={opt} className={`flex items-center gap-1 px-2.5 py-1 rounded-full border cursor-pointer text-xs transition-colors
          ${value.includes(opt) ? 'bg-primary-50 border-primary-400 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} className="sr-only" />
          {opt}
        </label>
      ))}
    </div>
  );
}

function OfferSectionTitle({ children }) {
  return <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2 pb-1">{children}</p>;
}

const OFFER_BLANK = {
  quantity: '', unit: 'kg', condition: '',
  is_available: true, is_immediately_available: true, available_from_date: '',
  min_order_quantity: '', is_regularly_available: false,
  regular_availability_period: '', regular_availability_type: '',
  season_from: '', season_to: '',
  value_type: '', price: '', price_unit: '€', is_negotiable: false,
  transaction_options: [], logistics_options: [], transport_costs: '', is_mobile: false,
  availability_mode: 'negotiable', external_url: '', swap_possible: false, swap_against: '',
  notes: '',
  useMatLocation: true, location_name: '', address: '', latitude: '', longitude: '',
};

function offerFromRaw(o) {
  let txOpts = o.transaction_options;
  let logOpts = o.logistics_options;
  try { txOpts = txOpts ? JSON.parse(txOpts) : []; } catch { txOpts = []; }
  try { logOpts = logOpts ? JSON.parse(logOpts) : []; } catch { logOpts = []; }
  const hasOwnGeo = o.latitude && o.longitude;
  return {
    quantity: o.quantity || '', unit: o.unit || 'kg', condition: o.condition || '',
    is_available: o.is_available ?? true,
    is_immediately_available: o.is_immediately_available ?? true,
    available_from_date: o.available_from_date || '',
    min_order_quantity: o.min_order_quantity || '',
    is_regularly_available: Boolean(o.is_regularly_available),
    regular_availability_period: o.regular_availability_period || '',
    regular_availability_type: o.regular_availability_type || '',
    season_from: o.season_from || '', season_to: o.season_to || '',
    value_type: o.value_type || '', price: o.price || '', price_unit: o.price_unit || '€',
    is_negotiable: Boolean(o.is_negotiable),
    transaction_options: txOpts, logistics_options: logOpts,
    transport_costs: o.transport_costs || '', is_mobile: Boolean(o.is_mobile),
    availability_mode: o.availability_mode || 'negotiable',
    external_url: o.external_url || '',
    swap_possible: Boolean(o.swap_possible), swap_against: o.swap_against || '',
    notes: o.notes || '',
    useMatLocation: !hasOwnGeo,
    location_name: o.location_name || '', address: o.address || '',
    latitude: o.latitude || '', longitude: o.longitude || '',
  };
}

function OfferFormFields({ d, upd, materialId, isNew = false }) {
  return (
    <div className="space-y-3">
      {/* Menge + Einheit */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Menge *</label>
          <input type="number" step="0.01" min="0" value={d.quantity}
            onChange={e => upd({ quantity: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            placeholder="z.B. 50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Einheit</label>
          <select value={d.unit} onChange={e => upd({ unit: e.target.value })}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
            {['kg','g','t','m','m²','m³','Stück','Liter'].map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Zustand */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Zustand</label>
        <select value={d.condition} onChange={e => upd({ condition: e.target.value })}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
          {OFFER_CONDITIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Standort */}
      <div>
        <OfferSectionTitle>📍 Standort</OfferSectionTitle>
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input type="checkbox" checked={d.useMatLocation}
            onChange={e => upd({ useMatLocation: e.target.checked })}
            className="w-4 h-4 rounded text-primary-500" />
          <span className="text-sm text-gray-700">Gleicher Standort wie das Material</span>
        </label>
        {!d.useMatLocation && (
          <LocationPicker
            value={{ location_name: d.location_name, address: d.address, latitude: d.latitude, longitude: d.longitude }}
            onChange={v => upd({ location_name: v.location_name ?? d.location_name, address: v.address ?? d.address, latitude: v.latitude, longitude: v.longitude })}
          />
        )}
      </div>

      {/* Verfügbarkeit */}
      <div>
        <OfferSectionTitle>📅 Verfügbarkeit</OfferSectionTitle>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={d.is_available}
              onChange={e => upd({ is_available: e.target.checked })}
              className="w-4 h-4 rounded text-primary-500" />
            <span className="text-sm text-gray-700">Global verfügbar</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={d.is_immediately_available}
              onChange={e => upd({ is_immediately_available: e.target.checked })}
              className="w-4 h-4 rounded text-primary-500" />
            <span className="text-sm text-gray-700">Sofort verfügbar</span>
          </label>
          {!d.is_immediately_available && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Verfügbar ab</label>
              <input type="date" value={d.available_from_date}
                onChange={e => upd({ available_from_date: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mindestabnahmemenge</label>
            <input type="number" step="0.01" value={d.min_order_quantity}
              onChange={e => upd({ min_order_quantity: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Optional" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={d.is_regularly_available}
              onChange={e => upd({ is_regularly_available: e.target.checked })}
              className="w-4 h-4 rounded text-primary-500" />
            <span className="text-sm text-gray-700">Regelmäßig verfügbar</span>
          </label>
          {d.is_regularly_available && (
            <div className="pl-6 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Zeitraum</label>
                <input type="text" value={d.regular_availability_period}
                  onChange={e => upd({ regular_availability_period: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="z.B. Quartal 1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Intervall</label>
                <select value={d.regular_availability_type}
                  onChange={e => upd({ regular_availability_type: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                  <option value="">Wählen</option>
                  <option value="monthly">Monatlich</option>
                  <option value="yearly">Jährlich</option>
                </select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Saison von</label>
              <input type="text" value={d.season_from}
                onChange={e => upd({ season_from: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="MM-TT" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Saison bis</label>
              <input type="text" value={d.season_to}
                onChange={e => upd({ season_to: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="MM-TT" />
            </div>
          </div>
        </div>
      </div>

      {/* Preisgestaltung */}
      <div>
        <OfferSectionTitle>💰 Preisgestaltung</OfferSectionTitle>
        <div className="space-y-2">
          <select value={d.value_type} onChange={e => upd({ value_type: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
            {OFFER_VALUE_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {d.value_type === 'fixed' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Preis</label>
                <input type="number" step="0.01" value={d.price}
                  onChange={e => upd({ price: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Einheit</label>
                <input type="text" value={d.price_unit}
                  onChange={e => upd({ price_unit: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="€" />
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={d.is_negotiable}
              onChange={e => upd({ is_negotiable: e.target.checked })}
              className="w-4 h-4 rounded text-primary-500" />
            <span className="text-sm text-gray-700">Preis verhandelbar</span>
          </label>
        </div>
      </div>

      {/* Abwicklung */}
      <div>
        <OfferSectionTitle>🔄 Abwicklung</OfferSectionTitle>
        <OfferCheckboxGroup options={OFFER_TRANSACTION_OPTIONS}
          value={d.transaction_options}
          onChange={v => upd({ transaction_options: v })} />
      </div>

      {/* Logistik */}
      <div>
        <OfferSectionTitle>🚚 Logistik</OfferSectionTitle>
        <OfferCheckboxGroup options={OFFER_LOGISTICS_OPTIONS}
          value={d.logistics_options}
          onChange={v => upd({ logistics_options: v })} />
        {d.logistics_options.includes('Lieferung möglich') && (
          <div className="mt-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Transportkosten</label>
            <input type="text" value={d.transport_costs}
              onChange={e => upd({ transport_costs: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="z.B. nach Vereinbarung" />
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer mt-2">
          <input type="checkbox" checked={d.is_mobile}
            onChange={e => upd({ is_mobile: e.target.checked })}
            className="w-4 h-4 rounded text-primary-500" />
          <span className="text-sm text-gray-700">Material ist mobil/transportierbar</span>
        </label>
      </div>

      {/* Angebotsmodus */}
      <div>
        <OfferSectionTitle>📋 Angebotsmodus</OfferSectionTitle>
        <div className="space-y-2">
          {[{ value: 'negotiable', label: 'Auf Anfrage' }, { value: 'external', label: 'Externer Link' }].map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={`avail_mode_${isNew ? 'new' : 'edit'}`}
                value={opt.value} checked={d.availability_mode === opt.value}
                onChange={() => upd({ availability_mode: opt.value })}
                className="w-4 h-4 text-primary-500" />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
          {d.availability_mode === 'external' && (
            <input type="url" value={d.external_url}
              onChange={e => upd({ external_url: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none ml-6"
              placeholder="https://…" />
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={d.swap_possible}
              onChange={e => upd({ swap_possible: e.target.checked })}
              className="w-4 h-4 rounded text-primary-500" />
            <span className="text-sm text-gray-700">Tausch möglich</span>
          </label>
          {d.swap_possible && (
            <input type="text" value={d.swap_against}
              onChange={e => upd({ swap_against: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none ml-6"
              placeholder="Tausch gegen…" />
          )}
        </div>
      </div>

      {/* Notizen */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notizen</label>
        <textarea rows={2} value={d.notes}
          onChange={e => upd({ notes: e.target.value })}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
          placeholder="Optionale Hinweise…" />
      </div>
    </div>
  );
}

const NEW_OFFER_BLANK = { ...OFFER_BLANK };

function OfferAvailabilitySection({ materialId }) {
  const { isAuthenticated } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', { material_id: materialId }],
    queryFn: () => inventoryService.getAll({ material_id: materialId }),
    enabled: !!materialId,
  });
  const offers = Array.isArray(data) ? data : (data?.data || []);

  const [openId, setOpenId] = useState(null);
  const [offerData, setOfferData] = useState({});
  const [newOffer, setNewOffer] = useState({ ...NEW_OFFER_BLANK });

  useEffect(() => {
    offers.forEach(o => {
      setOfferData(prev => {
        if (prev[o.id]) return prev;
        return { ...prev, [o.id]: offerFromRaw(o) };
      });
    });
  }, [offers]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_available }) => inventoryService.update(id, { is_available }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const saveDetailsMutation = useMutation({
    mutationFn: ({ id, payload }) => inventoryService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setOpenId(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload) => inventoryService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setNewOffer({ ...NEW_OFFER_BLANK });
      setOpenId(null);
    },
  });

  const handleAddClick = () => {
    if (!isAuthenticated) {
      openAuth({ tab: 'login', reason: 'Bitte melde dich an, um ein Angebot für dieses Material zu erstellen.' });
      return;
    }
    setOpenId(openId === 'new' ? null : 'new');
  };

  const buildPayload = (d) => ({
    quantity: parseFloat(d.quantity),
    unit: d.unit,
    condition: d.condition,
    is_available: d.is_available,
    is_immediately_available: d.is_immediately_available,
    available_from_date: d.available_from_date || null,
    min_order_quantity: d.min_order_quantity ? parseFloat(d.min_order_quantity) : null,
    is_regularly_available: d.is_regularly_available,
    regular_availability_period: d.regular_availability_period,
    regular_availability_type: d.regular_availability_type,
    season_from: d.season_from, season_to: d.season_to,
    value_type: d.value_type, price: d.price ? parseFloat(d.price) : null,
    price_unit: d.price_unit, is_negotiable: d.is_negotiable,
    transaction_options: JSON.stringify(d.transaction_options),
    logistics_options: JSON.stringify(d.logistics_options),
    transport_costs: d.transport_costs, is_mobile: d.is_mobile,
    availability_mode: d.availability_mode, external_url: d.external_url,
    swap_possible: d.swap_possible, swap_against: d.swap_against,
    notes: d.notes,
    latitude: d.useMatLocation ? null : (d.latitude ? parseFloat(d.latitude) : null),
    longitude: d.useMatLocation ? null : (d.longitude ? parseFloat(d.longitude) : null),
    location_name: d.useMatLocation ? '' : d.location_name,
    address: d.useMatLocation ? '' : d.address,
  });

  if (isLoading) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="px-3 py-2.5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide shrink-0">Angebote</span>

        {offers.map(offer => {
          const isOpen = openId === offer.id;
          return (
            <div key={offer.id} className="flex items-center gap-1">
              <button
                type="button"
                disabled={toggleMutation.isPending}
                onClick={() => toggleMutation.mutate({ id: offer.id, is_available: !(offer.is_available == 1) })}
                title={offer.is_available == 1 ? 'Als abgeholt markieren' : 'Als verfügbar markieren'}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  offer.is_available == 1
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
                    : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                }`}
              >
                <span>{offer.is_available == 1 ? '✓' : '✗'}</span>
                <span>{offer.quantity} {offer.unit}</span>
                <span>{offer.is_available == 1 ? '· Verfügbar' : '· Abgeholt'}</span>
              </button>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : offer.id)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-all ${
                  isOpen ? 'bg-amber-200 border-amber-300 text-amber-900' : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Detailangaben
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAddClick}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-all ${
            openId === 'new' ? 'bg-amber-200 border-amber-300 text-amber-900' : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-100'
          }`}
        >
          <Plus className="w-3 h-3" />
          Angebot
        </button>
      </div>

      {/* Existing offer accordions */}
      {offers.map(offer => {
        if (openId !== offer.id) return null;
        const d = offerData[offer.id] || offerFromRaw(offer);
        const upd = (patch) => setOfferData(prev => ({ ...prev, [offer.id]: { ...prev[offer.id], ...patch } }));
        return (
          <div key={`det-${offer.id}`} className="border-t border-amber-200 px-3 py-3 bg-white/70">
            <OfferFormFields d={d} upd={upd} materialId={materialId} />
            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-amber-100">
              <button type="button" onClick={() => setOpenId(null)}
                className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Abbrechen
              </button>
              <button type="button" disabled={saveDetailsMutation.isPending}
                onClick={() => saveDetailsMutation.mutate({ id: offer.id, payload: buildPayload(d) })}
                className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
                {saveDetailsMutation.isPending ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          </div>
        );
      })}

      {/* New offer accordion */}
      {openId === 'new' && (
        <div className="border-t border-amber-200 px-3 py-3 bg-white/70">
          <p className="text-xs font-semibold text-amber-800 mb-3">Neues Angebot</p>
          <OfferFormFields d={newOffer} upd={(p) => setNewOffer(n => ({ ...n, ...p }))} materialId={materialId} isNew />
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-amber-100">
            <button type="button" onClick={() => { setOpenId(null); setNewOffer({ ...NEW_OFFER_BLANK }); }}
              className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Abbrechen
            </button>
            <button type="button" disabled={createMutation.isPending || !newOffer.quantity}
              onClick={() => createMutation.mutate({ material_id: materialId, ...buildPayload(newOffer) })}
              className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50">
              {createMutation.isPending ? 'Erstelle…' : 'Angebot erstellen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MaterialForm({ material, onClose, enableOfferOnCreate = false, initialMode }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useT();
  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState('');
  const scrollContainerRef = useRef(null);
  const [savedId, setSavedId] = useState(null);
  const [localImages, setLocalImages] = useState([]);
  const [localFiles, setLocalFiles] = useState([]);
  const [pendingImages, setPendingImages] = useState([]); // Files queued before save
  const [pendingFiles, setPendingFiles] = useState([]);   // Files queued before save
  const pendingImagesRef = useRef([]);
  const pendingFilesRef = useRef([]);
  const pendingActorIdsRef = useRef([]);

  // Images queued for upload in offer-only mode (uploaded after offer is created)
  const [offerPendingImages, setOfferPendingImages] = useState([]);
  const offerPendingImagesRef = useRef([]);

  // Images queued for upload in gesuch mode (uploaded after gesuch is created)
  const [gesuchPendingImages, setGesuchPendingImages] = useState([]);
  const gesuchPendingImagesRef = useRef([]);

  // Optional: create a material offer (inventory entry) right after creating the material
  const [createOffer, setCreateOffer] = useState(false);
  const [offerData, setOfferData] = useState({
    quantity: '',
    unit: 'kg',
    same_as_material: false,
    location_name: '',
    address: '',
    latitude: null,
    longitude: null,
    is_available: true,
    available_for_gift: false,
    swap_possible: false,
    is_negotiable: false,
    external_url: '',
    show_external: false,
    notes: '',
  });

  const [actorIds, setActorIds] = useState(['']); // list of selected actor IDs (empty string = unset slot)

  // Mode toggle: 'material' = full material creation, 'offer-only' = just create an inventory offer, 'gesuch' = wanted request
  const [mode, setMode] = useState(initialMode || 'material');
  const [offerMaterialId, setOfferMaterialId] = useState('');
  const [gesuchMaterialId, setGesuchMaterialId] = useState('');
  const [gesuchMode, setGesuchMode] = useState('existing'); // 'existing' | 'new'
  const [newMaterialData, setNewMaterialData] = useState({ name: '', category: '' });
  const [gesuchData, setGesuchData] = useState({
    quantity: '',
    unit: 'kg',
    notes: '',
    location_name: '',
    address: '',
    latitude: null,
    longitude: null,
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['material-categories'],
    queryFn: materialService.getCategories,
  });

  const { data: allActors = [] } = useQuery({
    queryKey: ['actors'],
    queryFn: () => actorService.getAll(),
    select: (d) => (Array.isArray(d) ? d : d?.data || []),
  });

  const { data: allMaterials = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materialService.getAll(),
    select: (d) => Array.isArray(d) ? d : (d?.data || []),
    enabled: !material, // only needed in create mode
  });

  useEffect(() => {
    if (material?.id) {
      materialActorService.getActors(material.id).then((actors) => {
        setActorIds(actors.length > 0 ? actors.map((a) => a.id) : ['']);
      }).catch(() => {});
    }
  }, [material?.id]);

  useEffect(() => {
    if (material) {
      setLocalImages(material.images || []);
      setLocalFiles(material.files || []);
      const similarIds = safeJsonParse(material.similar_material_ids, []);
      const envLinks = safeJsonParse(material.env_links, []);
      const envLines = Array.isArray(envLinks)
        ? envLinks
            .map((l) => (typeof l === 'string' ? l : l?.url || ''))
            .filter(Boolean)
        : [];

      setFormData({
        name: material.name || '',
        category: material.category || '',
        description: material.description || '',

        short_description: material.short_description || '',
        origin_acquisition: material.origin_acquisition || '',
        use_processing: material.use_processing || '',
        use_indoor_outdoor: material.use_indoor_outdoor || '',
        use_limitations: material.use_limitations || '',
        similar_material_ids_input: Array.isArray(similarIds) ? similarIds.join(', ') : '',

        tech_thicknesses: material.tech_thicknesses || '',
        tech_dimensions: material.tech_dimensions || '',
        tech_density: material.tech_density || '',
        tech_flammability: material.tech_flammability || '',
        tech_acoustics: material.tech_acoustics || '',
        tech_thermal_insulation: material.tech_thermal_insulation || '',
        tech_compressive_strength: material.tech_compressive_strength || '',
        tech_tensile_strength: material.tech_tensile_strength || '',

        sust_climate_description: material.sust_climate_description || '',
        gwp_total_value: material.gwp_total_value ?? '',
        gwp_total_unit: material.gwp_total_unit || 'kg CO2e',
        recyclate_content: material.recyclate_content ?? '',
        recycling_percentage: material.recycling_percentage ?? '',
        voc_values: material.voc_values || '',
        circularity: material.circularity || '',
        human_health: material.human_health || '',
        processing_sustainability: material.processing_sustainability || '',
        principles_sufficiency: safeJsonParse(material.principles_sufficiency, []),
        principles_consistency: safeJsonParse(material.principles_consistency, []),
        principles_efficiency: safeJsonParse(material.principles_efficiency, []),

        origin_source: material.origin_source || '',
        previous_use: material.previous_use || '',
        use_indoor: material.use_indoor !== undefined ? Boolean(material.use_indoor) : true,
        use_outdoor: Boolean(material.use_outdoor),
        use_where: material.use_where || '',
        use_not_suitable: material.use_not_suitable || '',

        cert_epd: Boolean(material.cert_epd),
        cert_cradle_to_cradle: Boolean(material.cert_cradle_to_cradle),
        cert_fsc_pefc: Boolean(material.cert_fsc_pefc),

        env_links_input: envLines.join('\n'),
        appendix: material.appendix || '',

        manufacturer: material.manufacturer || '',
        sku: material.sku || '',
        gwp_value: material.gwp_value || '',
        gwp_unit: material.gwp_unit || 'kg CO2e/kg',
        recyclable: Boolean(material.recyclable),
        recycled_content: material.recycled_content || '',
        biodegradable: Boolean(material.biodegradable),
        certifications: material.certifications || '',
        source_url: material.source_url || '',
        notes: material.notes || '',
        contact_person: material.contact_person || '',

        latitude: material.latitude ?? '',
        longitude: material.longitude ?? '',
        location_name: material.location_name || '',
        address: material.address || '',

        declared_unit: material.declared_unit || '',
        gwp_fossil: material.gwp_fossil ?? '',
        gwp_biogenic: material.gwp_biogenic ?? '',
        gwp_luluc: material.gwp_luluc ?? '',
        adp_fossil: material.adp_fossil ?? '',
        adp_elements: material.adp_elements ?? '',
        lifecycle_scope: material.lifecycle_scope || '',
        water_consumption: material.water_consumption ?? '',
        odp: material.odp ?? '',
        ap: material.ap ?? '',
        ep_terrestrial: material.ep_terrestrial ?? '',
        ep_freshwater: material.ep_freshwater ?? '',
        ep_marine: material.ep_marine ?? '',
        pocp: material.pocp ?? '',
        hwd: material.hwd ?? '',
        nhwd: material.nhwd ?? '',
        rwd: material.rwd ?? '',
        pere: material.pere ?? '',
        penre: material.penre ?? '',
        perm: material.perm ?? '',
        idemat_process_id: material.idemat_process_id || null,

        visibility: material.visibility || 'private',
        share_actor_id: material.share_actor_id || '',
        shared_actor_ids: material.shared_actor_ids || [],
        selectedUsers: [],
        actor_members_can_edit: Boolean(material.actor_members_can_edit),
      });
      // load existing shares for selectedUsers display
      if (material.visibility === 'selectedUsers') {
        import('../../services/api').then(({ default: api }) =>
          api.get(`/shares/material/${material.id}`).then(r =>
            setFormData(f => ({ ...f, selectedUsers: (r.data || []).map(s => ({
              id: s.shared_with_user_id, email: s.email,
              first_name: s.first_name, last_name: s.last_name,
            })) }))
          ).catch(() => {})
        );
      }
    }
  }, [material]);

  const createMutation = useMutation({
    mutationFn: materialService.create,
    onSuccess: async (created) => {
      setSavedId(created?.id || null);
      setLocalImages(created?.images || []);

      // Upload any images/files that were selected before saving (use refs to avoid stale closure)
      const imgQueue = pendingImagesRef.current;
      const fileQueue = pendingFilesRef.current;
      if (created?.id && (imgQueue.length > 0 || fileQueue.length > 0)) {
        const { materialImageService } = await import('../../services/materialService');
        if (imgQueue.length > 0) {
          const uploaded = await materialImageService.upload(created.id, imgQueue, { sort_start: 0 });
          setLocalImages(Array.isArray(uploaded) ? uploaded : [uploaded]);
          setPendingImages([]);
          pendingImagesRef.current = [];
        }
        if (fileQueue.length > 0) {
          const uploaded = await materialImageService.uploadFiles(created.id, fileQueue);
          setLocalFiles(Array.isArray(uploaded) ? uploaded : [uploaded]);
          setPendingFiles([]);
          pendingFilesRef.current = [];
        }
      }

      // Save actor associations
      if (created?.id && pendingActorIdsRef.current.length > 0) {
        materialActorService.setActors(created.id, pendingActorIdsRef.current).catch(() => {});
        pendingActorIdsRef.current = [];
      }
      const sharedActorIds = formData.shared_actor_ids || [];
      if (created?.id && sharedActorIds.length > 0) {
        import('../../services/api').then(({ default: api }) =>
          api.put(`/shares/material/${created.id}/actors`, { actor_ids: sharedActorIds })
        ).catch(() => {});
      }
      const selectedUsers = formData.selectedUsers || [];
      if (created?.id && selectedUsers.length > 0) {
        import('../../services/api').then(({ default: api }) => {
          Promise.all(selectedUsers.map(u =>
            api.post(`/shares/material/${created.id}`, { email: u.email, access_level: 'view' })
          )).catch(() => {});
        });
      }

      try {
        if (enableOfferOnCreate && createOffer && created?.id) {
          const submitOffer = {
            material_id: created.id,
            quantity: offerData.quantity ? parseFloat(offerData.quantity) : 0,
            unit: offerData.unit,
            location_name: offerData.location_name,
            address: offerData.address,
            latitude: offerData.latitude ? parseFloat(offerData.latitude) : null,
            longitude: offerData.longitude ? parseFloat(offerData.longitude) : null,
            is_available: Boolean(offerData.is_available),
            available_for_gift: Boolean(offerData.available_for_gift),
            swap_possible: Boolean(offerData.swap_possible),
            is_negotiable: Boolean(offerData.is_negotiable),
            external_url: offerData.external_url || null,
            notes: offerData.notes,
          };
          await inventoryService.create(submitOffer);
          queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['my-inventory'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['marketplace-inventory'], exact: false });
        }
      } finally {
        queryClient.invalidateQueries({ queryKey: ['materials'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['material-categories'], exact: false });
        toast.success(t('materialForm.toastCreated'));
      }
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || t('materialForm.errorCreate');
      setError(msg);
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => materialService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['material-categories'] });
      // sync selectedUsers shares
      const selUsers = formData.selectedUsers || [];
      if (formData.visibility === 'selectedUsers' && selUsers.length > 0) {
        import('../../services/api').then(({ default: api }) => {
          Promise.all(selUsers.map(u =>
            api.post(`/shares/material/${id}`, { email: u.email, access_level: 'view' })
          )).catch(() => {});
        });
      }
      toast.success(t('materialForm.toastSaved'));
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || t('materialForm.errorUpdate');
      setError(msg);
      toast.error(msg);
    },
  });

  const offerOnlyMutation = useMutation({
    mutationFn: () => inventoryService.create({
      material_id: offerMaterialId,
      quantity: offerData.quantity ? parseFloat(offerData.quantity) : 0,
      unit: offerData.unit,
      location_name: offerData.location_name,
      address: offerData.address,
      latitude: offerData.latitude ? parseFloat(offerData.latitude) : null,
      longitude: offerData.longitude ? parseFloat(offerData.longitude) : null,
      is_available: Boolean(offerData.is_available),
      available_for_gift: Boolean(offerData.available_for_gift),
      swap_possible: Boolean(offerData.swap_possible),
      is_negotiable: Boolean(offerData.is_negotiable),
      external_url: offerData.external_url || null,
      notes: offerData.notes,
    }),
    onSuccess: async (created) => {
      if (created?.id && offerPendingImagesRef.current.length > 0) {
        try {
          await inventoryService.uploadImages(created.id, offerPendingImagesRef.current);
          offerPendingImagesRef.current = [];
          setOfferPendingImages([]);
        } catch { /* non-critical */ }
      }
      queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['marketplace-inventory'], exact: false });
      toast.success(t('materialForm.toastOfferCreated'));
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || t('materialForm.errorOffer');
      setError(msg);
      toast.error(msg);
    },
  });

  const gesuchMutation = useMutation({
    mutationFn: async () => {
      let matId = gesuchMaterialId;
      if (gesuchMode === 'new') {
        const created = await materialService.create({
          name: newMaterialData.name.trim(),
          category: newMaterialData.category.trim(),
        });
        matId = created?.id || created?.data?.id;
      }
      return inventoryService.create({
        material_id: matId,
        quantity: gesuchData.quantity ? parseFloat(gesuchData.quantity) : 0,
        unit: gesuchData.unit,
        location_name: gesuchData.location_name,
        address: gesuchData.address,
        latitude: gesuchData.latitude != null ? parseFloat(gesuchData.latitude) : null,
        longitude: gesuchData.longitude != null ? parseFloat(gesuchData.longitude) : null,
        notes: gesuchData.notes,
        is_available: true,
        entry_type: 'gesuch',
      });
    },
    onSuccess: async (created) => {
      if (created?.id && gesuchPendingImagesRef.current.length > 0) {
        try {
          await inventoryService.uploadImages(created.id, gesuchPendingImagesRef.current);
          gesuchPendingImagesRef.current = [];
          setGesuchPendingImages([]);
        } catch { /* non-critical */ }
      }
      queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['gesuche'], exact: false });
      if (gesuchMode === 'new') {
        queryClient.invalidateQueries({ queryKey: ['materials'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['material-categories'], exact: false });
      }
      toast.success(t('materialForm.toastGesuchCreated'));
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || t('materialForm.errorGesuch');
      setError(msg);
      toast.error(msg);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'gesuch') {
      if (gesuchMode === 'existing' && !gesuchMaterialId) { setError(t('materialForm.errorChooseMaterial')); return; }
      if (gesuchMode === 'new' && !newMaterialData.name.trim()) { setError(t('materialForm.errorEnterName')); return; }
      gesuchMutation.mutate();
      return;
    }

    if (mode === 'offer-only') {
      if (!offerMaterialId) { setError(t('materialForm.errorChooseMaterial')); return; }
      offerOnlyMutation.mutate();
      return;
    }

    if (!formData.name?.trim()) {
      setError(t('materialForm.errorEnterName'));
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!formData.location_name?.trim() && !formData.address?.trim()) {
      setError(t('materialForm.errorEnterLocation'));
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const similarIds = (formData.similar_material_ids_input || '')
      .split(/[\n,]/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const envLinks = (formData.env_links_input || '')
      .split(/\n/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((url) => ({ url }));

    // Parse EPD numeric components
    const epdFossil   = formData.gwp_fossil   !== '' ? parseFloat(formData.gwp_fossil)   : null;
    const epdBiogenic = formData.gwp_biogenic  !== '' ? parseFloat(formData.gwp_biogenic)  : null;
    const epdLuluc    = formData.gwp_luluc     !== '' ? parseFloat(formData.gwp_luluc)     : null;
    // If at least one GWP component is filled, derive gwp_value as their sum (zero-fill missing ones)
    const hasEpdGwp = epdFossil !== null || epdBiogenic !== null || epdLuluc !== null;
    const derivedGwpValue = hasEpdGwp
      ? (epdFossil ?? 0) + (epdBiogenic ?? 0) + (epdLuluc ?? 0)
      : (formData.gwp_value !== '' ? parseFloat(formData.gwp_value) : null);

    const submitData = {
      ...formData,
      category: formData.category?.trim(),

      // normalize numeric fields
      gwp_value: derivedGwpValue,
      gwp_total_value: formData.gwp_total_value !== '' ? parseFloat(formData.gwp_total_value) : null,
      recyclate_content: formData.recyclate_content !== '' ? parseFloat(formData.recyclate_content) : null,
      recycling_percentage: formData.recycling_percentage !== '' ? parseFloat(formData.recycling_percentage) : null,
      recycled_content: formData.recycled_content ? parseFloat(formData.recycled_content) : null,
      latitude: formData.latitude !== '' ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude !== '' ? parseFloat(formData.longitude) : null,

      // EPD numeric fields
      gwp_fossil: epdFossil,
      gwp_biogenic: epdBiogenic,
      gwp_luluc: epdLuluc,
      adp_fossil:        formData.adp_fossil        !== '' ? parseFloat(formData.adp_fossil)        : null,
      adp_elements:      formData.adp_elements       !== '' ? parseFloat(formData.adp_elements)       : null,
      water_consumption: formData.water_consumption  !== '' ? parseFloat(formData.water_consumption)  : null,
      odp:               formData.odp               !== '' ? parseFloat(formData.odp)               : null,
      ap:                formData.ap                !== '' ? parseFloat(formData.ap)                : null,
      ep_terrestrial:    formData.ep_terrestrial    !== '' ? parseFloat(formData.ep_terrestrial)    : null,
      ep_freshwater:     formData.ep_freshwater     !== '' ? parseFloat(formData.ep_freshwater)     : null,
      ep_marine:         formData.ep_marine         !== '' ? parseFloat(formData.ep_marine)         : null,
      pocp:              formData.pocp              !== '' ? parseFloat(formData.pocp)              : null,
      hwd:               formData.hwd               !== '' ? parseFloat(formData.hwd)               : null,
      nhwd:              formData.nhwd              !== '' ? parseFloat(formData.nhwd)              : null,
      rwd:               formData.rwd               !== '' ? parseFloat(formData.rwd)               : null,
      pere:              formData.pere              !== '' ? parseFloat(formData.pere)              : null,
      penre:             formData.penre             !== '' ? parseFloat(formData.penre)             : null,
      perm:              formData.perm              !== '' ? parseFloat(formData.perm)              : null,
      idemat_process_id: formData.idemat_process_id || null,

      // normalize arrays/JSON
      similar_material_ids: JSON.stringify(similarIds),
      env_links: JSON.stringify(envLinks),
      principles_sufficiency: JSON.stringify(formData.principles_sufficiency || []),
      principles_consistency: JSON.stringify(formData.principles_consistency || []),
      principles_efficiency: JSON.stringify(formData.principles_efficiency || []),
    };

    // Remove helper-only fields
    delete submitData.similar_material_ids_input;
    delete submitData.env_links_input;

    const validActorIds = actorIds.filter(Boolean);
    pendingActorIdsRef.current = validActorIds;

    if (material) {
      materialActorService.setActors(material.id, validActorIds).catch(() => {});
      updateMutation.mutate({ id: material.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleOfferChange = (e) => {
    const { name, value, type, checked } = e.target;
    setOfferData({
      ...offerData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending || offerOnlyMutation.isPending || gesuchMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div ref={scrollContainerRef} className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {material ? t('materialForm.titleEdit') : mode === 'offer-only' ? t('materialForm.titleOffer') : mode === 'gesuch' ? t('materialForm.titleGesuch') : t('materialForm.titleNew')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Offer availability quick-toggle — only when editing an existing material */}
          {material?.id && <OfferAvailabilitySection materialId={material.id} />}

          {/* Mode toggle — only when creating (not editing) */}
          {!material && (
            <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setMode('material')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  mode === 'material'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                {t('materialForm.tabMaterial')}
              </button>
              <button
                type="button"
                onClick={() => setMode('offer-only')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  mode === 'offer-only'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                {t('materialForm.tabOfferOnly')}
              </button>
              <button
                type="button"
                onClick={() => setMode('gesuch')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  mode === 'gesuch'
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                {t('materialForm.tabGesuch')}
              </button>
            </div>
          )}

          {mode === 'gesuch' ? (
            /* ── Gesuch mode ─────────────────────────────────────────────── */
            <div className="space-y-4">
              <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                {t('materialForm.gesuchHint')}
              </p>

              {/* Material: existing or new */}
              <div className="flex p-1 bg-gray-100 rounded-lg gap-1">
                <button type="button" onClick={() => setGesuchMode('existing')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${gesuchMode === 'existing' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t('materialForm.gesuchExisting')}
                </button>
                <button type="button" onClick={() => setGesuchMode('new')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${gesuchMode === 'new' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t('materialForm.gesuchNew')}
                </button>
              </div>

              {gesuchMode === 'existing' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.materialRequired')}</label>
                  <select
                    value={gesuchMaterialId}
                    onChange={e => setGesuchMaterialId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  >
                    <option value="">{t('materialForm.materialChoose')}</option>
                    {allMaterials
                      .slice()
                      .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name))
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.name}{m.category ? ` (${m.category})` : ''}</option>
                      ))
                    }
                  </select>
                </div>
              ) : (
                <div className="space-y-3 bg-purple-50 border border-purple-100 rounded-lg p-3">
                  <p className="text-xs text-purple-600">{t('materialForm.gesuchNewHint')}</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.gesuchName')}</label>
                    <input type="text" value={newMaterialData.name}
                      onChange={e => setNewMaterialData(d => ({ ...d, name: e.target.value }))}
                      placeholder="z.B. Ziegelbruch, Hanffaser, Altholz"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.category')}</label>
                    <select value={newMaterialData.category}
                      onChange={e => setNewMaterialData(d => ({ ...d, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
                      <option value="">{t('materialForm.categoryOptional')}</option>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Quantity + Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.gesuchQty')}</label>
                  <input type="number" step="0.01" value={gesuchData.quantity}
                    onChange={e => setGesuchData(d => ({ ...d, quantity: e.target.value }))}
                    placeholder="optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.unitLabel')}</label>
                  <select value={gesuchData.unit} onChange={e => setGesuchData(d => ({ ...d, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="m">m</option>
                    <option value="m2">m²</option>
                    <option value="m3">m³</option>
                    <option value="Stück">Stück</option>
                    <option value="Liter">Liter</option>
                    <option value="Palette">Palette</option>
                    <option value="unit">unit</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <LocationPicker
                label={t('materialForm.locationRegion')}
                value={{ location_name: gesuchData.location_name, address: gesuchData.address, latitude: gesuchData.latitude, longitude: gesuchData.longitude }}
                onChange={loc => setGesuchData(d => ({ ...d, location_name: loc.location_name, address: loc.address, latitude: loc.latitude, longitude: loc.longitude }))}
              />

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.gesuchDescLabel')}</label>
                <textarea value={gesuchData.notes} onChange={e => setGesuchData(d => ({ ...d, notes: e.target.value }))} rows={3}
                  placeholder={t('materialForm.gesuchDescPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none" />
              </div>

              {/* Images */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">{t('materialForm.gesuchImages')}</label>
                {gesuchPendingImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {gesuchPendingImages.map((file, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border border-dashed border-purple-300 bg-purple-50">
                        <img src={URL.createObjectURL(file)} className="w-full h-20 object-cover opacity-90" alt={file.name} />
                        <button type="button"
                          onClick={() => {
                            const updated = gesuchPendingImages.filter((_, j) => j !== i);
                            gesuchPendingImagesRef.current = updated;
                            setGesuchPendingImages(updated);
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center leading-none">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-purple-600 hover:text-purple-700 border border-dashed border-purple-300 rounded-lg px-3 py-1.5 bg-purple-50 hover:bg-purple-100 transition-colors">
                  <Upload className="w-3 h-3" />
                  {gesuchPendingImages.length > 0 ? t('materialForm.gesuchImagesMore') : t('materialForm.gesuchImagesUpload')}
                  <input type="file" multiple accept="image/*" className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      const updated = [...gesuchPendingImagesRef.current, ...files];
                      gesuchPendingImagesRef.current = updated;
                      setGesuchPendingImages(updated);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isPending || (gesuchMode === 'existing' && !gesuchMaterialId) || (gesuchMode === 'new' && !newMaterialData.name.trim())}
                className="w-full py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? t('materialForm.gesuchSubmitting') : t('materialForm.gesuchSubmit')}
              </button>
            </div>
          ) : mode === 'offer-only' ? (
            /* ── Offer-only mode ─────────────────────────────────────────── */
            <div className="space-y-4">
              <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                {t('materialForm.offerOnlyHint')}
              </p>

              {/* Material selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.materialRequired')}</label>
                <select
                  value={offerMaterialId}
                  onChange={e => setOfferMaterialId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">{t('materialForm.materialChoose')}</option>
                  {allMaterials
                    .slice()
                    .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name))
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.name}{m.category ? ` (${m.category})` : ''}</option>
                    ))
                  }
                </select>
              </div>

              {/* Quantity + Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.qtyRequired')}</label>
                  <input type="number" step="0.01" name="quantity" value={offerData.quantity}
                    onChange={handleOfferChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.unitRequired')}</label>
                  <select name="unit" value={offerData.unit} onChange={handleOfferChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="m">m</option>
                    <option value="m2">m²</option>
                    <option value="m3">m³</option>
                    <option value="Stück">Stück</option>
                    <option value="unit">unit</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !offerData.same_as_material;
                    const mat = allMaterials.find(m => m.id === offerMaterialId);
                    setOfferData(d => ({
                      ...d,
                      same_as_material: next,
                      location_name: next ? (mat?.location_name || '') : '',
                      address:        next ? (mat?.address || '')       : '',
                      latitude:       next ? (mat?.latitude  ?? null)   : null,
                      longitude:      next ? (mat?.longitude ?? null)   : null,
                    }));
                  }}
                  className={`mb-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    offerData.same_as_material
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                  }`}
                >
                  📍 {offerData.same_as_material ? 'Gleicher Standort wie Material' : 'Gleicher Standort wie Material?'}
                </button>
                {!offerData.same_as_material ? (
                  <LocationPicker
                    label={t('materialForm.locationName')}
                    value={{ location_name: offerData.location_name, address: offerData.address, latitude: offerData.latitude, longitude: offerData.longitude }}
                    onChange={loc => setOfferData(d => ({ ...d, location_name: loc.location_name, address: loc.address, latitude: loc.latitude, longitude: loc.longitude }))}
                  />
                ) : (
                  <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    {offerData.location_name || offerData.address || 'Kein Standort im Material hinterlegt'}
                  </p>
                )}
              </div>

              {/* Availability flags */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{t('materialForm.offerConditions')}</label>
                <div className="flex flex-wrap gap-2">
                  {/* Primary availability toggle — most important, shown first */}
                  <button
                    type="button"
                    title={offerData.is_available ? 'Material ist verfügbar — klicken um als abgeholt zu markieren' : 'Material wurde abgeholt — klicken um wieder als verfügbar zu markieren'}
                    onClick={() => setOfferData(d => ({ ...d, is_available: !d.is_available }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      offerData.is_available
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-gray-200 text-gray-500 border-gray-300 line-through'
                    }`}
                  >
                    {offerData.is_available ? '✓ Verfügbar' : 'Abgeholt'}
                  </button>
                  {[
                    { key: 'available_for_gift', label: '🎁 Zu Verschenken',    desc: 'Kostenlos abzugeben' },
                    { key: 'swap_possible',       label: '🔄 Tausch möglich',    desc: 'Gegen etwas tauschen' },
                    { key: 'is_negotiable',       label: '💬 Preis verhandelbar',desc: 'Preis auf Anfrage' },
                  ].map(({ key, label, desc }) => (
                    <button
                      key={key}
                      type="button"
                      title={desc}
                      onClick={() => setOfferData(d => ({ ...d, [key]: !d[key] }))}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        offerData[key]
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-primary-300'
                      }`}
                    >{label}</button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setOfferData(d => ({ ...d, show_external: !d.show_external, external_url: d.show_external ? '' : d.external_url }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      offerData.show_external
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                    }`}
                  >🔗 Extern inseriert</button>
                </div>
                {offerData.show_external && (
                  <input
                    type="url"
                    value={offerData.external_url}
                    onChange={e => setOfferData(d => ({ ...d, external_url: e.target.value }))}
                    placeholder="https://..."
                    className="mt-2 w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                  />
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
                <textarea name="notes" value={offerData.notes} onChange={handleOfferChange} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>

              {/* Image section */}
              {(() => {
                const mat = allMaterials.find(m => m.id === offerMaterialId);
                const coverPath = mat?.images?.[0]?.file_path;
                const coverUrl = coverPath ? `${API_BASE}${coverPath.replace(/^\./, '')}` : null;
                return (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">{t('materialForm.offerImageLabel')}</label>

                    {/* Standard: material cover image with disclaimer */}
                    {coverUrl && offerPendingImages.length === 0 && (
                      <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                        <img src={coverUrl} alt={mat.name} className="w-full h-36 object-cover opacity-90" />
                        <span className="absolute bottom-2 left-2 text-[10px] text-white bg-black/50 px-2 py-0.5 rounded-full">
                          {t('materialForm.offerImageDefault')}
                        </span>
                      </div>
                    )}
                    {!coverUrl && offerPendingImages.length === 0 && (
                      <p className="text-xs text-gray-400 italic">{t('materialForm.offerImageNone')}</p>
                    )}

                    {/* Queued custom images */}
                    {offerPendingImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {offerPendingImages.map((file, i) => (
                          <div key={i} className="relative rounded-lg overflow-hidden border border-dashed border-primary-300 bg-primary-50">
                            <img src={URL.createObjectURL(file)} className="w-full h-20 object-cover opacity-90" alt={file.name} />
                            <button type="button"
                              onClick={() => {
                                const updated = offerPendingImages.filter((_, j) => j !== i);
                                offerPendingImagesRef.current = updated;
                                setOfferPendingImages(updated);
                              }}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center leading-none">
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload trigger */}
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-primary-600 hover:text-primary-700 border border-dashed border-primary-300 rounded-lg px-3 py-1.5 bg-primary-50 hover:bg-primary-100 transition-colors">
                      <Upload className="w-3 h-3" />
                      {offerPendingImages.length > 0 ? t('materialForm.offerImagesMore') : t('materialForm.offerImagesUpload')}
                      <input type="file" multiple accept="image/*" className="hidden"
                        onChange={e => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          const updated = [...offerPendingImagesRef.current, ...files];
                          offerPendingImagesRef.current = updated;
                          setOfferPendingImages(updated);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* ── Material mode — new accordion UX ────────────────────────── */
            <>

          {/* ── Materialtyp-Chips (B+C: granular, kein Ausblenden) ─────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Materialtyp <span className="ml-1 text-[11px] font-normal text-gray-400 normal-case tracking-normal">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { val: 'primary',                    label: '🏭 Neuware',          sub: 'Herstellerware' },
                { val: 'secondary_rückbau',          label: '🏗 Rückbau',           sub: 'Aus Demontage' },
                { val: 'secondary_restposten',       label: '🧱 Produktionsrest',   sub: 'Aus Produktion' },
                { val: 'secondary_überschuss',       label: '📦 Überschuss',        sub: 'Lagerbestand' },
                { val: 'secondary_upcycling',        label: '♻ Upcycling',          sub: 'Aufgewertet' },
                { val: 'secondary_eigenproduktion',  label: '🛠 Eigenproduktion',   sub: 'Selbst hergestellt' },
              ].map(({ val, label, sub }) => (
                <button key={val} type="button"
                  onClick={() => setFormData(prev => ({ ...prev, origin_source: val }))}
                  className={`flex flex-col items-start px-3 py-2 rounded-xl border-2 text-left transition-all ${
                    formData.origin_source === val
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <span className="text-sm font-semibold text-gray-900">{label}</span>
                  <span className="text-[11px] text-gray-500">{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── KI-Assistent (unified drop zone) ─────────────────────────── */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-violet-700">✨ KI-Assistent</p>
            <KiDropZone
              onImages={(files) => {
                const updated = [...pendingImagesRef.current, ...files];
                pendingImagesRef.current = updated;
                setPendingImages(updated);
              }}
              onApply={(data) => {
                const VALID_SOURCES = ['primary','secondary_rückbau','secondary_restposten','secondary_überschuss','secondary_upcycling','secondary_eigenproduktion'];
                const SOURCE_MAP = { neu: 'primary', neuware: 'primary', rückbau: 'secondary_rückbau', abbruch: 'secondary_rückbau', demontage: 'secondary_rückbau', restposten: 'secondary_restposten', produktion: 'secondary_restposten', überschuss: 'secondary_überschuss', lager: 'secondary_überschuss', upcycling: 'secondary_upcycling', recycelt: 'secondary_upcycling', eigenproduktion: 'secondary_eigenproduktion', selbst: 'secondary_eigenproduktion' };
                const rawSrc = (data.origin_source || '').toLowerCase().trim();
                const origin_source = VALID_SOURCES.includes(rawSrc) ? rawSrc : (SOURCE_MAP[rawSrc] ?? '');
                setFormData(prev => ({
                  ...prev,
                  ...(data.name               && { name: data.name }),
                  ...(data.category           && { category: data.category }),
                  ...(data.description        && { description: data.description }),
                  ...(data.short_description  && { short_description: data.short_description }),
                  ...(data.origin_acquisition && { origin_acquisition: data.origin_acquisition }),
                  ...(data.use_processing     && { use_processing: data.use_processing }),
                  ...(data.use_where          && { use_where: data.use_where }),
                  ...(data.use_not_suitable   && { use_not_suitable: data.use_not_suitable }),
                  ...(data.previous_use       && { previous_use: data.previous_use }),
                  ...(data.use_indoor !== undefined && { use_indoor: data.use_indoor }),
                  ...(data.use_outdoor !== undefined && { use_outdoor: data.use_outdoor }),
                  ...(origin_source           && { origin_source }),
                  ...(data.tech_dimensions    && { tech_dimensions: data.tech_dimensions }),
                  ...(data.tech_density       && { tech_density: String(data.tech_density) }),
                  ...(data.tech_flammability  && { tech_flammability: data.tech_flammability }),
                  ...(data.tech_thermal_insulation    && { tech_thermal_insulation: String(data.tech_thermal_insulation) }),
                  ...(data.tech_compressive_strength  && { tech_compressive_strength: data.tech_compressive_strength }),
                  ...(data.contact_person     && { contact_person: data.contact_person }),
                  ...(data.notes              && { notes: data.notes }),
                  ...(Array.isArray(data.principles_consistency) && data.principles_consistency.length > 0
                    && { principles_consistency: data.principles_consistency }),
                  ...(Array.isArray(data.principles_efficiency) && data.principles_efficiency.length > 0
                    && { principles_efficiency: data.principles_efficiency }),
                  // EPD-specific fields (auto-detected EPDs)
                  ...(data.gwp_fossil != null  && { gwp_fossil: data.gwp_fossil }),
                  ...(data.gwp_biogenic != null && { gwp_biogenic: data.gwp_biogenic }),
                  ...(data.gwp_luluc != null   && { gwp_luluc: data.gwp_luluc }),
                  ...(data.gwp_value != null   && { gwp_value: String(data.gwp_value) }),
                  ...(data.cert_epd            && { cert_epd: true }),
                  ...(data.sust_climate_description && { sust_climate_description: data.sust_climate_description }),
                  ...(data.circularity         && { circularity: data.circularity }),
                  ...(data.human_health        && { human_health: data.human_health }),
                  ...(data.processing_sustainability && { processing_sustainability: data.processing_sustainability }),
                  ...(data.manufacturer        && { manufacturer: data.manufacturer }),
                  ...(data.declared_unit       && { declared_unit: data.declared_unit }),
                  ...(data.material_type       && { origin_source: data.material_type }),
                }));
              }}
            />
          </div>

          {/* ── Grunddaten ────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('materialForm.name')} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('materialForm.category')}
                <span className="ml-1.5 text-[11px] font-normal text-gray-400">(optional)</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                disabled={catsLoading}
              >
                <option value="">
                  {catsLoading ? t('materialForm.categoryLoading') : t('materialForm.categoryChoose')}
                </option>
                {material && formData.category && !categories.includes(formData.category) && (
                  <option value={formData.category}>{formData.category} (legacy)</option>
                )}
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('materialForm.shortDesc')}
                <span className="ml-1.5 text-[11px] font-normal text-gray-400">(1–2 Sätze)</span>
              </label>
              <textarea
                name="short_description"
                value={formData.short_description}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                placeholder={t('materialForm.shortDescPlaceholder')}
              />
            </div>
          </div>

          {/* ── Images (top-level, always visible) ───────────────────────── */}
          {pendingImages.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-700">{t('materialForm.imagesPendingTitle')}</p>
              <div className="grid grid-cols-3 gap-2">
                {pendingImages.map((file, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border-2 border-dashed border-primary-300 bg-primary-50">
                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-24 object-cover opacity-80" />
                    <span className="absolute top-1 left-1 bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {i === 0 ? 'Cover' : `Bild ${i + 1}`}
                    </span>
                    <button type="button"
                      onClick={() => { const u = pendingImages.filter((_,j) => j!==i); pendingImagesRef.current=u; setPendingImages(u); }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ImageUploader
            images={localImages}
            onUpload={async (files, opts) => {
              const id = material?.id || savedId;
              if (!id) {
                const updated = [...pendingImagesRef.current, ...files];
                pendingImagesRef.current = updated;
                setPendingImages(updated);
                return;
              }
              const { materialImageService } = await import('../../services/materialService');
              const result = await materialImageService.upload(id, files, opts);
              setLocalImages(prev => [...prev, ...(Array.isArray(result) ? result : [result])]);
            }}
            onDelete={async (imageId) => {
              const id = material?.id || savedId;
              if (!id) return;
              const { materialImageService } = await import('../../services/materialService');
              await materialImageService.delete(id, imageId);
              setLocalImages(prev => prev.filter(i => i.id !== imageId));
            }}
            onSetCredit={async (imageId, credit) => {
              const id = material?.id || savedId;
              if (!id) return;
              const { materialImageService } = await import('../../services/materialService');
              const updated = await materialImageService.updateMeta(id, imageId, { credit });
              if (Array.isArray(updated)) setLocalImages(updated);
            }}
            apiBase={API_BASE}
            showSteps={true}
            label={pendingImages.length > 0 ? t('materialForm.imagesLabelMore') : t('materialForm.imagesLabel')}
          />

          {savedId && !material && (
            <p className="text-xs text-primary-700 bg-primary-50 px-3 py-2 rounded-lg">
              {t('materialForm.savedNotice')}
            </p>
          )}

          {/* ── Accordion sections ───────────────────────────────────────── */}
          <div className="space-y-2 pt-1">

            {/* 1. Herkunft — alle Felder immer sichtbar (B+C) */}
            <AccordionSection
              icon={Recycle}
              title="Herkunft & Bezug"
              color="#16a34a"
              defaultOpen={!!formData.origin_source}
              filled={!!(formData.origin_acquisition || formData.previous_use || formData.manufacturer || formData.sku || formData.source_url)}
            >
              {/* Produktinfo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.manufacturer')}</label>
                  <input type="text" name="manufacturer" value={formData.manufacturer} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU / Artikelnummer</label>
                  <input type="text" name="sku" value={formData.sku} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.sourceUrl')}</label>
                <input type="url" name="source_url" value={formData.source_url} onChange={handleChange}
                  placeholder="https://"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ansprechpartner</label>
                <input type="text" name="contact_person" value={formData.contact_person} onChange={handleChange}
                  placeholder="Name der Kontaktperson"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              </div>

              {/* Vorgeschichte */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.previousUse')}</label>
                <input type="text" name="previous_use" value={formData.previous_use}
                  onChange={e => setFormData(prev => ({ ...prev, previous_use: e.target.value }))}
                  placeholder={t('materialForm.previousUsePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.originAcquisition')}</label>
                <textarea name="origin_acquisition" value={formData.origin_acquisition}
                  onChange={handleChange} rows={3}
                  placeholder={t('materialForm.originAcquisitionPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.similarIds')}</label>
                <input type="text" name="similar_material_ids_input" value={formData.similar_material_ids_input}
                  onChange={handleChange}
                  placeholder={t('materialForm.similarIdsPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              </div>
            </AccordionSection>

            {/* 2. Anwendung */}
            <AccordionSection
              icon={Wrench}
              title="Anwendung & Einsatz"
              color="#7c3aed"
              filled={!!(formData.description || formData.use_where || formData.use_limitations)}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.description')}</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('materialForm.applicationArea')}</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="checkbox" checked={formData.use_indoor} onChange={e => setFormData(prev=>({...prev, use_indoor: e.target.checked}))} className="w-4 h-4 text-primary-500 rounded" />
                    {t('materialForm.indoor')}
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="checkbox" checked={formData.use_outdoor} onChange={e => setFormData(prev=>({...prev, use_outdoor: e.target.checked}))} className="w-4 h-4 text-primary-500 rounded" />
                    {t('materialForm.outdoor')}
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.suitableFor')}</label>
                <textarea name="use_where" value={formData.use_where} onChange={e => setFormData(prev=>({...prev, use_where: e.target.value}))} rows={2}
                  placeholder={t('materialForm.suitableForPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.notSuitable')}</label>
                <textarea name="use_not_suitable" value={formData.use_not_suitable} onChange={e => setFormData(prev=>({...prev, use_not_suitable: e.target.value}))} rows={2}
                  placeholder={t('materialForm.notSuitablePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.limitations')}</label>
                <textarea name="use_limitations" value={formData.use_limitations} onChange={handleChange} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.processing') || 'Verarbeitung'}</label>
                <input type="text" name="use_processing" value={formData.use_processing} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              </div>
            </AccordionSection>

            {/* 3. Technische Daten */}
            <AccordionSection
              icon={FlaskConical}
              title={t('materialForm.sectionTech')}
              color="#0891b2"
              filled={!!(formData.tech_thicknesses || formData.tech_density || formData.tech_flammability)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { name: 'tech_thicknesses', label: t('materialForm.techThicknesses'), placeholder: 'z. B. 10 / 20 / 40 mm' },
                  { name: 'tech_dimensions',  label: t('materialForm.techDimensions'),  placeholder: 'z. B. 1200 x 580 mm' },
                  { name: 'tech_density',     label: t('materialForm.techDensity'),     placeholder: 'z. B. 35 kg/m³' },
                  { name: 'tech_flammability',label: t('materialForm.techFlammability'),placeholder: 'z. B. B2 / EN 13501-1' },
                  { name: 'tech_acoustics',   label: t('materialForm.techAcoustics'),   placeholder: '' },
                  { name: 'tech_thermal_insulation', label: t('materialForm.techThermal'), placeholder: '' },
                  { name: 'tech_compressive_strength', label: t('materialForm.techCompressive'), placeholder: 'z.B. 30 N/mm²' },
                  { name: 'tech_tensile_strength',     label: t('materialForm.techTensile'),     placeholder: 'z.B. 500 N/mm²' },
                ].map(({ name, label, placeholder }) => (
                  <div key={name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input type="text" name={name} value={formData[name]} onChange={handleChange}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                ))}
              </div>
            </AccordionSection>

            {/* 4. Ökobilanz / EPD */}
            <AccordionSection
              icon={Leaf}
              title={t('materialForm.sectionEnv')}
              color="#16a34a"
              filled={!!(formData.gwp_value || formData.gwp_fossil || formData.adp_fossil)}
            >
              {/* Simple GWP entry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.gwpTotal')}</label>
                  <input type="number" step="0.01" name="gwp_value" value={formData.gwp_value} onChange={handleChange}
                    placeholder="z. B. 2.5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                  {(formData.gwp_fossil !== '' || formData.gwp_biogenic !== '' || formData.gwp_luluc !== '') && (
                    <p className="text-[11px] text-amber-600 mt-1">{t('materialForm.gwpCalcHint')}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.gwpUnit')}</label>
                  <select name="gwp_unit" value={formData.gwp_unit} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                    <option value="kg CO2e/kg">kg CO₂e/kg</option>
                    <option value="kg CO2e/m2">kg CO₂e/m²</option>
                    <option value="kg CO2e/m3">kg CO₂e/m³</option>
                    <option value="kg CO2e/unit">kg CO₂e/unit</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-5">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" name="recyclable" checked={formData.recyclable} onChange={handleChange} className="w-4 h-4 text-primary-600 border-gray-300 rounded" />
                  {t('materialForm.recyclable')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" name="biodegradable" checked={formData.biodegradable} onChange={handleChange} className="w-4 h-4 text-primary-600 border-gray-300 rounded" />
                  {t('materialForm.biodegradable')}
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.recyclateContent')} %</label>
                  <input type="number" step="0.1" name="recyclate_content" value={formData.recyclate_content} onChange={handleChange}
                    placeholder="0–100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.recyclingPercent')} %</label>
                  <input type="number" step="0.1" min="0" max="100" name="recycling_percentage" value={formData.recycling_percentage}
                    onChange={e => setFormData(prev=>({...prev, recycling_percentage: e.target.value}))}
                    placeholder={t('materialForm.recyclingPercentPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.vocClass')}</label>
                  <input type="text" name="voc_values" value={formData.voc_values}
                    onChange={e => setFormData(prev=>({...prev, voc_values: e.target.value}))}
                    placeholder="z.B. A+"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
              </div>

            </AccordionSection>

            {/* 4b. EPD – Ökobilanzdetails */}
            <AccordionSection
              icon={FlaskConical}
              title={t('materialForm.sectionEpd')}
              color="#7c3aed"
              filled={!!(formData.gwp_fossil !== '' || formData.gwp_biogenic !== '' || formData.gwp_luluc !== '' || formData.declared_unit || formData.lifecycle_scope)}
            >
              <p className="text-[11px] text-gray-400 mb-3">{t('materialForm.epdHint')}</p>
              <EpdPdfDropZone onApply={(fields) => {
                setFormData(prev => {
                  const next = { ...prev };
                  Object.entries(fields).forEach(([k, v]) => {
                    // Boolean certifications
                    if (k === 'cert_epd' || k === 'cert_cradle_to_cradle' || k === 'cert_fsc_pefc') {
                      next[k] = Boolean(v); return;
                    }
                    // Array principle fields — replace directly
                    if (k === 'principles_consistency' || k === 'principles_efficiency') {
                      if (Array.isArray(v) && v.length > 0) next[k] = v;
                      return;
                    }
                    // Numeric LCA fields → stringify for controlled inputs
                    if (['gwp_value','gwp_fossil','gwp_biogenic','gwp_luluc','odp','ap',
                         'ep_terrestrial','ep_freshwater','ep_marine','pocp','adp_elements',
                         'adp_fossil','water_consumption','hwd','nhwd','rwd',
                         'pere','penre','perm','tech_density'].includes(k)) {
                      next[k] = v != null ? String(v) : ''; return;
                    }
                    if (k in next) next[k] = v;
                  });
                  return next;
                });
              }} />
              {(() => {
                const f = parseFloat(formData.gwp_fossil), b = parseFloat(formData.gwp_biogenic), l = parseFloat(formData.gwp_luluc);
                const hasAny = formData.gwp_fossil !== '' || formData.gwp_biogenic !== '' || formData.gwp_luluc !== '';
                const total = (isNaN(f)?0:f)+(isNaN(b)?0:b)+(isNaN(l)?0:l);
                return hasAny ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
                    <span className="font-semibold">GWP =</span>
                    <span className="font-mono font-bold">{total.toLocaleString('de-DE',{maximumFractionDigits:4})} kg CO₂e</span>
                    <span className="text-green-600">fossil {isNaN(f)?'–':f} + biogen {isNaN(b)?'–':b} + luluc {isNaN(l)?'–':l}</span>
                  </div>
                ) : null;
              })()}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                    {t('materialForm.epdDeclaredUnit')}<InfoTooltip text={t('materialForm.epdTooltipDeclaredUnit')} />
                  </label>
                  <input type="text" name="declared_unit" value={formData.declared_unit} onChange={handleChange}
                    placeholder="z. B. 1 kg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                    {t('materialForm.epdSystemBoundary')}<InfoTooltip text={t('materialForm.epdTooltipSystemBoundary')} />
                  </label>
                  <select name="lifecycle_scope" value={formData.lifecycle_scope} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm">
                    <option value="">{t('materialForm.epdBoundaryNone')}</option>
                    <option value="A1-A3">{t('materialForm.epdBoundaryA1A3')}</option>
                    <option value="A1-A5">{t('materialForm.epdBoundaryA1A5')}</option>
                    <option value="A1-D">{t('materialForm.epdBoundaryA1D')}</option>
                  </select>
                </div>
                {[
                  { name: 'gwp_fossil',        label: t('materialForm.epdGwpFossil'),        tip: 'epdTooltipGwpFossil',        ph: 'z. B. 2.4' },
                  { name: 'gwp_biogenic',       label: t('materialForm.epdGwpBiogenic'),      tip: 'epdTooltipGwpBiogenic',      ph: 'z. B. -0.1' },
                  { name: 'gwp_luluc',          label: t('materialForm.epdGwpLuluc'),         tip: 'epdTooltipGwpLuluc',         ph: 'z. B. 0.01' },
                  { name: 'adp_fossil',         label: t('materialForm.epdAdpFossil'),        tip: 'epdTooltipAdpFossil',        ph: 'z. B. 45' },
                  { name: 'adp_elements',       label: t('materialForm.epdAdpElements'),      tip: 'epdTooltipAdpElements',      ph: 'z. B. 0.00012' },
                  { name: 'water_consumption',  label: t('materialForm.epdWater'),            tip: 'epdTooltipWater',            ph: 'z. B. 0.003' },
                  { name: 'odp',                label: t('materialForm.epdOdp'),              tip: 'epdTooltipOdp',              ph: 'z. B. 1.2e-8' },
                  { name: 'ap',                 label: t('materialForm.epdAp'),               tip: 'epdTooltipAp',               ph: 'z. B. 0.012' },
                  { name: 'ep_terrestrial',     label: t('materialForm.epdEpTerrestrial'),    tip: 'epdTooltipEpTerrestrial',    ph: 'z. B. 0.05' },
                  { name: 'ep_freshwater',      label: t('materialForm.epdEpFreshwater'),     tip: 'epdTooltipEpFreshwater',     ph: 'z. B. 3e-5' },
                  { name: 'ep_marine',          label: t('materialForm.epdEpMarine'),         tip: 'epdTooltipEpMarine',         ph: 'z. B. 0.004' },
                  { name: 'pocp',               label: t('materialForm.epdPocp'),             tip: 'epdTooltipPocp',             ph: 'z. B. 0.003' },
                  { name: 'hwd',                label: t('materialForm.epdHwd'),              tip: 'epdTooltipHwd',              ph: 'z. B. 0.001' },
                  { name: 'nhwd',               label: t('materialForm.epdNhwd'),             tip: 'epdTooltipNhwd',             ph: 'z. B. 15' },
                  { name: 'rwd',                label: t('materialForm.epdRwd'),              tip: 'epdTooltipRwd',              ph: 'z. B. 2e-5' },
                  { name: 'pere',               label: t('materialForm.epdPere'),             tip: 'epdTooltipPere',             ph: 'z. B. 1.5' },
                  { name: 'penre',              label: t('materialForm.epdPenre'),            tip: 'epdTooltipPenre',            ph: 'z. B. 45' },
                  { name: 'perm',               label: t('materialForm.epdPerm'),             tip: 'epdTooltipPerm',             ph: 'z. B. 0.5' },
                ].map(({ name, label, tip, ph }) => (
                  <div key={name}>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                      {label}<InfoTooltip text={t(`materialForm.${tip}`)} />
                    </label>
                    <input type="number" step="any" name={name} value={formData[name]} onChange={handleChange}
                      placeholder={ph}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm" />
                  </div>
                ))}
              </div>
            </AccordionSection>

            {/* IDEMAT 2026 Prozess-Link */}
            <AccordionSection
              icon={Leaf}
              title="IDEMAT 2026 — Prozess verknüpfen"
              color="#047857"
              filled={!!formData.idemat_process_id}
              defaultOpen={!!formData.idemat_process_id}
            >
              <p className="text-[11px] text-gray-400 mb-3">
                Ordne diesem Material einen Prozess aus der IDEMAT 2026-Datenbank zu (TU Delft, 2 472 Einträge). Der EF 3.1 Gesamtscore wird im Materialsteckbrief angezeigt.
              </p>
              <IdematLinker
                processId={formData.idemat_process_id}
                onSelect={(entry) => setFormData(f => ({ ...f, idemat_process_id: entry.id }))}
                onClear={() => setFormData(f => ({ ...f, idemat_process_id: null }))}
              />
            </AccordionSection>

            {/* 5. Kreislauf & Zertifizierung */}
            <AccordionSection
              icon={Recycle}
              title={t('materialForm.sectionEcodesign')}
              color="#d97706"
              filled={!!((formData.principles_consistency||[]).length || (formData.principles_efficiency||[]).length || formData.cert_epd || formData.cert_cradle_to_cradle)}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.climateDesc')}</label>
                <textarea name="sust_climate_description" value={formData.sust_climate_description} onChange={handleChange} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.circularity')}</label>
                  <input type="text" name="circularity" value={formData.circularity} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.humanHealth')}</label>
                  <input type="text" name="human_health" value={formData.human_health} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.processing')}</label>
                <input type="text" name="processing_sustainability" value={formData.processing_sustainability} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              {[
                { key: 'principles_consistency', label: t('materialForm.ecoConsistency'), opts: PRINCIPLES.consistency },
                { key: 'principles_efficiency',  label: t('materialForm.ecoEfficiency'),  opts: PRINCIPLES.efficiency },
              ].map(({ key, label, opts }) => (
                <div key={key}>
                  <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {opts.map(p => (
                      <button key={p} type="button"
                        onClick={() => setFormData(prev => ({ ...prev, [key]: toggleInArray(prev[key], p) }))}
                        className={`px-3 py-1 rounded-full text-xs border transition-all ${(formData[key]||[]).includes(p) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-300 hover:border-amber-300'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">{t('materialForm.sectionCerts')}</p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'cert_epd', label: t('materialForm.certEpd') },
                    { key: 'cert_cradle_to_cradle', label: 'Cradle-to-Cradle' },
                    { key: 'cert_fsc_pefc', label: 'FSC / PEFC' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                      <input type="checkbox" checked={formData[key]} onChange={e => setFormData(prev=>({...prev, [key]: e.target.checked}))} className="w-4 h-4 text-primary-500 rounded" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </AccordionSection>

            {/* 6. Standort */}
            <AccordionSection
              icon={MapPin}
              title={<>{t('materialForm.sectionLocation')} <span className="text-red-400">*</span></>}
              color="#0891b2"
              filled={!!(formData.location_name || formData.latitude)}
              defaultOpen={true}
            >
              <LocationPicker
                value={{
                  location_name: formData.location_name,
                  address: formData.address,
                  latitude: formData.latitude,
                  longitude: formData.longitude,
                }}
                onChange={(loc) => setFormData(prev => ({
                  ...prev,
                  location_name: loc.location_name || '',
                  address: loc.address || '',
                  latitude: loc.latitude ?? '',
                  longitude: loc.longitude ?? '',
                }))}
              />
            </AccordionSection>

            {/* 7. Akteure & Weitere Infos */}
            <AccordionSection
              icon={Info}
              title="Akteure & weitere Infos"
              color="#6b7280"
              filled={!!(actorIds.filter(Boolean).length || formData.env_links_input || formData.notes)}
            >
              {/* Actors */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{t('materialForm.sectionActors')}</p>
                <div className="space-y-2">
                  {actorIds.map((actorId, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select value={actorId}
                        onChange={(e) => { const next=[...actorIds]; next[idx]=e.target.value; setActorIds(next); }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm">
                        <option value="">{t('materialForm.actorChoose')}</option>
                        {allActors.map(a => (
                          <option key={a.id} value={a.id}>{a.name}{a.type ? ` (${a.type})` : ''}</option>
                        ))}
                      </select>
                      {actorIds.length > 1 && (
                        <button type="button" onClick={() => setActorIds(actorIds.filter((_,i)=>i!==idx))}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setActorIds([...actorIds,''])}
                    className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium">
                    <Plus className="w-4 h-4" /> {t('materialForm.actorAdd')}
                  </button>
                </div>
              </div>
              {/* Env links, notes, appendix */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.envLinks')}</label>
                <textarea name="env_links_input" value={formData.env_links_input} onChange={handleChange} rows={2}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.notesLabel')}</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.appendix')}</label>
                <textarea name="appendix" value={formData.appendix} onChange={handleChange} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              {/* Files */}
              <FileUploader
                files={localFiles}
                onUpload={async (files) => {
                  const id = material?.id || savedId;
                  if (!id) {
                    const updated = [...pendingFilesRef.current, ...files];
                    pendingFilesRef.current = updated;
                    setPendingFiles(updated);
                    return;
                  }
                  const { materialImageService } = await import('../../services/materialService');
                  const result = await materialImageService.uploadFiles(id, files);
                  setLocalFiles(prev => [...prev, ...(Array.isArray(result) ? result : [result])]);
                }}
                onDelete={async (fileId) => {
                  const id = material?.id || savedId;
                  if (!id) return;
                  const { materialImageService } = await import('../../services/materialService');
                  await materialImageService.deleteFile(id, fileId);
                  setLocalFiles(prev => prev.filter(f => f.id !== fileId));
                }}
                apiBase={API_BASE}
                label={t('materialForm.filesLabel')}
              />
            </AccordionSection>

          </div> {/* end accordion */}

          {/* Sichtbarkeit */}
          {mode === 'material' && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Sichtbarkeit</p>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                {[
                  { value: 'private',       label: 'Privat',       Icon: Lock      },
                  { value: 'actor',         label: 'Akteur',       Icon: Building2 },
                  { value: 'selectedUsers', label: 'Ausgewählte',  Icon: Users     },
                  { value: 'public',        label: 'Öffentlich',   Icon: Globe     },
                ].map(({ value, label, Icon }, i, arr) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, visibility: value }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${
                      i < arr.length - 1 ? 'border-r border-gray-200' : ''
                    } ${
                      formData.visibility === value
                        ? 'bg-stone-800 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {formData.visibility === 'actor' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Akteure mit Zugriff (mehrere möglich):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allActors.map(a => {
                      const selected = (formData.shared_actor_ids || []).includes(a.id);
                      return (
                        <button key={a.id} type="button"
                          onClick={() => setFormData(f => {
                            const cur = f.shared_actor_ids || [];
                            return { ...f, shared_actor_ids: selected ? cur.filter(x => x !== a.id) : [...cur, a.id] };
                          })}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            selected ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                          }`}>
                          {a.name}
                        </button>
                      );
                    })}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={formData.actor_members_can_edit}
                      onChange={e => setFormData(f => ({ ...f, actor_members_can_edit: e.target.checked }))}
                      className="rounded border-gray-300" />
                    Akteur-Mitglieder dürfen auch bearbeiten
                  </label>
                </div>
              )}

              {formData.visibility === 'private' && (
                <p className="text-xs text-gray-400">Nur du kannst dieses Material sehen. Du kannst es später gezielt freigeben.</p>
              )}
              {formData.visibility === 'selectedUsers' && (
                <InlineUserPicker
                  selected={formData.selectedUsers || []}
                  onChange={users => setFormData(f => ({ ...f, selectedUsers: users }))}
                />
              )}
              {formData.visibility === 'public' && (
                <p className="text-xs text-gray-400">Für alle sichtbar — auch ohne Anmeldung.</p>
              )}
            </div>
          )}

          {/* Optional offer creation (only when creating a new material) */}
          {!material && enableOfferOnCreate && (
            <div className="border-2 border-primary-200 bg-primary-50 rounded-xl p-4">
              <label className="flex items-center gap-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createOffer}
                  onChange={(e) => setCreateOffer(e.target.checked)}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500 flex-shrink-0"
                />
                <div>
                  <div className="text-sm font-bold text-primary-900">{t('materialForm.offerToggleTitle')}</div>
                  <div className="text-xs text-primary-700 mt-0.5">{t('materialForm.offerToggleHint')}</div>
                </div>
              </label>

              {createOffer ? (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.qtyRequired')}</label>
                      <input
                        type="number"
                        step="0.01"
                        name="quantity"
                        value={offerData.quantity}
                        onChange={handleOfferChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.unitRequired')}</label>
                      <select
                        name="unit"
                        value={offerData.unit}
                        onChange={handleOfferChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                        required
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="m">m</option>
                        <option value="m2">m²</option>
                        <option value="m3">m³</option>
                        <option value="piece">piece</option>
                        <option value="unit">unit</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !offerData.same_as_material;
                        setOfferData(d => ({
                          ...d,
                          same_as_material: next,
                          location_name: next ? (formData.location_name || '') : '',
                          address:        next ? (formData.address || '')        : '',
                          latitude:       next ? (formData.latitude  ?? null)    : null,
                          longitude:      next ? (formData.longitude ?? null)    : null,
                        }));
                      }}
                      className={`mb-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        offerData.same_as_material
                          ? 'bg-green-500 text-white border-green-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                      }`}
                    >
                      📍 {offerData.same_as_material ? 'Gleicher Standort wie Material' : 'Gleicher Standort wie Material?'}
                    </button>
                    {!offerData.same_as_material ? (
                      <LocationPicker
                        label={t('materialForm.locationName')}
                        value={{ location_name: offerData.location_name, address: offerData.address, latitude: offerData.latitude, longitude: offerData.longitude }}
                        onChange={loc => setOfferData(d => ({ ...d, location_name: loc.location_name, address: loc.address, latitude: loc.latitude, longitude: loc.longitude }))}
                      />
                    ) : (
                      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        {offerData.location_name || offerData.address || 'Standort wird vom Material übernommen'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{t('materialForm.offerConditions')}</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        title={offerData.is_available ? 'Material ist verfügbar — klicken um als abgeholt zu markieren' : 'Material wurde abgeholt — klicken um wieder als verfügbar zu markieren'}
                        onClick={() => setOfferData(d => ({ ...d, is_available: !d.is_available }))}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          offerData.is_available
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-gray-200 text-gray-500 border-gray-300 line-through'
                        }`}
                      >
                        {offerData.is_available ? '✓ Verfügbar' : 'Abgeholt'}
                      </button>
                      {[
                        { key: 'available_for_gift', label: '🎁 Zu Verschenken',    desc: 'Kostenlos abzugeben' },
                        { key: 'swap_possible',       label: '🔄 Tausch möglich',    desc: 'Gegen etwas tauschen' },
                        { key: 'is_negotiable',       label: '💬 Preis verhandelbar',desc: 'Preis auf Anfrage' },
                      ].map(({ key, label, desc }) => (
                        <button
                          key={key}
                          type="button"
                          title={desc}
                          onClick={() => setOfferData(d => ({ ...d, [key]: !d[key] }))}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                            offerData[key]
                              ? 'bg-primary-500 text-white border-primary-500'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-primary-300'
                          }`}
                        >{label}</button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setOfferData(d => ({ ...d, show_external: !d.show_external, external_url: d.show_external ? '' : d.external_url }))}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          offerData.show_external
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                        }`}
                      >🔗 Extern inseriert</button>
                    </div>
                    {offerData.show_external && (
                      <input
                        type="url"
                        value={offerData.external_url}
                        onChange={e => setOfferData(d => ({ ...d, external_url: e.target.value }))}
                        placeholder="https://..."
                        className="mt-2 w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
                    <textarea
                      name="notes"
                      value={offerData.notes}
                      onChange={handleOfferChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}


          {savedId && !material && (
            <p className="text-xs text-primary-700 bg-primary-50 px-3 py-2 rounded-lg">
              {t('materialForm.savedNotice')}
            </p>
          )}
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              {savedId && !material ? t('materialForm.btnClose') : t('materialForm.btnCancel')}
            </button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50">
              {isPending
                ? t('materialForm.btnSaving')
                : material
                  ? t('materialForm.btnSave')
                  : mode === 'offer-only'
                    ? t('materialForm.btnCreateOffer')
                    : t('materialForm.btnCreate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
