import { useMemo, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import {
  X, ExternalLink, Leaf, Info, Wrench, Ruler, Recycle, Trash2,
  FileDown, Share2, Loader2, Eye, Pencil, Wand2, Check, CheckCircle2,
  AlertCircle, FileText, Image as ImageIcon, Search, FlaskConical,
  MapPin,
} from 'lucide-react';
import LcaSection from './LcaSection';
import { OwnerLine } from '../shared/ContactButton';
import SharePrintBar from '../shared/SharePrintBar';
import BookmarkButton from '../shared/BookmarkButton';
import MaterialIdSection from '../shared/MaterialIdSection';
import ImageUploader from '../shared/ImageUploader';
import { exportMaterialPoster } from '../../utils/exportUtils';
import { MEDIA_BASE } from '../../services/api';
import { useT } from '../../i18n/useT';
import { materialService, materialImageService, parseDocumentForMaterial, analyzeImages } from '../../services/materialService';
import { idematService } from '../../services/idematService';
import VisibilityBadge from './VisibilityBadge';
import ShareDialog from './ShareDialog';
import { useToast } from '../../store/toastStore';

const API_BASE = MEDIA_BASE;

// ── Constants ──────────────────────────────────────────────────────────────────
const ORIGIN_SOURCE_OPTIONS = [
  { value: 'primary',                  label: '🏭 Neuware' },
  { value: 'secondary_rückbau',        label: '🏗 Rückbau' },
  { value: 'secondary_restposten',     label: '🧱 Produktionsrest' },
  { value: 'secondary_überschuss',     label: '📦 Überschuss' },
  { value: 'secondary_upcycling',      label: '♻ Upcycling' },
  { value: 'secondary_eigenproduktion', label: '🛠 Eigenproduktion' },
];
const ORIGIN_SOURCE_LABELS = Object.fromEntries(ORIGIN_SOURCE_OPTIONS.map(o => [o.value, o.label]));

const LIFECYCLE_SCOPE_OPTIONS = ['A1-A3', 'A1-A3+C', 'A1-A5', 'A1-D', 'C2-C4', 'D'];

const PRINCIPLES_OPTIONS = {
  consistency: ['Nachwachsende Rohstoffe', 'Recycelte Rohstoffe', 'Recyclinggerecht', 'Kompostierbar'],
  efficiency: ['Schadstofffrei', 'Naturraumerhaltend', 'Faire Materialgewinnung', 'Regional'],
  sufficiency: ['Langlebig', 'Reparierbar', 'Multifunktional', 'Kompakt'],
};

const NUMERIC_FIELDS = new Set([
  'gwp_total_value', 'gwp_value', 'recyclate_content', 'recycling_percentage',
  'gwp_fossil', 'gwp_biogenic', 'gwp_luluc', 'adp_fossil', 'adp_elements',
  'water_consumption', 'odp', 'ap', 'ep_terrestrial', 'ep_freshwater', 'ep_marine',
  'pocp', 'hwd', 'nhwd', 'rwd', 'pere', 'penre', 'perm',
  'latitude', 'longitude', 'recycled_content',
]);

const JSON_ARRAY_FIELDS = new Set([
  'principles_sufficiency', 'principles_consistency', 'principles_efficiency',
]);

const KI_FIELD_LABELS = {
  name: 'Materialname', short_description: 'Kurzbeschreibung', description: 'Beschreibung',
  category: 'Kategorie', origin_acquisition: 'Herstellung / Gewinnung',
  use_processing: 'Verarbeitung / Einbau', use_where: 'Einsatzbereiche',
  use_not_suitable: 'Nicht geeignet für', previous_use: 'Vorherige Nutzung',
  tech_dimensions: 'Abmessungen / Format', tech_density: 'Rohdichte (kg/m³)',
  tech_thermal_insulation: 'Wärmeleitfähigkeit λ', tech_compressive_strength: 'Druckfestigkeit',
  tech_flammability: 'Brandschutz', contact_person: 'Ansprechpartner',
  notes: 'Hinweise', principles_consistency: 'Prinzipien (Konsistenz)',
  principles_efficiency: 'Prinzipien (Effizienz)', gwp_fossil: 'GWP fossil (kg CO₂e)',
  gwp_biogenic: 'GWP biogen (kg CO₂e)', gwp_value: 'GWP gesamt (kg CO₂e)',
  cert_epd: 'EPD vorhanden', manufacturer: 'Hersteller', declared_unit: 'Deklarierte Einheit',
  sust_climate_description: 'Klimawirkung', circularity: 'Kreislauffähigkeit',
  human_health: 'Gesundheit / VOC', processing_sustainability: 'Verarbeitung / Entsorgung',
};

const CONF_STYLE = {
  high:   { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Hoch' },
  medium: { dot: 'bg-amber-400',   text: 'text-amber-700',   label: 'Mittel' },
  low:    { dot: 'bg-red-400',     text: 'text-red-700',     label: 'Gering' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

// ── InlineField ────────────────────────────────────────────────────────────────
function InlineField({
  value, multiline = false, type = 'text', step, placeholder = '—', onSave,
  textClass = 'text-sm text-gray-800 leading-relaxed',
  emptyClass = 'text-sm text-gray-400 italic',
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const [busy,    setBusy]    = useState(false);
  const ref = useRef(null);

  const start = () => {
    setDraft(value != null ? String(value) : '');
    setEditing(true);
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.select?.(); });
  };
  const commit = async () => {
    const trimmed = (type === 'number' ? draft : draft.trim());
    if (trimmed === (value != null ? String(value) : '')) { setEditing(false); return; }
    setBusy(true);
    try { await onSave(trimmed); } catch {}
    setBusy(false);
    setEditing(false);
  };
  const handleKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
    if (!multiline && e.key === 'Enter') { e.preventDefault(); commit(); }
  };

  if (editing) {
    const shared = {
      ref, value: draft, onChange: e => setDraft(e.target.value),
      onBlur: commit, onKeyDown: handleKey, autoFocus: true,
      className: `w-full bg-primary-50 rounded-lg px-2 py-1 outline-none border border-primary-300 focus:ring-2 focus:ring-primary-200 ${textClass} resize-none`,
    };
    if (multiline) return <textarea {...shared} rows={Math.max(3, (draft.match(/\n/g) || []).length + 2)} />;
    return <input type={type} step={step} {...shared} />;
  }
  return (
    <span onClick={start}
      className="group block w-full cursor-text rounded-lg px-2 py-1 -mx-2 hover:bg-primary-50/50 transition-colors"
      title="Klicken zum Bearbeiten">
      {value != null && value !== ''
        ? <span className={`${textClass} whitespace-pre-wrap`}>{value}</span>
        : <span className={emptyClass}>{placeholder}</span>}
      {busy && <Loader2 className="inline-block w-3 h-3 ml-1.5 animate-spin text-primary-400 align-middle" />}
    </span>
  );
}

// ── InlineSelect ───────────────────────────────────────────────────────────────
function InlineSelect({ value, options, placeholder = 'Wählen…', onSave, textClass = 'text-sm text-gray-800' }) {
  return (
    <select value={value || ''} onChange={e => onSave(e.target.value)}
      className={`${textClass} bg-primary-50 border border-primary-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-primary-200 cursor-pointer`}>
      <option value="">{placeholder}</option>
      {options.map(opt => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const lbl = typeof opt === 'string' ? opt : opt.label;
        return <option key={val} value={val}>{lbl}</option>;
      })}
    </select>
  );
}

// ── InlineCheckbox ─────────────────────────────────────────────────────────────
function InlineCheckbox({ value, label, onSave }) {
  return (
    <button type="button" onClick={() => onSave(!value)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
        value ? 'border-green-300 bg-green-50 text-green-800 font-medium' : 'border-gray-200 bg-white text-gray-500 hover:border-primary-200 hover:bg-primary-50'
      }`}>
      {value ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current" />}
      {label}
    </button>
  );
}

// ── InlineTags ─────────────────────────────────────────────────────────────────
function InlineTags({ value = [], options, onSave }) {
  const toggle = (item) => {
    const next = value.includes(item) ? value.filter(v => v !== item) : [...value, item];
    onSave(next);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
            value.includes(opt)
              ? 'border-primary-300 bg-primary-50 text-primary-800 font-medium'
              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
          }`}>{opt}</button>
      ))}
    </div>
  );
}

// ── IdematLinker ───────────────────────────────────────────────────────────────
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

  function fmtPt(v) {
    if (v == null) return '—';
    return Math.abs(v) >= 0.001 ? v.toLocaleString('de-DE', { maximumFractionDigits: 5 }) : v.toExponential(3);
  }

  const dropdown = open && q.trim().length >= 2 && rect ? createPortal(
    <div style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 99999 }}
      className="bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
      {isFetching && <div className="px-3 py-2 text-xs text-gray-400">Suche…</div>}
      {!isFetching && results.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">Keine Treffer</div>}
      {results.map(r => (
        <button key={r.id} type="button"
          onMouseDown={e => { e.preventDefault(); onSelect(r); setQ(''); setOpen(false); }}
          className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-b border-gray-50 last:border-0">
          <div className="text-xs font-medium text-gray-900 truncate">{r.name}</div>
          <div className="flex gap-2 mt-0.5">
            <span className="text-[10px] text-gray-500">{r.category}</span>
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
          <button type="button" onClick={onClear} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input ref={inputRef} type="text" value={q}
          onChange={e => { setQ(e.target.value); if (inputRef.current) setRect(inputRef.current.getBoundingClientRect()); setOpen(true); }}
          onFocus={() => { if (inputRef.current) setRect(inputRef.current.getBoundingClientRect()); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={linked ? 'Prozess ändern…' : 'Prozess suchen (z.B. steel, wood, concrete)…'}
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
        {dropdown}
      </div>
    </div>
  );
}

// ── KiDropZone ─────────────────────────────────────────────────────────────────
function KiDropZone({ onApply, onImages }) {
  const [dragOver, setDragOver]   = useState(false);
  const [status, setStatus]       = useState('idle');
  const [extracted, setExtracted] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [selected, setSelected]   = useState({});
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError]         = useState('');
  const imgInputRef = useRef(null);
  const docInputRef = useRef(null);

  const isImage = f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name);
  const isDoc   = f => /\.(pdf|docx)$/i.test(f.name) || f.type === 'application/pdf' || f.type.includes('wordprocessingml');

  const reset = () => { setStatus('idle'); setExtracted(null); setConfidence(null); setSelected({}); setError(''); };
  const toggleAll = (val) => setSelected(prev => Object.fromEntries(Object.keys(prev).map(k => [k, val])));

  const showPreview = (data, conf) => {
    setExtracted(data);
    setConfidence(conf || null);
    const init = {};
    Object.keys(data).forEach(k => {
      if (!KI_FIELD_LABELS[k]) return;
      if (Array.isArray(data[k]) && data[k].length === 0) return;
      init[k] = true;
    });
    setSelected(init);
    setStatus('preview');
  };

  const processFiles = async (files) => {
    const docs   = files.filter(isDoc);
    const images = files.filter(isImage);

    // Images always go to the gallery uploader immediately
    if (images.length > 0 && onImages) onImages(images);

    if (docs.length > 0 && images.length > 0) {
      // PDF + images: run both analyses, merge — PDF facts win, images add what's missing
      setStatus('loading'); setLoadingMsg('Dokument & Bilder werden analysiert…');
      try {
        const [docRes, imgRes] = await Promise.all([
          parseDocumentForMaterial(docs[0]),
          analyzeImages(images, 'material'),
        ]);
        const docData = docRes.data || {};
        const imgData = imgRes.data || {};
        // PDF wins for any field it has; image fills in what's missing
        const merged = { ...imgData, ...docData };
        showPreview(merged, docRes.confidence);
      } catch (e) {
        setError(e?.response?.data?.message || 'Analyse fehlgeschlagen');
        setStatus('error');
      }
    } else if (docs.length > 0) {
      setStatus('loading'); setLoadingMsg('Dokument wird analysiert…');
      try { const r = await parseDocumentForMaterial(docs[0]); showPreview(r.data || {}, r.confidence); }
      catch (e) { setError(e?.response?.data?.message || 'Analyse fehlgeschlagen'); setStatus('error'); }
    } else if (images.length > 0) {
      setStatus('loading'); setLoadingMsg(`${images.length} Bild${images.length > 1 ? 'er werden' : ' wird'} analysiert…`);
      try { const r = await analyzeImages(images, 'material'); showPreview(r.data || {}, null); }
      catch (e) { setError(e?.response?.data?.message || 'Bildanalyse fehlgeschlagen'); setStatus('error'); }
    }
  };

  const handleApply = () => {
    const out = {};
    Object.entries(selected).forEach(([k, on]) => { if (on && extracted[k] !== undefined) out[k] = extracted[k]; });
    onApply(out);
    reset();
  };

  if (status === 'preview' && extracted) {
    const fields       = Object.keys(KI_FIELD_LABELS).filter(k => extracted[k] !== undefined);
    const checkedCount = Object.values(selected).filter(Boolean).length;
    const confStyle    = CONF_STYLE[confidence?.overall] || CONF_STYLE.medium;
    return (
      <div className="border border-violet-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-violet-100/60 border-b border-violet-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-violet-600" />
            <span className="text-xs font-semibold text-violet-800">{fields.length} Felder erkannt</span>
            {confidence && <span className={`text-[10px] font-medium ${confStyle.text}`}>· Konfidenz {confStyle.label}</span>}
          </div>
          <button type="button" onClick={reset} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </div>
        <div className="px-3 py-2">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-[11px] text-gray-500">{checkedCount}/{fields.length} ausgewählt</span>
            <button type="button" onClick={() => toggleAll(true)} className="text-[11px] text-violet-600 hover:underline">Alle</button>
            <button type="button" onClick={() => toggleAll(false)} className="text-[11px] text-gray-400 hover:underline">Keine</button>
          </div>
          <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
            {fields.map(k => (
              <label key={k} className="flex items-start gap-1.5 cursor-pointer py-0.5">
                <input type="checkbox" checked={!!selected[k]}
                  onChange={() => setSelected(p => ({ ...p, [k]: !p[k] }))}
                  className="mt-0.5 w-3.5 h-3.5 text-violet-600 border-gray-300 rounded flex-shrink-0" />
                <span className="text-[11px] text-gray-500 leading-tight flex-shrink-0 min-w-[140px]">{KI_FIELD_LABELS[k]}</span>
                <span className="text-[11px] font-medium text-gray-800 leading-tight truncate">
                  {Array.isArray(extracted[k]) ? extracted[k].join(', ') : String(extracted[k])}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={handleApply} disabled={checkedCount === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors">
              <Check className="w-3.5 h-3.5" /> {checkedCount} Felder übernehmen
            </button>
            <button type="button" onClick={reset} className="px-3 py-2 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50">Abbrechen</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* ── Status: loading / error ── */}
      {status === 'loading' && (
        <div className="flex items-center gap-2 px-3 py-3 border border-violet-200 rounded-xl bg-violet-50/50 text-xs text-violet-700">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span className="font-medium">{loadingMsg}</span>
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-start gap-2 px-3 py-2.5 border border-red-200 rounded-xl bg-red-50 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
          <button type="button" onClick={reset} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {(status === 'idle' || status === 'error') && (
        <>
          {/* ── Hauptpfad: Bilder (2/3) ── */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver('img'); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => { e.preventDefault(); setDragOver(null); processFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => imgInputRef.current?.click()}
            className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all select-none
              ${dragOver === 'img'
                ? 'border-violet-400 bg-violet-50 scale-[1.01]'
                : 'border-violet-200 bg-violet-50/40 hover:bg-violet-50 hover:border-violet-300'}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
              ${dragOver === 'img' ? 'bg-violet-200' : 'bg-violet-100'}`}>
              <ImageIcon className={`w-5 h-5 ${dragOver === 'img' ? 'text-violet-700' : 'text-violet-500'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-violet-800">
                {dragOver === 'img' ? 'Loslassen zum Analysieren' : 'Mit KI ausfüllen'}
              </p>
              <p className="text-[11px] text-violet-500 mt-0.5">
                Bild(er) hochladen → Felder werden vorausgefüllt
              </p>
            </div>
            <input ref={imgInputRef} type="file" multiple
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
              className="hidden"
              onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) processFiles(fs); e.target.value = ''; }} />
          </div>

          {/* ── Ergänzend: Dokument (kleiner, subtiler) ── */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver('doc'); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => { e.preventDefault(); setDragOver(null); processFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => docInputRef.current?.click()}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition-all select-none
              ${dragOver === 'doc'
                ? 'border-gray-400 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'}`}
          >
            <FileText className={`w-4 h-4 flex-shrink-0 ${dragOver === 'doc' ? 'text-gray-600' : 'text-gray-400'}`} />
            <p className="text-[11px] text-gray-500 leading-snug">
              {dragOver === 'doc'
                ? 'Dokument ablegen …'
                : 'Hast du neben Bildern auch Dokumente mit Daten? Auch die kannst du hier reindroppen'}
            </p>
            <span className="ml-auto text-[10px] text-gray-300 flex-shrink-0">PDF · DOCX</span>
            <input ref={docInputRef} type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) processFiles(fs); e.target.value = ''; }} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Layout helpers ─────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-3">
        {Icon && <Icon className="w-5 h-5 text-gray-700" />}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
function EmptyHint({ children }) {
  return <div className="text-sm text-gray-500 italic">{children}</div>;
}
function TagGroup({ title, items }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-gray-700 mb-2">{title}</div>
      <div className="flex flex-wrap gap-2">
        {list.map(t => (
          <span key={t} className="px-2.5 py-1 rounded-full text-xs border border-gray-200 bg-gray-50 text-gray-800">{t}</span>
        ))}
      </div>
    </div>
  );
}
function ImageGallery({ images, name }) {
  const [active, setActive] = useState(0);
  const imgUrl = (img) => {
    if (!img?.file_path) return null;
    const p = img.file_path.replace(/^\./, '');
    return `${API_BASE}${p.startsWith('/') ? p : '/' + p}`;
  };
  return (
    <div className="mb-5">
      <div className="relative">
        <img src={imgUrl(images[active])} alt={name}
          className="w-full h-64 object-cover rounded-2xl border border-gray-100" />
        {images[active]?.credit && (
          <span className="absolute bottom-2 right-2 text-[10px] font-light text-white/70 tracking-wide leading-none [writing-mode:vertical-rl] rotate-180 select-none pointer-events-none">
            {images[active].credit}
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button key={img.id ?? i} type="button" onClick={() => setActive(i)}
              className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${i === active ? 'border-primary-500' : 'border-transparent'}`}>
              <img src={imgUrl(img)} alt={`${name} ${i + 1}`} className="h-16 w-24 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CAD Button ─────────────────────────────────────────────────────────────────
function parseDimensions(dimStr) {
  if (!dimStr) return {};
  const m = dimStr.match(/(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return {};
  return { width: parseFloat(m[1].replace(',', '.')), height: parseFloat(m[2].replace(',', '.')) };
}
function parseThickness(thickStr) {
  if (!thickStr) return undefined;
  const m = thickStr.match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : undefined;
}
const CAD_APP_URL = 'https://martinwiesner.github.io/cad-app/';
function CadButton({ material }) {
  const t = useT();
  const dims      = parseDimensions(material.tech_dimensions);
  const thickness = parseThickness(material.tech_thicknesses);
  const params = new URLSearchParams();
  params.set('material', material.name ?? '');
  if (dims.width)  params.set('width',  String(dims.width));
  if (dims.height) params.set('height', String(dims.height));
  if (thickness)   params.set('thickness', String(thickness));
  if (material.tech_density) params.set('density', material.tech_density);
  params.set('mode', 'configurator');
  const hasAnyDim = dims.width || dims.height || thickness;
  return (
    <a href={`${CAD_APP_URL}?${params}`} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors w-fit">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
      {t('materialDetail.cad.openButton')}
      {hasAnyDim && (
        <span className="ml-1 text-xs text-blue-500">
          {[dims.width && `${dims.width}mm`, dims.height && `${dims.height}mm`, thickness && t('materialDetail.cad.thicknessLabel', { value: thickness })].filter(Boolean).join(' × ')}
        </span>
      )}
    </a>
  );
}

// ── Numeric inline input (for EPD fields etc.) ─────────────────────────────────
function NumField({ value, label, unit, onSave }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-2.5">
      <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
      <InlineField value={value != null ? String(value) : ''} type="number" step="any"
        placeholder="—" onSave={onSave}
        textClass="text-sm font-mono font-semibold text-gray-900"
        emptyClass="text-sm text-gray-400 italic" />
      {unit && <span className="text-[10px] font-normal text-gray-500">{unit}</span>}
    </div>
  );
}

// ── Label helper ───────────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return <div className="text-xs font-semibold text-gray-700 mb-1">{children}</div>;
}

// ══════════════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════════════
export default function MaterialDetailModal({ material, onClose, onDelete, onUpdate, canEdit = false }) {
  const t = useT();
  const toast = useToast();

  // editMode: 'auto' = use canEdit prop, 'edit' = always edit, 'view' = always view
  const [editMode, setEditMode] = useState('auto');
  const [overrides, setOverrides] = useState({});
  const [pdfLoading, setPdfLoading]   = useState(false);
  const [shareOpen, setShareOpen]     = useState(false);
  const [visibilityLocal, setVisibilityLocal] = useState(material?.visibility || 'private');
  const [localImages, setLocalImages] = useState(material?.images || []);

  // Sync localImages when material prop changes
  useEffect(() => { setLocalImages(material?.images || []); }, [material?.id]);

  const isEditing = editMode === 'edit' || (editMode === 'auto' && canEdit);

  // Merged view — overrides win over original prop
  const m = { ...material, ...overrides };

  // Categories for the inline select
  const { data: categories = [] } = useQuery({
    queryKey: ['material-categories'],
    queryFn: materialService.getCategories,
    enabled: isEditing,
    staleTime: 5 * 60_000,
  });

  // ── saveField ────────────────────────────────────────────────────────────────
  const saveField = async (field, rawValue) => {
    let dbValue = rawValue;
    let overrideValue = rawValue;

    if (NUMERIC_FIELDS.has(field)) {
      dbValue = rawValue !== '' && rawValue != null ? parseFloat(String(rawValue)) : null;
      overrideValue = dbValue;
    } else if (JSON_ARRAY_FIELDS.has(field)) {
      dbValue = JSON.stringify(rawValue); // rawValue is array
      overrideValue = rawValue;           // store array in overrides (safeJsonParse handles it)
    } else if (field === 'env_links') {
      const links = String(rawValue).split('\n').map(s => s.trim()).filter(Boolean).map(url => ({ url }));
      dbValue = JSON.stringify(links);
      overrideValue = links;             // store parsed array; safeJsonParse returns arrays directly
    } else if (field === 'similar_material_ids') {
      const ids = String(rawValue).split(/[\n,]/).map(s => s.trim()).filter(Boolean);
      dbValue = JSON.stringify(ids);
      overrideValue = ids;
    }

    await materialService.update(material.id, { [field]: dbValue });
    setOverrides(prev => ({ ...prev, [field]: overrideValue }));
    if (onUpdate) onUpdate({ ...material, ...overrides, [field]: overrideValue });
    toast.success('Gespeichert');
  };

  // ── KiDropZone apply ─────────────────────────────────────────────────────────
  const handleKiApply = async (data) => {
    const saves = [];
    const applyMap = {
      name: v => saves.push(saveField('name', v)),
      short_description: v => saves.push(saveField('short_description', v)),
      description: v => saves.push(saveField('description', v)),
      category: v => saves.push(saveField('category', v)),
      origin_acquisition: v => saves.push(saveField('origin_acquisition', v)),
      use_processing: v => saves.push(saveField('use_processing', v)),
      use_where: v => saves.push(saveField('use_where', v)),
      use_not_suitable: v => saves.push(saveField('use_not_suitable', v)),
      previous_use: v => saves.push(saveField('previous_use', v)),
      tech_dimensions: v => saves.push(saveField('tech_dimensions', v)),
      tech_density: v => saves.push(saveField('tech_density', v)),
      tech_thermal_insulation: v => saves.push(saveField('tech_thermal_insulation', v)),
      tech_compressive_strength: v => saves.push(saveField('tech_compressive_strength', v)),
      tech_flammability: v => saves.push(saveField('tech_flammability', v)),
      contact_person: v => saves.push(saveField('contact_person', v)),
      notes: v => saves.push(saveField('notes', v)),
      manufacturer: v => saves.push(saveField('manufacturer', v)),
      declared_unit: v => saves.push(saveField('declared_unit', v)),
      sust_climate_description: v => saves.push(saveField('sust_climate_description', v)),
      circularity: v => saves.push(saveField('circularity', v)),
      human_health: v => saves.push(saveField('human_health', v)),
      processing_sustainability: v => saves.push(saveField('processing_sustainability', v)),
      gwp_fossil: v => saves.push(saveField('gwp_fossil', v)),
      gwp_biogenic: v => saves.push(saveField('gwp_biogenic', v)),
      gwp_value: v => saves.push(saveField('gwp_value', v)),
      cert_epd: v => saves.push(saveField('cert_epd', Boolean(v))),
      principles_consistency: v => Array.isArray(v) && saves.push(saveField('principles_consistency', v)),
      principles_efficiency: v => Array.isArray(v) && saves.push(saveField('principles_efficiency', v)),
    };
    Object.entries(data).forEach(([k, v]) => applyMap[k]?.(v));
    await Promise.all(saves);
  };

  // ── Image handlers ────────────────────────────────────────────────────────────
  const handleImageUpload = async (files, opts) => {
    const uploaded = await materialImageService.upload(material.id, files, opts);
    const newImgs = Array.isArray(uploaded) ? uploaded : [uploaded];
    setLocalImages(prev => [...prev, ...newImgs]);
    if (onUpdate) onUpdate({ ...material, ...overrides, images: [...localImages, ...newImgs] });
  };
  const handleImageDelete = async (imageId) => {
    await materialImageService.delete(material.id, imageId);
    const next = localImages.filter(i => i.id !== imageId);
    setLocalImages(next);
    if (onUpdate) onUpdate({ ...material, ...overrides, images: next });
  };
  const handleNewImages = async (files) => {
    await handleImageUpload(files, { sort_start: localImages.length });
  };

  async function handleDownloadPdf() {
    setPdfLoading(true);
    try { await materialService.downloadPdf(material.id, `material-${m.material_id || material.id}.pdf`); }
    catch (err) { console.error('PDF download failed', err); }
    finally { setPdfLoading(false); }
  }

  // ── Computed from m (so overrides apply to arrays too) ────────────────────────
  const similarIds = useMemo(() => {
    const parsed = safeJsonParse(m?.similar_material_ids, []);
    return Array.isArray(parsed) ? parsed : [];
  }, [m?.similar_material_ids]);

  const envLinks = useMemo(() => {
    const parsed = safeJsonParse(m?.env_links, []);
    return Array.isArray(parsed) ? parsed : [];
  }, [m?.env_links]);

  const envLinksText = useMemo(() =>
    envLinks.map(l => typeof l === 'string' ? l : l?.url || '').filter(Boolean).join('\n'),
    [envLinks]
  );

  const suff = useMemo(() => { const p = safeJsonParse(m?.principles_sufficiency, []); return Array.isArray(p) ? p : []; }, [m?.principles_sufficiency]);
  const cons = useMemo(() => { const p = safeJsonParse(m?.principles_consistency, []); return Array.isArray(p) ? p : []; }, [m?.principles_consistency]);
  const eff  = useMemo(() => { const p = safeJsonParse(m?.principles_efficiency,  []); return Array.isArray(p) ? p : []; }, [m?.principles_efficiency]);

  const gwpComponents = [
    { key: 'gwp_fossil',   label: 'fossil' },
    { key: 'gwp_biogenic', label: 'biogen' },
    { key: 'gwp_luluc',    label: 'luluc' },
  ];

  if (!material) return null;

  // ── Toggle pill ────────────────────────────────────────────────────────────────
  const MODES = [
    { key: 'auto',  Icon: Wand2, label: 'Auto' },
    { key: 'edit',  Icon: Pencil, label: 'Bearbeiten' },
    { key: 'view',  Icon: Eye,    label: 'Ansicht' },
  ];

  return (
    <>
    <div className="fixed inset-0 z-[9999] bg-black/50 p-4 flex items-center justify-center">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden bg-gray-50 rounded-2xl shadow-2xl border border-gray-200">

        {/* ── Header ── */}
        <div className="bg-white border-b border-gray-200 px-5 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <Leaf className="w-5 h-5 text-primary-600 flex-shrink-0" />
              {isEditing
                ? <InlineField value={m.name} onSave={v => saveField('name', v)}
                    textClass="text-xl font-bold text-gray-900" placeholder="Materialname" />
                : <h2 className="text-xl font-bold text-gray-900 truncate">{m.name}</h2>
              }
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {isEditing ? (
                <InlineSelect value={m.category} options={categories} placeholder="Kategorie…"
                  onSave={v => saveField('category', v)}
                  textClass="text-xs text-gray-800 font-medium" />
              ) : m.category ? (
                <span className="px-2.5 py-1 rounded-full text-xs border border-gray-200 bg-gray-50 text-gray-800">{m.category}</span>
              ) : null}
              <VisibilityBadge visibility={visibilityLocal} />
              {isEditing ? (
                <InlineSelect value={m.origin_source} options={ORIGIN_SOURCE_OPTIONS}
                  placeholder="Herkunft…" onSave={v => saveField('origin_source', v)}
                  textClass="text-xs text-amber-900" />
              ) : m.origin_source ? (
                <span className="px-2.5 py-1 rounded-full text-xs border border-amber-200 bg-amber-50 text-amber-900">
                  {ORIGIN_SOURCE_LABELS[m.origin_source] || m.origin_source}
                </span>
              ) : null}
              {typeof m.gwp_total_value === 'number' ? (
                <span className="px-2.5 py-1 rounded-full text-xs border border-primary-200 bg-primary-50 text-primary-900">
                  {t('materialDetail.labels.gwpTotal')}: {m.gwp_total_value} {m.gwp_total_unit || 'kg CO2e'}
                </span>
              ) : m.gwp_value != null ? (
                <span className="px-2.5 py-1 rounded-full text-xs border border-primary-200 bg-primary-50 text-primary-900">
                  GWP: {m.gwp_value} {m.gwp_unit || 'kg CO2e'}
                </span>
              ) : null}
              {m.manufacturer && <span className="text-xs text-gray-500">{m.manufacturer}{m.sku ? ` · ${m.sku}` : ''}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {m.owner_id && (
              <OwnerLine ownerId={m.owner_id} ownerFirstName={m.owner_first_name}
                ownerLastName={m.owner_last_name} ownerEmail={m.owner_email}
                contextLabel={material.name} />
            )}
            {canEdit && (
              <button onClick={() => setShareOpen(true)}
                className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50" type="button" title="Sichtbarkeit & Freigabe">
                <Share2 className="w-5 h-5" />
              </button>
            )}
            {canEdit && onDelete && (
              <button onClick={() => { if (window.confirm(t('materialDetail.deleteConfirm'))) onDelete(); }}
                className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50" type="button" title={t('materialDetail.deleteTitle')}>
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100" type="button">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-5 overflow-y-auto max-h-[calc(92vh-144px)]">

          {/* KiDropZone — edit mode only */}
          {isEditing && (
            <div className="mb-4">
              <KiDropZone onApply={handleKiApply} onImages={handleNewImages} />
            </div>
          )}

          {/* Images */}
          {isEditing ? (
            <div className="mb-4">
              <ImageUploader images={localImages} onUpload={handleImageUpload}
                onDelete={handleImageDelete} label="Bilder" />
            </div>
          ) : localImages.length > 0 ? (
            <ImageGallery images={localImages} name={m.name} />
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Short description / Description */}
            <Section title={t('materialDetail.sections.shortDescription')} icon={Info}>
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <FieldLabel>Kurzbeschreibung</FieldLabel>
                    <InlineField value={m.short_description} multiline
                      onSave={v => saveField('short_description', v)} placeholder="Kurzbeschreibung…" />
                  </div>
                  <div>
                    <FieldLabel>Beschreibung</FieldLabel>
                    <InlineField value={m.description} multiline
                      onSave={v => saveField('description', v)} placeholder="Ausführliche Beschreibung…" />
                  </div>
                  <div>
                    <FieldLabel>Hersteller / Marke</FieldLabel>
                    <InlineField value={m.manufacturer} onSave={v => saveField('manufacturer', v)} placeholder="Hersteller…" />
                  </div>
                  <div>
                    <FieldLabel>Artikelnummer / SKU</FieldLabel>
                    <InlineField value={m.sku} onSave={v => saveField('sku', v)} placeholder="SKU…" />
                  </div>
                </div>
              ) : m.short_description ? (
                <p className="text-sm text-gray-800 leading-relaxed">{m.short_description}</p>
              ) : m.description ? (
                <p className="text-sm text-gray-800 leading-relaxed">{m.description}</p>
              ) : <EmptyHint>{t('materialDetail.empty.noDescription')}</EmptyHint>}
            </Section>

            {/* Origin / Acquisition */}
            <Section title={t('materialDetail.sections.originAcquisition')} icon={Info}>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <FieldLabel>Herkunft / Herstellungsweg</FieldLabel>
                    <InlineField value={m.origin_acquisition} multiline
                      onSave={v => saveField('origin_acquisition', v)} placeholder="Herkunft / Herstellungsweg…" />
                  </div>
                  <div>
                    <FieldLabel>Vorherige Nutzung</FieldLabel>
                    <InlineField value={m.previous_use} multiline
                      onSave={v => saveField('previous_use', v)} placeholder="Vorherige Nutzung…" />
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                    <span className="text-xs text-gray-500 flex-shrink-0">Ansprechpartner:</span>
                    <InlineField value={m.contact_person} onSave={v => saveField('contact_person', v)}
                      placeholder="Name…" textClass="text-xs font-medium text-gray-800" emptyClass="text-xs text-gray-400 italic" />
                  </div>
                </div>
              ) : (
                <>
                  {m.origin_acquisition
                    ? <p className="text-sm text-gray-800 leading-relaxed">{m.origin_acquisition}</p>
                    : <EmptyHint>{t('materialDetail.empty.noOrigin')}</EmptyHint>}
                  {m.contact_person && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">Ansprechpartner: </span>
                      <span className="text-xs font-medium text-gray-800">{m.contact_person}</span>
                    </div>
                  )}
                </>
              )}
            </Section>

            {/* Use / Processing */}
            <Section title={t('materialDetail.sections.useProcessing')} icon={Wrench}>
              <div className="space-y-3">
                {isEditing ? (
                  <>
                    <div>
                      <FieldLabel>{t('materialDetail.labels.applicationAreas')}</FieldLabel>
                      <InlineField value={m.use_processing} multiline
                        onSave={v => saveField('use_processing', v)} placeholder="Verarbeitung / Einbau…" />
                    </div>
                    <div>
                      <FieldLabel>Einsatzbereiche</FieldLabel>
                      <InlineField value={m.use_where} multiline
                        onSave={v => saveField('use_where', v)} placeholder="Wo kann es eingesetzt werden?…" />
                    </div>
                    <div>
                      <FieldLabel>Innen / Außen</FieldLabel>
                      <InlineField value={m.use_indoor_outdoor} onSave={v => saveField('use_indoor_outdoor', v)} placeholder="z.B. Innenraum, Außenbereich…" />
                    </div>
                    <div>
                      <FieldLabel>Einschränkungen</FieldLabel>
                      <InlineField value={m.use_limitations} multiline
                        onSave={v => saveField('use_limitations', v)} placeholder="Einschränkungen…" />
                    </div>
                    <div>
                      <FieldLabel>Nicht geeignet für</FieldLabel>
                      <InlineField value={m.use_not_suitable} multiline
                        onSave={v => saveField('use_not_suitable', v)} placeholder="Nicht geeignet für…" />
                    </div>
                    <div>
                      <FieldLabel>Ähnliche Materialien (IDs, kommagetrennt)</FieldLabel>
                      <InlineField value={similarIds.join(', ')}
                        onSave={v => saveField('similar_material_ids', v)} placeholder="ID1, ID2, …" />
                    </div>
                  </>
                ) : (
                  <>
                    {m.use_processing && (
                      <div>
                        <FieldLabel>{t('materialDetail.labels.applicationAreas')}</FieldLabel>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap">{m.use_processing}</div>
                      </div>
                    )}
                    {m.use_indoor_outdoor && (
                      <div>
                        <FieldLabel>{t('materialDetail.labels.indoorOutdoor')}</FieldLabel>
                        <div className="text-sm text-gray-800">{m.use_indoor_outdoor}</div>
                      </div>
                    )}
                    {m.use_limitations && (
                      <div>
                        <FieldLabel>{t('materialDetail.labels.limitations')}</FieldLabel>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap">{m.use_limitations}</div>
                      </div>
                    )}
                    {!m.use_processing && !m.use_indoor_outdoor && !m.use_limitations && !similarIds.length && (
                      <EmptyHint>{t('materialDetail.empty.noUse')}</EmptyHint>
                    )}
                  </>
                )}
                {similarIds.length > 0 && !isEditing && (
                  <div>
                    <FieldLabel>{t('materialDetail.labels.similarMaterials')}</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {similarIds.map(id => (
                        <Link key={id} to={`/materials/${id}`}
                          className="px-3 py-1 rounded-full text-xs border border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100"
                          onClick={onClose}>{id}</Link>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">{t('materialDetail.labels.similarHint')}</div>
                  </div>
                )}
              </div>
            </Section>

            {/* Technical data */}
            <Section title={t('materialDetail.sections.technicalData')} icon={Ruler}>
              <CadButton material={material} />
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    ['tech_thicknesses', t('materialDetail.labels.availableThicknesses')],
                    ['tech_dimensions', t('materialDetail.labels.availableDimensions')],
                    ['tech_density', t('materialDetail.labels.density')],
                    ['tech_flammability', t('materialDetail.labels.flammability')],
                    ['tech_acoustics', t('materialDetail.labels.acoustics')],
                    ['tech_thermal_insulation', t('materialDetail.labels.thermalInsulation')],
                    ['tech_compressive_strength', 'Druckfestigkeit'],
                    ['tech_tensile_strength', 'Zugfestigkeit'],
                  ].map(([field, label]) => (
                    <div key={field} className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                      <div className="text-xs text-gray-500 mb-1">{label}</div>
                      <InlineField value={m[field]} onSave={v => saveField(field, v)} placeholder="—"
                        textClass="text-sm font-medium text-gray-900" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    ['tech_thicknesses', t('materialDetail.labels.availableThicknesses')],
                    ['tech_dimensions', t('materialDetail.labels.availableDimensions')],
                    ['tech_density', t('materialDetail.labels.density')],
                    ['tech_flammability', t('materialDetail.labels.flammability')],
                    ['tech_acoustics', t('materialDetail.labels.acoustics')],
                    ['tech_thermal_insulation', t('materialDetail.labels.thermalInsulation')],
                  ].map(([field, label]) => (
                    <div key={field} className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="text-sm font-medium text-gray-900 mt-1">{m[field] || '—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Sustainability */}
            <Section title={t('materialDetail.sections.sustainability')} icon={Recycle}>
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <FieldLabel>Klimabeschreibung</FieldLabel>
                      <InlineField value={m.sust_climate_description} multiline
                        onSave={v => saveField('sust_climate_description', v)} placeholder="Klimawirkung beschreiben…" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                        <div className="text-xs text-gray-500 mb-1">{t('materialDetail.labels.recyclateContent')} (%)</div>
                        <InlineField value={m.recyclate_content != null ? String(m.recyclate_content) : ''} type="number" step="0.1"
                          onSave={v => saveField('recyclate_content', v)} placeholder="—"
                          textClass="text-sm font-medium text-gray-900" />
                      </div>
                      <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                        <div className="text-xs text-gray-500 mb-1">GWP gesamt (kg CO₂e)</div>
                        <InlineField value={m.gwp_total_value != null ? String(m.gwp_total_value) : ''} type="number" step="any"
                          onSave={v => saveField('gwp_total_value', v)} placeholder="—"
                          textClass="text-sm font-medium text-gray-900" />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>{t('materialDetail.labels.circularity')}</FieldLabel>
                      <InlineField value={m.circularity} multiline
                        onSave={v => saveField('circularity', v)} placeholder="Kreislauffähigkeit beschreiben…" />
                    </div>
                    <div>
                      <FieldLabel>{t('materialDetail.labels.humanHealth')}</FieldLabel>
                      <InlineField value={m.human_health} multiline
                        onSave={v => saveField('human_health', v)} placeholder="Gesundheit / VOC…" />
                    </div>
                    <div>
                      <FieldLabel>{t('materialDetail.labels.processingSustainability')}</FieldLabel>
                      <InlineField value={m.processing_sustainability} multiline
                        onSave={v => saveField('processing_sustainability', v)} placeholder="Be- & Verarbeitung…" />
                    </div>

                    {/* Certifications */}
                    <div>
                      <FieldLabel>Zertifikate</FieldLabel>
                      <div className="flex flex-wrap gap-2">
                        <InlineCheckbox value={Boolean(m.cert_epd)} label="EPD" onSave={v => saveField('cert_epd', v)} />
                        <InlineCheckbox value={Boolean(m.cert_cradle_to_cradle)} label="Cradle to Cradle" onSave={v => saveField('cert_cradle_to_cradle', v)} />
                        <InlineCheckbox value={Boolean(m.cert_fsc_pefc)} label="FSC / PEFC" onSave={v => saveField('cert_fsc_pefc', v)} />
                        <InlineCheckbox value={Boolean(m.recyclable)} label="Recycelbar" onSave={v => saveField('recyclable', v)} />
                        <InlineCheckbox value={Boolean(m.biodegradable)} label="Biologisch abbaubar" onSave={v => saveField('biodegradable', v)} />
                      </div>
                    </div>

                    {/* Principles */}
                    <div>
                      <FieldLabel>Prinzipien – Konsistenz</FieldLabel>
                      <InlineTags value={cons} options={PRINCIPLES_OPTIONS.consistency}
                        onSave={v => saveField('principles_consistency', v)} />
                    </div>
                    <div>
                      <FieldLabel>Prinzipien – Effizienz</FieldLabel>
                      <InlineTags value={eff} options={PRINCIPLES_OPTIONS.efficiency}
                        onSave={v => saveField('principles_efficiency', v)} />
                    </div>
                    <div>
                      <FieldLabel>Prinzipien – Suffizienz</FieldLabel>
                      <InlineTags value={suff} options={PRINCIPLES_OPTIONS.sufficiency}
                        onSave={v => saveField('principles_sufficiency', v)} />
                    </div>
                  </>
                ) : (
                  <>
                    {m.sust_climate_description && (
                      <div>
                        <FieldLabel>{t('materialDetail.labels.climateImpact')}</FieldLabel>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap">{m.sust_climate_description}</div>
                      </div>
                    )}
                    {typeof m.gwp_total_value === 'number' && (
                      <div className="text-xs text-gray-600">{t('materialDetail.labels.gwpTotal')}: {m.gwp_total_value} {m.gwp_total_unit || 'kg CO2e'}</div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {m.recyclate_content != null && m.recyclate_content !== '' && (
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                          <div className="text-xs text-gray-500">{t('materialDetail.labels.recyclateContent')}</div>
                          <div className="text-sm font-medium text-gray-900 mt-1">{m.recyclate_content}%</div>
                        </div>
                      )}
                      {m.circularity && (
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                          <div className="text-xs text-gray-500">{t('materialDetail.labels.circularity')}</div>
                          <div className="text-sm font-medium text-gray-900 mt-1">{m.circularity}</div>
                        </div>
                      )}
                      {m.human_health && (
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                          <div className="text-xs text-gray-500">{t('materialDetail.labels.humanHealth')}</div>
                          <div className="text-sm font-medium text-gray-900 mt-1">{m.human_health}</div>
                        </div>
                      )}
                      {m.processing_sustainability && (
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                          <div className="text-xs text-gray-500">{t('materialDetail.labels.processingSustainability')}</div>
                          <div className="text-sm font-medium text-gray-900 mt-1">{m.processing_sustainability}</div>
                        </div>
                      )}
                    </div>
                    {(suff.length || cons.length || eff.length) ? (
                      <div className="space-y-3">
                        <TagGroup title={t('materialDetail.labels.sufficiency')} items={suff} />
                        <TagGroup title={t('materialDetail.labels.consistency')} items={cons} />
                        <TagGroup title={t('materialDetail.labels.efficiency')} items={eff} />
                      </div>
                    ) : <EmptyHint>{t('materialDetail.empty.noSustainabilityTags')}</EmptyHint>}
                  </>
                )}
              </div>
            </Section>

            {/* EPD section */}
            {(m.gwp_fossil != null || m.gwp_biogenic != null || m.gwp_luluc != null ||
              m.adp_fossil != null || m.adp_elements != null || m.water_consumption != null ||
              m.declared_unit || m.lifecycle_scope || isEditing) && (
              <Section title={t('materialDetail.sections.epd')} icon={FlaskConical}>
                <div className="space-y-3">
                  {isEditing && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Deklarierte Einheit</FieldLabel>
                        <InlineField value={m.declared_unit} onSave={v => saveField('declared_unit', v)} placeholder="z.B. 1 kg" />
                      </div>
                      <div>
                        <FieldLabel>Systemgrenze</FieldLabel>
                        <InlineSelect value={m.lifecycle_scope} options={LIFECYCLE_SCOPE_OPTIONS}
                          placeholder="Systemgrenze…" onSave={v => saveField('lifecycle_scope', v)} />
                      </div>
                    </div>
                  )}
                  {!isEditing && (m.declared_unit || m.lifecycle_scope) && (
                    <div className="flex flex-wrap gap-4">
                      {m.declared_unit && <div><div className="text-xs text-gray-500">Deklarierte Einheit</div><div className="text-sm font-mono font-medium text-gray-900 mt-0.5">{m.declared_unit}</div></div>}
                      {m.lifecycle_scope && <div><div className="text-xs text-gray-500">Systemgrenze</div><div className="text-sm font-medium text-gray-900 mt-0.5">{m.lifecycle_scope}</div></div>}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {gwpComponents.map(({ key, label }) => isEditing ? (
                      <NumField key={key} value={m[key]} label={`GWP ${label}`} unit="kg CO₂e"
                        onSave={v => saveField(key, v)} />
                    ) : (m[key] != null && (
                      <div key={key} className="bg-gray-50 rounded-xl border border-gray-200 p-2.5">
                        <div className="text-[10px] text-gray-500">GWP {label}</div>
                        <div className="text-sm font-mono font-semibold text-gray-900 mt-0.5">
                          {Number(m[key]).toLocaleString('de-DE', { maximumFractionDigits: 4 })}
                          <span className="text-[10px] font-normal text-gray-500 ml-1">kg CO₂e</span>
                        </div>
                      </div>
                    )))}
                    {(() => {
                      const f = m.gwp_fossil ?? 0, b = m.gwp_biogenic ?? 0, l = m.gwp_luluc ?? 0;
                      const hasAny = m.gwp_fossil != null || m.gwp_biogenic != null || m.gwp_luluc != null;
                      if (!hasAny) return null;
                      const total = Number(f) + Number(b) + Number(l);
                      return (
                        <div className="bg-green-50 rounded-xl border border-green-200 p-2.5">
                          <div className="text-[10px] text-green-700">GWP gesamt</div>
                          <div className="text-sm font-mono font-bold text-green-900 mt-0.5">
                            {total.toLocaleString('de-DE', { maximumFractionDigits: 4 })}
                            <span className="text-[10px] font-normal text-green-700 ml-1">kg CO₂e</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* ADP, Water */}
                  {isEditing ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        ['adp_fossil', 'ADPF', 'MJ'], ['adp_elements', 'ADPE', 'kg Sb-Äq.'],
                        ['water_consumption', 'WDP', 'm³'], ['odp', 'ODP', 'kg R11-Äq.'],
                        ['ap', 'AP', 'mol H+ Äq.'], ['ep_terrestrial', 'EP terrestr.', 'mol N Äq.'],
                        ['ep_freshwater', 'EP Süßwasser', 'kg P Äq.'], ['ep_marine', 'EP Meer', 'kg N Äq.'],
                        ['pocp', 'POCP', 'kg NMVOC Äq.'], ['hwd', 'HWD', 'kg'], ['nhwd', 'NHWD', 'kg'], ['rwd', 'RWD', 'MJ'],
                        ['pere', 'PERE', 'MJ'], ['penre', 'PENRE', 'MJ'], ['perm', 'PERM', 'MJ'],
                      ].map(([field, label, unit]) => (
                        <NumField key={field} value={m[field]} label={label} unit={unit}
                          onSave={v => saveField(field, v)} />
                      ))}
                    </div>
                  ) : (
                    <>
                      {(m.adp_fossil != null || m.adp_elements != null) && (
                        <div className="grid grid-cols-2 gap-2">
                          {m.adp_fossil != null && (
                            <div className="bg-gray-50 rounded-xl border border-gray-200 p-2.5">
                              <div className="text-[10px] text-gray-500">ADPF</div>
                              <div className="text-sm font-mono font-semibold text-gray-900 mt-0.5">
                                {Number(m.adp_fossil).toLocaleString('de-DE', { maximumFractionDigits: 4 })} <span className="text-[10px] font-normal text-gray-500">MJ</span>
                              </div>
                            </div>
                          )}
                          {m.adp_elements != null && (
                            <div className="bg-gray-50 rounded-xl border border-gray-200 p-2.5">
                              <div className="text-[10px] text-gray-500">ADPE</div>
                              <div className="text-sm font-mono font-semibold text-gray-900 mt-0.5">
                                {Number(m.adp_elements).toExponential(2)} <span className="text-[10px] font-normal text-gray-500">kg Sb-Äq.</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {m.water_consumption != null && (
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-2.5 inline-flex flex-col">
                          <div className="text-[10px] text-gray-500">WDP</div>
                          <div className="text-sm font-mono font-semibold text-gray-900 mt-0.5">
                            {Number(m.water_consumption).toLocaleString('de-DE', { maximumFractionDigits: 5 })} <span className="text-[10px] font-normal text-gray-500">m³</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Source URL / EPD notes */}
                  {isEditing && (
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                      <div>
                        <FieldLabel>EPD-URL / Quelle</FieldLabel>
                        <InlineField value={m.source_url} onSave={v => saveField('source_url', v)} placeholder="https://…" />
                      </div>
                      <div>
                        <FieldLabel>EPD-Nummer / Hinweise</FieldLabel>
                        <InlineField value={m.notes} multiline onSave={v => saveField('notes', v)} placeholder="Hinweise, EPD-Nummer…" />
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

          </div>

          {/* LCA / IDEMAT — full width */}
          {(material.idemat_process_id || isEditing) && (
            <div className="mt-4">
              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-3">
                  <Leaf className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Ökobilanz (LCA) — EF 3.1</h3>
                </div>
                <div className="p-5 space-y-4">
                  {isEditing && (
                    <div>
                      <FieldLabel>IDEMAT-Prozess verknüpfen</FieldLabel>
                      <IdematLinker processId={m.idemat_process_id}
                        onSelect={r => saveField('idemat_process_id', r.id)}
                        onClear={() => saveField('idemat_process_id', null)} />
                    </div>
                  )}
                  <LcaSection material={material} canEdit={false} />
                </div>
              </section>
            </div>
          )}

          {/* Further info + Appendix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Section title={t('materialDetail.sections.furtherInfo')} icon={ExternalLink}>
              {isEditing ? (
                <div className="space-y-2">
                  <FieldLabel>URLs (eine pro Zeile)</FieldLabel>
                  <InlineField value={envLinksText} multiline
                    onSave={v => saveField('env_links', v)} placeholder="https://…" />
                </div>
              ) : envLinks.length ? (
                <div className="space-y-2">
                  {envLinks.map((l, idx) => {
                    const url   = typeof l === 'string' ? l : l?.url;
                    const label = typeof l === 'string' ? l : l?.label || l?.url;
                    if (!url) return null;
                    return (
                      <a key={`${url}-${idx}`} href={url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary-700 hover:text-primary-800">
                        <ExternalLink className="w-4 h-4" />
                        <span className="truncate">{label}</span>
                      </a>
                    );
                  })}
                </div>
              ) : <EmptyHint>{t('materialDetail.empty.noLinks')}</EmptyHint>}
            </Section>

            <Section title={t('materialDetail.sections.appendix')} icon={Info}>
              {isEditing ? (
                <InlineField value={m.appendix} multiline
                  onSave={v => saveField('appendix', v)} placeholder="Anhang / Notizen…" />
              ) : m.appendix ? (
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{m.appendix}</div>
              ) : <EmptyHint>{t('materialDetail.empty.noAppendix')}</EmptyHint>}
            </Section>

            {/* Location (edit only) */}
            {isEditing && (
              <Section title="Standort" icon={MapPin}>
                <div className="space-y-3">
                  <div>
                    <FieldLabel>Ortsname</FieldLabel>
                    <InlineField value={m.location_name} onSave={v => saveField('location_name', v)} placeholder="z.B. Leipzig, DE" />
                  </div>
                  <div>
                    <FieldLabel>Adresse</FieldLabel>
                    <InlineField value={m.address} multiline onSave={v => saveField('address', v)} placeholder="Straße, PLZ, Stadt…" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Breitengrad</FieldLabel>
                      <InlineField value={m.latitude != null ? String(m.latitude) : ''} type="number" step="any"
                        onSave={v => saveField('latitude', v)} placeholder="51.05…"
                        textClass="text-sm font-mono text-gray-900" />
                    </div>
                    <div>
                      <FieldLabel>Längengrad</FieldLabel>
                      <InlineField value={m.longitude != null ? String(m.longitude) : ''} type="number" step="any"
                        onSave={v => saveField('longitude', v)} placeholder="12.12…"
                        textClass="text-sm font-mono text-gray-900" />
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {/* Source URL / Notes (view mode) */}
            {!isEditing && (m.source_url || m.notes) && (
              <Section title="Quellen & Hinweise" icon={Info}>
                {m.source_url && (
                  <a href={m.source_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary-700 hover:text-primary-800 mb-2">
                    <ExternalLink className="w-4 h-4" /> {m.source_url}
                  </a>
                )}
                {m.notes && <div className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{m.notes}</div>}
              </Section>
            )}
          </div>

          {m.material_id && (
            <div className="pt-4">
              <MaterialIdSection materialId={m.material_id}
                passportType={material.passport_type || 'construction'}
                entityType="materials" entityId={material.id} />
            </div>
          )}
        </div>

        <SharePrintBar
          url={`${window.location.origin}/materials/${material.id}`}
          title={material.name}
          onPrint={() => exportMaterialPoster(material)}
          actions={
            <>
              <button onClick={handleDownloadPdf} disabled={pdfLoading} title="Datenblatt als PDF herunterladen"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50">
                <FileDown size={15} />
                {pdfLoading ? 'Lade…' : 'PDF'}
              </button>
              <BookmarkButton entityType="material" entityId={material.id} showCount size="md" />
            </>
          }
        />
      </div>
    </div>

    {/* Share dialog */}
    {shareOpen && (
      <ShareDialog materialId={material.id} currentVisibility={visibilityLocal}
        isOwner={canEdit} onClose={() => setShareOpen(false)}
        onVisibilityChange={v => setVisibilityLocal(v)} />
    )}

    {/* ── Edit mode toggle (fixed bottom-right, only shown if user can edit) ── */}
    {canEdit && (
      <div className="fixed bottom-6 right-6 z-[10000] flex items-center gap-1 bg-white rounded-full shadow-lg border border-gray-200 p-1">
        {MODES.map(({ key, Icon, label }) => (
          <button key={key} type="button" onClick={() => setEditMode(key)}
            title={label}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              editMode === key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    )}
    </>
  );
}
