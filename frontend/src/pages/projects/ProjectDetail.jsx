import { useState } from 'react';
import { useT } from '../../i18n/useT';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/projectService';
import {
  ArrowLeft, Edit2, Trash2, Globe, Lock, Package,
  Calendar, User, Leaf, ChevronLeft, ChevronRight,
  MapPin, ExternalLink, BookOpen, Users, Tag
} from 'lucide-react';

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

// ── Helpers for LCA computation ─────────────────────────────────────────────

function computeContributions(materials, valueField, effectiveField) {
  return (materials || [])
    .map(m => {
      const val = effectiveField ? m[effectiveField] : m[valueField];
      const contrib = val != null ? Number(m.quantity || 0) * Number(val) : null;
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

function CadEmbed({ shareUrl, previewUrl }) {
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
                  const contrib = effGwp != null && material.quantity != null
                    ? Number(material.quantity) * Number(effGwp)
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

        {/* Ökobilanz / LCA Section */}
        <OekobilanzSection project={project} />

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
        {(project.license || (project.references?.length > 0)) && (
          <div className="p-6 border-t border-gray-200">
            {project.license && (
              <p className="text-sm text-gray-700 mb-2">
                <span className="font-semibold text-gray-600"><Tag className="w-3.5 h-3.5 inline mr-1" />{t('projectDetail.labels.license')}</span> {project.license}
              </p>
            )}
            {project.references?.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-gray-600 flex items-center gap-1 mb-2">
                  <BookOpen className="w-4 h-4" /> {t('projectDetail.sections.references')}
                </h2>
                <ul className="space-y-1">
                  {project.references.map((ref, i) => (
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
        actions={<BookmarkButton entityType="project" entityId={project.id} showCount size="md" />}
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
    </div>
  );
}
