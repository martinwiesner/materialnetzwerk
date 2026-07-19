import { useState, useEffect, useRef } from 'react';

function normalizeUnit(u) {
  if (!u) return '';
  let s = u.trim().replace(/^[\d.,]+\s*/, '').trim().toLowerCase();
  if (['metric ton', 'metric tons', 'tonne', 'tonnes', 'tonnen'].includes(s)) s = 't';
  if (['m3', 'cubic meter', 'cubic metre', 'kubikmeter'].includes(s)) s = 'm³';
  if (['m2', 'square meter', 'square metre', 'quadratmeter'].includes(s)) s = 'm²';
  if (['kilogramm', 'kilogram', 'kilograms'].includes(s)) s = 'kg';
  if (['piece', 'pieces', 'stück', 'stk', 'pce', 'pcs', 'unit', 'units'].includes(s)) s = 'stk';
  return s;
}
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/projectService';
import { materialService } from '../../services/materialService';
import { actorService } from '../../services/actorService';
import { X, Globe, Lock, FileText, Plus, Trash2, Save, Upload, Users,
  ChevronUp, ChevronDown, BookOpen, Tag, Package, MapPin, Leaf, Wrench, Box, ExternalLink, Building2,
  Image as ImageIcon, Check, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import LocationPicker from '../shared/LocationPicker';
import ImageUploader from '../shared/ImageUploader';
import FileUploader from '../shared/FileUploader';
import api, { MEDIA_BASE } from '../../services/api';
import { useToast } from '../../store/toastStore';
import { useT } from '../../i18n/useT';
import InlineUserPicker from '../shared/InlineUserPicker';
import { parseDocumentForMaterial, analyzeImages } from '../../services/materialService';
import OekobaudatPicker from './OekobaudatPicker';
import { EpdFullAnalysis } from './EpdAnalysis';
import ProjectIdematSection from './ProjectIdematSection';

const API_BASE = MEDIA_BASE;

function AccordionSection({ icon: Icon, title, color = '#6b7280', filled = false, defaultOpen = false, forceOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen || open;
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        aria-expanded={isOpen}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          {filled && !isOpen && <span className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" title="Daten vorhanden" />}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {isOpen && <div className="px-4 pb-5 pt-4 space-y-4">{children}</div>}
    </div>
  );
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function toggleInArray(arr, value) {
  const set = new Set(arr || []);
  set.has(value) ? set.delete(value) : set.add(value);
  return Array.from(set);
}

const PRINCIPLES = {
  sufficiency: ['Suffizienz', 'Kollaborativer Konsum', 'Verhaltensänderndes Design'],
  consistency: ['Nachwachsende Rohstoffe', 'Recycelt', 'Recyclinggerecht', 'Reparierbar', 'Kompostierbar'],
  efficiency: [
    'Schadstofffrei', 'Materialeffizient', 'Energieeffizient', 'Langlebiges Design',
    'Logistikgerechtes Design', 'Naturraumerhaltend', 'Fair produziert', 'Wasserschonend',
  ],
};

const CIRCULAR_PRINCIPLES_DE = [
  'Design für Demontage', 'Modulares Design', 'Abfallreduktion',
  'Gebäude als Materialbanken', 'Materialkreisläufe schließen',
  'Wiederaufarbeitung (Remanufacturing)', 'Produkt-als-Service', 'Wertschöpfung aus Abfall',
];

const GENERAL_SUSTAINABILITY = [
  'Klimaschutz', 'Ressourcenschonung', 'Biodiversitätsschutz',
  'Gesundheitsschonend', 'Soziale Fairness', 'Regionale Wertschöpfung',
];

const CONF_STYLE_P = {
  high:   { text: 'text-green-700',  label: 'hoch' },
  medium: { text: 'text-amber-700',  label: 'mittel' },
  low:    { text: 'text-red-600',    label: 'niedrig' },
};

const KI_PROJECT_FIELD_LABELS = {
  name:        'Projekttitel',
  description: 'Kurzbeschreibung',
  content:     'Inhalt / Beschreibung',
  time_effort: 'Zeitaufwand',
  tools:       'Werkzeuge / Hilfsmittel',
  steps:       'Schritte / Herstellungsschritte',
};

function KiDropZone({ onApply, onImages }) {
  const [dragOver, setDragOver] = useState(null); // null | 'img' | 'doc'
  const [status, setStatus]     = useState('idle');
  const [extracted, setExtracted]   = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [selected, setSelected]     = useState({});
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError]           = useState('');
  const imgInputRef = useRef(null);
  const docInputRef = useRef(null);

  const isImage = (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name);
  const isDoc   = (f) => /\.(pdf|docx)$/i.test(f.name) || f.type === 'application/pdf' || f.type.includes('wordprocessingml');

  const processFiles = async (files) => {
    const docFiles   = files.filter(isDoc);
    const imageFiles = files.filter(isImage);
    if (imageFiles.length > 0 && onImages) onImages(imageFiles);
    if (docFiles.length > 0 && imageFiles.length > 0) {
      setStatus('loading');
      setLoadingMsg('Dokument & Bilder werden analysiert…');
      setError('');
      try {
        const [docRes, imgRes] = await Promise.all([
          parseDocumentForMaterial(docFiles[0], 'project'),
          analyzeImages(imageFiles, 'project'),
        ]);
        const merged = { ...(imgRes.data || {}), ...(docRes.data || {}) };
        showPreview(merged, docRes.confidence);
      } catch (e) {
        setError(e?.response?.data?.message || 'Analyse fehlgeschlagen');
        setStatus('error');
      }
    } else if (docFiles.length > 0) {
      await runDocAnalysis(docFiles[0]);
    } else if (imageFiles.length > 0) {
      await runImageAnalysis(imageFiles);
    } else {
      setError('Bitte Bilder oder Dokumente (PDF, DOCX) ablegen.');
      setStatus('error');
    }
  };

  const runDocAnalysis = async (file) => {
    setStatus('loading');
    setLoadingMsg('Dokument wird gelesen und analysiert…');
    setError('');
    try {
      const result = await parseDocumentForMaterial(file, 'project');
      showPreview(result.data || {}, result.confidence);
    } catch (e) {
      setError(e?.response?.data?.message || 'Dokument-Analyse fehlgeschlagen');
      setStatus('error');
    }
  };

  const runImageAnalysis = async (files) => {
    setStatus('loading');
    setLoadingMsg(`${files.length > 1 ? files.length + ' Bilder werden' : 'Bild wird'} analysiert…`);
    setError('');
    try {
      const result = await analyzeImages(files, 'project');
      showPreview(result.data || {}, null);
    } catch (e) {
      setError(e?.response?.data?.message || 'Bildanalyse fehlgeschlagen');
      setStatus('error');
    }
  };

  const showPreview = (data, conf) => {
    setExtracted(data);
    setConfidence(conf || null);
    const init = {};
    Object.keys(data).forEach(k => {
      if (!KI_PROJECT_FIELD_LABELS[k]) return;
      if (Array.isArray(data[k]) && data[k].length === 0) return;
      init[k] = true;
    });
    setSelected(init);
    setStatus('preview');
  };

  const handleApply = () => {
    const toApply = {};
    Object.entries(selected).forEach(([k, on]) => {
      if (on && extracted[k] !== undefined) toApply[k] = extracted[k];
    });
    onApply(toApply);
    reset();
  };

  const reset = () => { setStatus('idle'); setExtracted(null); setConfidence(null); setSelected({}); setError(''); };
  const toggleAll = (val) => setSelected(prev => Object.fromEntries(Object.keys(prev).map(k => [k, val])));

  if (status === 'preview' && extracted) {
    const fields       = Object.keys(KI_PROJECT_FIELD_LABELS).filter(k => extracted[k] !== undefined);
    const checkedCount = Object.values(selected).filter(Boolean).length;
    const totalCount   = fields.length;
    const confStyle    = CONF_STYLE_P[confidence?.overall] || CONF_STYLE_P.medium;

    return (
      <div className="border border-violet-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-violet-100/60 border-b border-violet-200">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="w-4 h-4 text-violet-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-violet-800">{totalCount} Felder erkannt</span>
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

        <div className="px-3 py-2">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-[11px] text-gray-500">{checkedCount}/{totalCount} ausgewählt</span>
            <button type="button" onClick={() => toggleAll(true)}  className="text-[11px] text-violet-600 hover:underline">Alle</button>
            <button type="button" onClick={() => toggleAll(false)} className="text-[11px] text-gray-400 hover:underline">Keine</button>
          </div>
          <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
            {fields.map(k => {
              const val     = extracted[k];
              const display = Array.isArray(val)
                ? (k === 'steps' ? val.map((s, i) => `${i + 1}. ${typeof s === 'string' ? s : (s.title || s.text || '')}`.trim()).join(' · ') : val.join(', '))
                : String(val);
              return (
                <label key={k} className="flex items-start gap-1.5 cursor-pointer py-0.5">
                  <input type="checkbox" checked={!!selected[k]}
                    onChange={() => setSelected(p => ({ ...p, [k]: !p[k] }))}
                    className="mt-0.5 w-3.5 h-3.5 text-violet-600 border-gray-300 rounded flex-shrink-0" />
                  <span className="text-[11px] text-gray-500 leading-tight flex-shrink-0 min-w-[130px]">
                    {KI_PROJECT_FIELD_LABELS[k]}
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
    );
  }

  return (
    <div className="space-y-2">
      {/* Image zone — replaced by spinner while loading */}
      {status === 'loading' ? (
        <div className="flex items-center gap-2.5 px-3 py-3 border border-violet-200 rounded-xl bg-violet-50/50 text-xs text-violet-700">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span className="font-medium">{loadingMsg}</span>
        </div>
      ) : (
        <>
          {status === 'error' && (
            <div className="flex items-start gap-2 px-3 py-2.5 border border-red-200 rounded-xl bg-red-50 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
              <button type="button" onClick={reset} className="ml-auto text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
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
              <p className="text-[11px] text-gray-400 mt-0.5">
                Bild(er) hochladen → Felder werden vorausgefüllt
              </p>
            </div>
            <input
              ref={imgInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
              className="hidden"
              onChange={e => {
                const files = Array.from(e.target.files || []);
                if (files.length) processFiles(files);
                e.target.value = '';
              }}
            />
          </div>
        </>
      )}

      {/* Document zone — always visible and usable */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver('doc'); }}
        onDragLeave={() => setDragOver(null)}
        onDrop={e => { e.preventDefault(); setDragOver(null); processFiles(Array.from(e.dataTransfer.files)); }}
        onClick={() => docInputRef.current?.click()}
        className={`flex items-center gap-3 px-4 py-3 border border-dashed rounded-xl cursor-pointer transition-all select-none
          ${dragOver === 'doc'
            ? 'border-gray-400 bg-gray-50 scale-[1.005]'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'}`}
      >
        <FileText className={`w-5 h-5 flex-shrink-0 ${dragOver === 'doc' ? 'text-gray-500' : 'text-gray-300'}`} />
        <p className="text-[11px] text-gray-400 leading-snug">
          {dragOver === 'doc'
            ? 'Loslassen zum Analysieren'
            : 'Hast du neben Bildern auch Dokumente mit Daten? Auch die kannst du hier reindroppen'}
        </p>
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files || []);
            if (files.length) processFiles(files);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

const emptyForm = {
  name: '',
  description: '',
  content: '',
  location_name: '',
  latitude: null,
  longitude: null,
  address: '',
  status: 'draft',
  is_public: false,
  visibility: 'private',
  share_actor_id: '',
  selectedUsers: [],
  is_available: false,
  materials: [],
  circular_principles: [],
  principles_sufficiency: [],
  principles_consistency: [],
  principles_efficiency: [],
  general_sustainability_principles: [],
  time_effort: '',
  tools: '',
  steps: [],
  references: [],
  license: '',
  cad_share_url: '',
  oekodat_materials: [],
  idemat_lca_items: [],
};

function StepAiButton({ stepIndex, onUpload, ensureDraft, onStepResult }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setLoading(true);
    setError('');
    try {
      const id = await ensureDraft();
      if (!id) return;
      // Upload image as step image
      await onUpload(files, { step_index: stepIndex });
      // Send to AI for step description
      const { default: api } = await import('../../services/api');
      const form = new FormData();
      form.append('mode', 'step');
      form.append('images', files[0]);
      const { data: resp } = await api.post('/ai/analyze', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onStepResult(resp.data);
    } catch (e) {
      setError(e.response?.data?.message ?? 'Analyse fehlgeschlagen');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-0.5">
      <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-violet-600 hover:text-violet-800 py-1">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="hidden" onChange={handleFiles} disabled={loading} />
        {loading ? (
          <><span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /> KI analysiert…</>
        ) : (
          <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4"/><path d="M12 10v4M8 14h8M6 18h12M4 22h16"/></svg> Bild hochladen &amp; KI beschreibt</>
        )}
      </label>
      {error && <p className="text-xs text-red-500">⚠ {error}</p>}
    </div>
  );
}

function StepImageUpload({ stepIndex, onUpload, ensureDraft }) {
  const t = useT();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const id = await ensureDraft();
      if (!id) return;
      await onUpload(files, { step_index: stepIndex });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-primary-600 hover:text-primary-700 py-1">
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleChange} />
      {uploading
        ? <span className="text-gray-400 animate-pulse">{t('projectForm.uploadingStep')}</span>
        : <><Upload className="w-3.5 h-3.5" /> {t('projectForm.uploadStep')}</>
      }
    </label>
  );
}

function libEntryFromFormMat(formMat, libFull) {
  const f = libFull.gwp_fossil   != null ? Number(libFull.gwp_fossil)   : null;
  const b = libFull.gwp_biogenic != null ? Number(libFull.gwp_biogenic) : null;
  const l = libFull.gwp_luluc    != null ? Number(libFull.gwp_luluc)    : null;
  const hasFBL = f != null || b != null || l != null;
  const perUnit = hasFBL ? ((f || 0) + (b || 0) + (l || 0)) : (Number(libFull.gwp_value) || 0);
  if (!perUnit && !hasFBL) return null;
  const indicators = {};
  if (perUnit !== 0)  indicators['GWP-total']    = { mods: { 'A1-A3': perUnit }, unit: 'kg CO₂e' };
  if (f != null)      indicators['GWP-fossil']   = { mods: { 'A1-A3': f }, unit: 'kg CO₂e' };
  if (b != null)      indicators['GWP-biogenic'] = { mods: { 'A1-A3': b }, unit: 'kg CO₂e' };
  if (l != null)      indicators['GWP-luluc']    = { mods: { 'A1-A3': l }, unit: 'kg CO₂e' };
  const n = (field) => libFull[field] != null ? Number(libFull[field]) : null;
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
  addInd('RWD',            'rwd',               'kg');
  addInd('PERE',           'pere',              'MJ');
  addInd('PENRE',          'penre',             'MJ');
  addInd('PERM',           'perm',              'MJ');
  const gwpDenominator = libFull.gwp_unit?.split('/')?.[1]?.trim() || null;
  const declaredUnit = libFull.declared_unit || gwpDenominator || 'kg';
  return {
    uuid: `lib-${libFull.id}`,
    name: libFull.name,
    category: libFull.category || '',
    declaredUnit,
    quantity: Number(formMat.quantity) || 1,
    unit: formMat.unit || declaredUnit,
    gwpA1A3: perUnit !== 0 ? perUnit : null,
    gwpEoL: null, gwpD: null,
    indicators,
    isLibraryMaterial: true,
  };
}

export default function ProjectForm({ project, onClose }) {
  const t = useT();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [localImages, setLocalImages] = useState([]);
  const [localFiles, setLocalFiles] = useState([]);
  const [autoSaving, setAutoSaving] = useState(false);
  const isEditing = !!project;
  const activeId = project?.id || draftId;

  const [actorIds, setActorIds] = useState(['']);
  const [mode, setMode] = useState('project');

  useEffect(() => {
    if (mode === 'offer-only') {
      setFormData(f => ({ ...f, is_available: true, is_public: true, status: 'active' }));
    }
  }, [mode]);

  // Auto-save text fields + steps + oekodat_materials to draft whenever they change (debounced)
  useEffect(() => {
    if (!draftId) return;
    const timer = setTimeout(() => {
      const { name, description, content, time_effort, tools, steps, oekodat_materials, idemat_lca_items } = formData;
      projectService.update(draftId, {
        name, description, content, time_effort, tools,
        steps: steps?.length ? steps : null,
        oekodat_materials: oekodat_materials?.length ? oekodat_materials : null,
        idemat_lca_items: idemat_lca_items?.length ? idemat_lca_items : null,
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [draftId, formData]);

  const { data: materialsData } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materialService.getAll(),
  });
  const availableMaterials = Array.isArray(materialsData) ? materialsData : (materialsData?.data || []);

  const { data: allActors = [] } = useQuery({
    queryKey: ['actors'],
    queryFn: () => actorService.getAll(),
    select: (d) => (Array.isArray(d) ? d : d?.data || []),
  });

  useEffect(() => {
    if (project?.id) {
      projectService.getActors(project.id).then((actors) => {
        setActorIds(actors.length > 0 ? actors.map((a) => a.id) : ['']);
      }).catch(() => {});
    }
  }, [project?.id]);

  useEffect(() => {
    if (project) {
      setLocalImages(project.images || []);
      setLocalFiles(project.files || []);
      let steps = [];
      try { steps = project.steps ? JSON.parse(project.steps) : []; } catch { steps = []; }
      setFormData({
        name: project.name || '',
        description: project.description || '',
        content: project.content || '',
        location_name: project.location_name || '',
        latitude: project.latitude ?? null,
        longitude: project.longitude ?? null,
        address: project.address || '',
        status: project.status || 'draft',
        is_public: project.is_public || false,
        visibility: project.visibility || (project.is_public ? 'public' : 'private'),
        share_actor_id: project.share_actor_id || '',
        selectedUsers: [],
        is_available: project.is_available == 1 || false,
        materials: project.materials?.map(m => ({
          material_id: m.material_id,
          quantity: m.quantity || 1,
          unit: m.unit || '',
        })) || [],
        circular_principles: safeJsonParse(project.circular_principles, []),
        principles_sufficiency: safeJsonParse(project.principles_sufficiency, []),
        principles_consistency: safeJsonParse(project.principles_consistency, []),
        principles_efficiency: safeJsonParse(project.principles_efficiency, []),
        general_sustainability_principles: safeJsonParse(project.general_sustainability_principles, []),
        time_effort: project.time_effort || '',
        tools: project.tools || '',
        steps: Array.isArray(steps) ? steps : [],
        references: safeJsonParse(project.references, []),
        license: project.license || '',
        cad_share_url: project.cad_share_url || '',
        oekodat_materials: safeJsonParse(project.oekodat_materials, []),
        idemat_lca_items: safeJsonParse(project.idemat_lca_items, []),
      });
      const vis = project.visibility || (project.is_public ? 'public' : 'private');
      if (vis === 'selectedUsers') {
        api.get(`/shares/project/${project.id}`).then(r => {
          setFormData(f => ({ ...f, selectedUsers: (r.data || []).map(s => ({ id: s.shared_with_user_id, email: s.email, first_name: s.first_name, last_name: s.last_name })) }));
        }).catch(() => {});
      }
    }
  }, [project]);

  const ensureDraft = async () => {
    if (activeId) return activeId;
    setAutoSaving(true);
    try {
      const submitData = buildSubmitData();
      const created = await projectService.create(submitData);
      setDraftId(created.id);
      setLocalImages(created.images || []);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      return created.id;
    } catch (e) {
      setError('Konnte Entwurf nicht speichern: ' + (e.response?.data?.message || e.message));
      return null;
    } finally {
      setAutoSaving(false);
    }
  };

  const buildSubmitData = () => ({
    ...formData,
    latitude: formData.latitude === '' || formData.latitude == null ? null : Number(formData.latitude),
    longitude: formData.longitude === '' || formData.longitude == null ? null : Number(formData.longitude),
    circular_principles: JSON.stringify(formData.circular_principles || []),
    principles_sufficiency: JSON.stringify(formData.principles_sufficiency || []),
    principles_consistency: JSON.stringify(formData.principles_consistency || []),
    principles_efficiency: JSON.stringify(formData.principles_efficiency || []),
    general_sustainability_principles: JSON.stringify(formData.general_sustainability_principles || []),
    materials: (formData.materials || []).map(m => ({
      ...m,
      quantity: (() => { const p = parseFloat(String(m.quantity ?? '').replace(',', '.')); return isNaN(p) ? 1 : p; })(),
    })),
    steps: formData.steps?.length ? formData.steps : null,
    references: formData.references?.length ? formData.references : null,
    oekodat_materials: formData.oekodat_materials?.length ? formData.oekodat_materials : null,
    idemat_lca_items: formData.idemat_lca_items?.length ? formData.idemat_lca_items : null,
  });

  const createMutation = useMutation({
    mutationFn: projectService.create,
    onSuccess: (created) => {
      setDraftId(created?.id || null);
      setLocalImages(created?.images || []);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projekt erfolgreich angelegt.');
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Erstellen fehlgeschlagen.';
      setError(msg);
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => projectService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projekt gespeichert.');
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Aktualisieren fehlgeschlagen.';
      setError(msg);
      toast.error(msg);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLocationError(false);

    // Standort-Pflichtfeld prüfen (nur im normalen Modus, nicht offer-only)
    if (mode !== 'offer-only' && !formData.location_name && !formData.address) {
      setLocationError(true);
      setError('Bitte einen Standort eingeben — der Abschnitt "Standort" wurde geöffnet.');
      document.querySelector('[data-location-section]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const submitData = buildSubmitData();
    const validActorIds = actorIds.filter(Boolean);
    const selectedUsers = formData.selectedUsers || [];

    const syncUserShares = (projectId) => {
      if (formData.visibility !== 'selectedUsers' || !selectedUsers.length) return;
      for (const u of selectedUsers) {
        api.post(`/shares/project/${projectId}`, { email: u.email, access_level: 'view' }).catch(() => {});
      }
    };

    if (draftId) {
      projectService.setActors(draftId, validActorIds).catch(() => {});
      syncUserShares(draftId);
      updateMutation.mutate({ id: draftId, data: submitData });
    } else if (isEditing) {
      projectService.setActors(project.id, validActorIds).catch(() => {});
      syncUserShares(project.id);
      updateMutation.mutate({ id: project.id, data: submitData });
    } else {
      createMutation.mutate(submitData, {
        onSuccess: (created) => {
          if (created?.id) {
            if (validActorIds.length > 0) {
              projectService.setActors(created.id, validActorIds).catch(() => {});
            }
            syncUserShares(created.id);
          }
        },
      });
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const addMaterial = () =>
    setFormData({ ...formData, materials: [...formData.materials, { material_id: '', quantity: 1, unit: '' }] });

  const removeMaterial = (i) =>
    setFormData({ ...formData, materials: formData.materials.filter((_, j) => j !== i) });

  const updateMaterial = (i, field, value) => {
    const updated = [...formData.materials];
    updated[i] = { ...updated[i], [field]: value };
    setFormData({ ...formData, materials: updated });
  };

  const isPending = createMutation.isPending || updateMutation.isPending || autoSaving;

  const handleImageUpload = async (files, opts) => {
    const id = await ensureDraft();
    if (!id) return;
    const result = await projectService.uploadImages(id, files, opts);
    setLocalImages(prev => [...prev, ...(Array.isArray(result) ? result : [result])]);
  };

  const handleImageDelete = async (imageId) => {
    const id = activeId;
    if (!id) return;
    await projectService.deleteImage(id, imageId);
    setLocalImages(prev => prev.filter(i => i.id !== imageId));
  };

  const handleSetCover = async (imageId) => {
    const id = activeId;
    if (!id) return;
    const updated = await projectService.updateImage(id, imageId, { is_cover: true });
    setLocalImages(Array.isArray(updated) ? updated : localImages);
  };

  const handleSetStep = async (imageId, stepIndex, stepCaption) => {
    const id = activeId;
    if (!id) return;
    const updated = await projectService.updateImage(id, imageId, { step_index: stepIndex, step_caption: stepCaption });
    setLocalImages(Array.isArray(updated) ? updated : localImages);
  };

  const handleFileUpload = async (files) => {
    const id = await ensureDraft();
    if (!id) return;
    const result = await projectService.uploadFiles(id, files);
    setLocalFiles(prev => [...prev, ...(Array.isArray(result) ? result : [result])]);
  };

  const handleFileDelete = async (fileId) => {
    const id = activeId;
    if (!id) return;
    await projectService.deleteFile(id, fileId);
    setLocalFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleSetCredit = async (imageId, credit) => {
    if (!activeId) return;
    await projectService.updateImage(activeId, imageId, { credit });
    setLocalImages(prev => prev.map(img => img.id === imageId ? { ...img, credit } : img));
  };

  const moveStep = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= formData.steps.length) return;
    const oldStep = idx + 1;
    const newStep = newIdx + 1;
    setFormData(f => {
      const steps = [...f.steps];
      [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
      return { ...f, steps };
    });
    setLocalImages(imgs => imgs.map(img => {
      if (img.step_index === oldStep) return { ...img, step_index: newStep };
      if (img.step_index === newStep) return { ...img, step_index: oldStep };
      return img;
    }));
  };

  const draftCreated = !!draftId && !isEditing;

  const locationValue = {
    location_name: formData.location_name,
    address: formData.address,
    latitude: formData.latitude,
    longitude: formData.longitude,
  };
  const handleLocationChange = (loc) =>
    setFormData(f => ({ ...f, location_name: loc.location_name, address: loc.address, latitude: loc.latitude, longitude: loc.longitude }));

  const allPrinciples = [
    ...formData.circular_principles,
    ...formData.principles_sufficiency,
    ...formData.principles_consistency,
    ...formData.principles_efficiency,
    ...formData.general_sustainability_principles,
  ];

  const libAsEpdForm = formData.materials
    .map(m => {
      const full = availableMaterials.find(a => a.id === m.material_id);
      return full ? libEntryFromFormMat(m, full) : null;
    })
    .filter(Boolean);
  const allMaterialsForLca = [...libAsEpdForm, ...(formData.oekodat_materials || [])];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing
                ? t('projectForm.titleEdit')
                : draftCreated
                  ? t('projectForm.titleDraft')
                  : mode === 'offer-only'
                    ? t('projectForm.titleOffer')
                    : t('projectForm.titleNew')}
            </h2>
            {autoSaving && <span className="text-xs text-gray-400 animate-pulse">{t('projectForm.autoSaving')}</span>}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          {/* Mode toggle */}
          {!isEditing && (
            <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
              <button type="button" onClick={() => setMode('project')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  mode === 'project' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Package className="w-3.5 h-3.5" />
                {t('projectForm.modeProject')}
              </button>
              <button type="button" onClick={() => setMode('offer-only')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  mode === 'offer-only' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Tag className="w-3.5 h-3.5" />
                {t('projectForm.modeOffer')}
              </button>
            </div>
          )}

          {draftCreated && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-lg text-sm">
              <Save className="w-4 h-4 inline mr-1" />
              {t('projectForm.draftNotice')} {t('projectForm.btnUpdateHint')}
            </div>
          )}

          {/* ── KI-Assistent (unified drop zone) ─────────────────────────── */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-violet-700">✨ KI-Assistent</p>
            <KiDropZone
              onImages={(files) => handleImageUpload(files)}
              onApply={(data) => {
                // Convert extracted steps or origin_acquisition text to project step objects
                let mappedSteps = null;
                if (Array.isArray(data.steps) && data.steps.length > 0) {
                  mappedSteps = data.steps.map(s => {
                    if (typeof s === 'string') return { title: s, text: '' };
                    return { title: s.title || s.name || '', text: s.text || s.description || '' };
                  });
                } else if (data.origin_acquisition && typeof data.origin_acquisition === 'string') {
                  // Parse numbered list lines into steps
                  const lines = data.origin_acquisition.split('\n')
                    .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
                    .filter(Boolean);
                  if (lines.length > 1) {
                    mappedSteps = lines.map(l => ({ title: l, text: '' }));
                  }
                }
                setFormData(prev => ({
                  ...prev,
                  ...(data.name        && { name: data.name }),
                  ...(data.description && { description: data.description }),
                  ...(data.content     && { content: data.content }),
                  ...(data.time_effort && { time_effort: data.time_effort }),
                  ...(data.tools       && { tools: data.tools }),
                  ...(mappedSteps && mappedSteps.length > 0 && {
                    steps: [...prev.steps, ...mappedSteps],
                  }),
                }));
              }}
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('projectForm.labelTitle')} <span className="text-red-400">*</span>
            </label>
            <input type="text" name="name" value={formData.name} onChange={handleChange}
              placeholder={t('projectForm.placeholderTitle')} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('projectForm.labelDesc')}</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={2}
              placeholder={t('projectForm.placeholderDesc')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
          </div>

          {/* Images */}
          <ImageUploader
            images={localImages}
            onUpload={handleImageUpload}
            onDelete={handleImageDelete}
            onSetCover={handleSetCover}
            onSetStep={mode === 'project' ? handleSetStep : undefined}
            onSetCredit={handleSetCredit}
            stepCount={mode === 'project' ? formData.steps.length : 0}
            apiBase={API_BASE}
            label={mode === 'offer-only' ? t('projectForm.imagesLabelOffer') : t('projectForm.imagesLabel')}
          />

          {/* ── Project-mode accordions ── */}
          {mode === 'project' && (
            <div className="space-y-2">

              {/* Inhalt */}
              <AccordionSection icon={FileText} title="Inhalt & Beschreibung" color="#0891b2"
                filled={!!formData.content} defaultOpen={!!formData.content}>
                <textarea name="content" value={formData.content} onChange={handleChange} rows={8}
                  placeholder={t('projectForm.placeholderContent')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none font-mono text-sm" />
              </AccordionSection>

              {/* Umsetzung & Schritte */}
              <AccordionSection icon={Wrench} title="Umsetzung & Arbeitsschritte" color="#ea580c"
                filled={!!formData.time_effort || !!formData.tools || formData.steps.length > 0}>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('projectForm.labelTimeEffort')}</label>
                  <input type="text" value={formData.time_effort}
                    onChange={e => setFormData({ ...formData, time_effort: e.target.value })}
                    placeholder={t('projectForm.placeholderTimeEffort')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('projectForm.labelTools')}</label>
                  <textarea value={formData.tools}
                    onChange={e => setFormData({ ...formData, tools: e.target.value })} rows={2}
                    placeholder={t('projectForm.placeholderTools')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
                </div>

                {/* Steps */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">📋 {t('projectForm.stepsTitle')}</p>
                    <button type="button"
                      onClick={() => setFormData(f => ({ ...f, steps: [...f.steps, { title: '', text: '' }] }))}
                      className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> {t('projectForm.addStep')}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.steps.map((step, i) => {
                      const stepIndex = i + 1;
                      const stepImgs = localImages.filter(img => img.step_index === stepIndex);
                      return (
                        <div key={i} className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                              {t('projectForm.step', { n: stepIndex })}
                            </span>
                            <div className="flex items-center gap-0.5 ml-1">
                              <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0}
                                className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed">
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => moveStep(i, 1)} disabled={i === formData.steps.length - 1}
                                className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button type="button"
                              onClick={() => {
                                stepImgs.forEach(img => handleImageDelete(img.id));
                                setFormData(f => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }));
                              }}
                              className="ml-auto text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input type="text" placeholder="Titel" value={step.title || ''}
                            onChange={e => setFormData(f => ({ ...f, steps: f.steps.map((s, j) => j === i ? { ...s, title: e.target.value } : s) }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white" />
                          <textarea placeholder="Beschreibung" value={step.text || ''} rows={2}
                            onChange={e => setFormData(f => ({ ...f, steps: f.steps.map((s, j) => j === i ? { ...s, text: e.target.value } : s) }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none bg-white" />
                          <div className="border-t border-gray-100 pt-2 space-y-1.5">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                              {t('projectForm.stepImages', { n: stepIndex })}
                            </p>
                            {stepImgs.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {stepImgs.map(img => {
                                  const url = `${API_BASE}${img.file_path?.replace(/^\./, '')}`;
                                  return (
                                    <div key={img.id} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                                      <img src={url} alt={img.original_name} className="w-full h-full object-cover" />
                                      <button type="button" onClick={() => handleImageDelete(img.id)}
                                        className="absolute inset-0 bg-red-500/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Trash2 className="w-4 h-4 text-white" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex items-center gap-3 flex-wrap">
                              <StepImageUpload stepIndex={stepIndex} onUpload={handleImageUpload} ensureDraft={ensureDraft} />
                              <StepAiButton
                                stepIndex={stepIndex}
                                onUpload={handleImageUpload}
                                ensureDraft={ensureDraft}
                                onStepResult={(data) => setFormData(f => ({
                                  ...f,
                                  steps: f.steps.map((s, j) => j === i ? {
                                    ...s,
                                    ...(data.title && { title: data.title }),
                                    ...(data.text && { text: data.text }),
                                  } : s),
                                }))}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </AccordionSection>

              {/* Materialien */}
              <AccordionSection icon={Package} title={t('projectForm.materialsTitle')} color="#16a34a"
                filled={formData.materials.length > 0}>
                <div className="flex justify-end">
                  <button type="button" onClick={addMaterial}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded-lg">
                    <Plus className="w-4 h-4" /> {t('projectForm.addMaterial')}
                  </button>
                </div>
                {formData.materials.length === 0 ? (
                  <p className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg">{t('projectForm.noMaterials')}</p>
                ) : (
                  <div className="space-y-2">
                    {formData.materials.map((mat, i) => {
                      const selectedMat = availableMaterials.find(m => m.id === mat.material_id);
                      const gwpVal = selectedMat?.gwp_value;
                      const gwpUnit = selectedMat?.gwp_unit;
                      const denominator = gwpUnit?.split('/')?.[1]?.trim();
                      const unitMismatch = denominator && mat.unit && normalizeUnit(mat.unit) !== normalizeUnit(denominator);
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex gap-2 items-center">
                            <select value={mat.material_id} onChange={(e) => updateMaterial(i, 'material_id', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required>
                              <option value="">{t('projectForm.chooseMaterial')}</option>
                              {availableMaterials.map((m) => (
                                <option key={m.id} value={m.id}>{m.name} ({m.category})</option>
                              ))}
                            </select>
                            <input type="text" inputMode="decimal" value={mat.quantity ?? ''}
                              onChange={(e) => updateMaterial(i, 'quantity', e.target.value)}
                              onBlur={(e) => {
                                const parsed = parseFloat(String(e.target.value).replace(',', '.'));
                                updateMaterial(i, 'quantity', isNaN(parsed) ? '' : parsed);
                              }}
                              placeholder={t('common.quantity')}
                              className={`w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none ${unitMismatch ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`} />
                            <input type="text" value={mat.unit} onChange={(e) => updateMaterial(i, 'unit', e.target.value)}
                              placeholder={t('common.unit')}
                              className={`w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none ${unitMismatch ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`} />
                            <button type="button" onClick={() => removeMaterial(i)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {mat.material_id && gwpVal != null && gwpUnit && (
                            <div className={`text-xs flex items-center gap-1 pl-1 ${unitMismatch ? 'text-amber-600' : 'text-gray-400'}`}>
                              {unitMismatch
                                ? <>⚠ GWP-Bezug: <span className="font-medium">{gwpUnit}</span> — Menge in <span className="font-medium">{denominator}</span> (eingetragen: {mat.unit || '?'})</>
                                : <>ℹ GWP: <span className="font-medium">{gwpVal} {gwpUnit}</span>{denominator ? <> — Menge in <span className="font-medium">{denominator}</span></> : null}</>
                              }
                            </div>
                          )}
                          {mat.material_id && (gwpVal == null || gwpVal === 0) && selectedMat && (
                            <div className="text-xs text-gray-300 pl-1">
                              ℹ Kein GWP-Wert — fließt nicht in die Ökobilanz ein
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </AccordionSection>

              {/* Ökobaudat EPDs */}
              <AccordionSection icon={Leaf} title="Ökobaudat-Umweltdaten (EPD)" color="#059669"
                filled={formData.oekodat_materials?.length > 0}
                defaultOpen={!!(project?.oekodat_materials && safeJsonParse(project?.oekodat_materials, []).length > 0)}>
                <p className="text-xs text-gray-500 mb-3">
                  Materialien aus der professionellen Ökobaudat-Datenbank suchen und Umweltwerte (GWP, ODP, AP, EP, ADP …) für alle Lebenszyklusphasen extrahieren.
                </p>
                <OekobaudatPicker
                  selected={formData.oekodat_materials || []}
                  onChange={(items) => setFormData(f => ({ ...f, oekodat_materials: items }))}
                />
              </AccordionSection>

              {/* IDEMAT 2026 LCA */}
              <AccordionSection icon={Leaf} title="IDEMAT 2026 – Prozess-Ökobilanz (EF 3.1)" color="#047857"
                filled={formData.idemat_lca_items?.length > 0}
                defaultOpen={!!(project?.idemat_lca_items && safeJsonParse(project?.idemat_lca_items, []).length > 0)}>
                <p className="text-xs text-gray-500 mb-3">
                  Prozesse aus der IDEMAT 2026-Datenbank (TU Delft, 2 472 Einträge) hinzufügen und Mengen angeben. EF 3.1 Gesamtscore wird automatisch berechnet.
                </p>
                <ProjectIdematSection
                  items={formData.idemat_lca_items || []}
                  onChange={(items) => setFormData(f => ({ ...f, idemat_lca_items: items }))}
                />
              </AccordionSection>

              {/* Kombinierte Umweltbilanz — Bibliothek + Ökobaudat */}
              {allMaterialsForLca.length > 0 && (
                <div className="border border-emerald-100 rounded-xl overflow-hidden bg-emerald-50/20 px-4 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Leaf className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-800">Umweltwirkung – Gesamtbilanz</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mb-3">
                    {[
                      libAsEpdForm.length > 0 && `${libAsEpdForm.length} Bibliotheks-Material${libAsEpdForm.length > 1 ? 'ien' : ''} mit Umweltdaten`,
                      (formData.oekodat_materials?.length > 0) && `${formData.oekodat_materials.length} Ökobaudat-EPD${formData.oekodat_materials.length > 1 ? 's' : ''}`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                  <EpdFullAnalysis selected={allMaterialsForLca} />
                </div>
              )}

              {/* Nachhaltigkeitsprinzipien */}
              <AccordionSection icon={Leaf} title={t('projectForm.sustainabilityTitle')} color="#15803d"
                filled={allPrinciples.length > 0}>
                <div className="space-y-4">
                  {[
                    { key: 'circular_principles', label: t('projectForm.circularPrinciples'), options: CIRCULAR_PRINCIPLES_DE },
                    { key: 'principles_sufficiency', label: t('projectForm.sufficiency'), options: PRINCIPLES.sufficiency },
                    { key: 'principles_consistency', label: t('projectForm.consistency'), options: PRINCIPLES.consistency },
                    { key: 'principles_efficiency', label: t('projectForm.efficiency'), options: PRINCIPLES.efficiency },
                    { key: 'general_sustainability_principles', label: t('projectForm.generalSustainability'), options: GENERAL_SUSTAINABILITY },
                  ].map(({ key, label, options }) => (
                    <div key={key}>
                      <div className="text-xs font-semibold text-gray-600 mb-2">{label}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {options.map((p) => {
                          const active = (formData[key] || []).includes(p);
                          return (
                            <button key={p} type="button"
                              onClick={() => setFormData(prev => ({ ...prev, [key]: toggleInArray(prev[key], p) }))}
                              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                                active
                                  ? 'bg-green-600 border-green-600 text-white'
                                  : 'bg-white border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700'
                              }`}>
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionSection>

              {/* Standort */}
              <div data-location-section>
                <AccordionSection icon={MapPin} title={<>{t('projectForm.labelLocation')} <span className="text-red-400">*</span></>} color="#2563eb"
                  filled={!!(formData.latitude && formData.longitude)} defaultOpen={true}
                  forceOpen={locationError}>
                  <LocationPicker value={locationValue} onChange={(loc) => { setLocationError(false); handleLocationChange(loc); }} />
                  {locationError && (
                    <p className="text-xs text-red-500 mt-1">Bitte einen Standort auswählen oder eingeben.</p>
                  )}
                </AccordionSection>
              </div>

              {/* Akteure & Quellen */}
              <AccordionSection icon={Users} title={t('projectForm.actorsTitle')} color="#7c3aed"
                filled={actorIds.filter(Boolean).length > 0 || (formData.references || []).length > 0 || !!formData.license}>

                {/* Actors */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">{t('projectForm.actorsTitle')}</p>
                  <div className="space-y-2">
                    {actorIds.map((actorId, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select value={actorId}
                          onChange={(e) => { const next = [...actorIds]; next[idx] = e.target.value; setActorIds(next); }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm">
                          <option value="">{t('projectForm.chooseActor')}</option>
                          {allActors.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}{a.type ? ` (${a.type})` : ''}</option>
                          ))}
                        </select>
                        {actorIds.length > 1 && (
                          <button type="button" onClick={() => setActorIds(actorIds.filter((_, i) => i !== idx))}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setActorIds([...actorIds, ''])}
                      className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium">
                      <Plus className="w-4 h-4" /> {t('projectForm.addActor')}
                    </button>
                  </div>
                </div>

                {/* References */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> {t('projectForm.refsTitle')}
                    </p>
                    <button type="button"
                      onClick={() => setFormData(f => ({ ...f, references: [...(f.references || []), ''] }))}
                      className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> {t('projectForm.addRef')}
                    </button>
                  </div>
                  {(!formData.references || formData.references.length === 0) ? (
                    <p className="text-xs text-gray-400 italic">{t('projectForm.noRefs')}</p>
                  ) : (
                    <div className="space-y-2">
                      {formData.references.map((ref, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input type="text" value={ref}
                            onChange={e => setFormData(f => ({ ...f, references: f.references.map((r, j) => j === i ? e.target.value : r) }))}
                            placeholder={t('projectForm.refPlaceholder', { n: i + 1 })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                          <button type="button"
                            onClick={() => setFormData(f => ({ ...f, references: f.references.filter((_, j) => j !== i) }))}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Files */}
                <FileUploader
                  files={localFiles}
                  onUpload={handleFileUpload}
                  onDelete={handleFileDelete}
                  apiBase={API_BASE}
                  label={t('projectForm.filesLabel')}
                />
              </AccordionSection>

              {/* CAD-Modell */}
              <AccordionSection
                icon={Box}
                title={<>CAD-Modell <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">experimentell</span></>}
                color="#b45309"
                filled={!!formData.cad_share_url}
              >
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 space-y-1.5">
                    <p className="font-semibold">So funktioniert's:</p>
                    <ol className="list-decimal list-inside space-y-1 text-amber-700">
                      <li>CAD-App öffnen und dein Modell aufbauen</li>
                      <li>Oben rechts auf <strong>Teilen</strong> klicken → Share-URL kopieren</li>
                      <li>URL hier einfügen und Projekt speichern</li>
                    </ol>
                    <p className="text-xs text-amber-600 mt-2">
                      Das CAD-Modell wird komprimiert in der URL gespeichert (kein Upload nötig). Funktioniert bei einfachen Modellen problemlos — bei sehr großen STEP-Dateien kann die URL sehr lang werden.
                    </p>
                    <a
                      href="https://martinwiesner.github.io/cad-app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-1 text-amber-700 hover:text-amber-900 font-medium underline underline-offset-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      CAD-App öffnen
                    </a>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                      Share-URL einfügen
                    </label>
                    <textarea
                      value={formData.cad_share_url}
                      onChange={e => setFormData(f => ({ ...f, cad_share_url: e.target.value }))}
                      placeholder="https://martinwiesner.github.io/cad-app/#share=..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none text-sm font-mono resize-none"
                    />
                    {formData.cad_share_url && !formData.cad_share_url.includes('#share=') && (
                      <p className="text-xs text-red-500 mt-1">⚠ Das sieht nicht wie eine gültige Share-URL aus. Die URL sollte <code>#share=</code> enthalten.</p>
                    )}
                    {formData.cad_share_url && formData.cad_share_url.includes('#share=') && (
                      <p className="text-xs text-green-600 mt-1">✓ Share-URL erkannt</p>
                    )}
                  </div>
                </div>
              </AccordionSection>

            </div>
          )}

          {/* Standort für offer-only mode */}
          {mode === 'offer-only' && (
            <AccordionSection icon={MapPin} title={t('projectForm.labelLocation')} color="#2563eb"
              filled={!!(formData.latitude && formData.longitude)}>
              <LocationPicker value={locationValue} onChange={handleLocationChange} />
            </AccordionSection>
          )}

          {/* Status + Sichtbarkeit */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('projectForm.labelStatus')}</label>
              <select name="status" value={formData.status} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="draft">{t('projects.statusDraft')}</option>
                <option value="active">{t('projects.statusPublished')}</option>
                <option value="completed">{t('projects.statusDone')}</option>
                <option value="archived">{t('projects.statusArchived')}</option>
              </select>
            </div>
            <div className="col-span-2 space-y-2">
              <label className="block text-sm font-medium text-gray-700">Sichtbarkeit</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                {[
                  { value: 'private',       label: 'Privat',      Icon: Lock      },
                  { value: 'actor',         label: 'Akteur',      Icon: Building2 },
                  { value: 'selectedUsers', label: 'Ausgewählte', Icon: Users     },
                  { value: 'public',        label: 'Öffentlich',  Icon: Globe     },
                ].map(({ value, label, Icon }, i, arr) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData(f => ({
                      ...f,
                      visibility: value,
                      is_public: value === 'public',
                    }))}
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
                <select
                  value={formData.share_actor_id}
                  onChange={e => setFormData(f => ({ ...f, share_actor_id: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-300 bg-white"
                >
                  <option value="">— Akteur auswählen —</option>
                  {allActors.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
              {formData.visibility === 'selectedUsers' && (
                <InlineUserPicker
                  selected={formData.selectedUsers || []}
                  onChange={users => setFormData(f => ({ ...f, selectedUsers: users }))}
                />
              )}
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_available" checked={formData.is_available}
                  onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                  className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-400" />
                <span className="text-sm text-gray-700">{t('projectForm.markAvailable')}</span>
              </label>
            </div>
          </div>

          {/* Lizenz */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('projectForm.labelLicense')}</label>
            <select value={formData.license}
              onChange={e => setFormData({ ...formData, license: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm">
              <option value="">{t('projectForm.noLicense')}</option>
              <option value="CC BY 4.0">CC BY 4.0 – Namensnennung</option>
              <option value="CC BY-SA 4.0">CC BY-SA 4.0 – Namensnennung + Weitergabe</option>
              <option value="CC BY-NC 4.0">CC BY-NC 4.0 – Nicht kommerziell</option>
              <option value="CC BY-NC-SA 4.0">CC BY-NC-SA 4.0 – Nicht kommerziell + Weitergabe</option>
              <option value="CC0 1.0">CC0 1.0 – Gemeinfrei</option>
              <option value="MIT">MIT License</option>
              <option value="Alle Rechte vorbehalten">Alle Rechte vorbehalten</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              {draftCreated ? t('common.close') : t('common.cancel')}
            </button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50">
              {isPending
                ? t('common.saving')
                : draftCreated || isEditing
                  ? t('projectForm.btnUpdate')
                  : mode === 'offer-only'
                    ? t('projectForm.btnCreateOffer')
                    : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
