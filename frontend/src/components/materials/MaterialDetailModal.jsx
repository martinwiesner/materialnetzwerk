import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ExternalLink, Leaf, Info, Wrench, Ruler, Recycle, Edit2, Trash2 } from 'lucide-react';
import { OwnerLine } from '../shared/ContactButton';
import SharePrintBar from '../shared/SharePrintBar';
import BookmarkButton from '../shared/BookmarkButton';
import MaterialIdSection from '../shared/MaterialIdSection';
import { exportMaterialPoster } from '../../utils/exportUtils';
import { MEDIA_BASE } from '../../services/api';
import { useT } from '../../i18n/useT';

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

function Section({ title, icon: Icon, children }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-3">
        {Icon ? <Icon className="w-5 h-5 text-gray-700" /> : null}
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
        {list.map((t) => (
          <span key={t} className="px-2.5 py-1 rounded-full text-xs border border-gray-200 bg-gray-50 text-gray-800">
            {t}
          </span>
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
        <img
          src={imgUrl(images[active])}
          alt={name}
          className="w-full h-64 object-cover rounded-2xl border border-gray-100"
        />
        {images[active]?.credit && (
          <span className="absolute bottom-2 right-2 text-[10px] font-light text-white/70 tracking-wide leading-none [writing-mode:vertical-rl] rotate-180 select-none pointer-events-none">
            {images[active].credit}
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id ?? i}
              type="button"
              onClick={() => setActive(i)}
              className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                i === active ? 'border-primary-500' : 'border-transparent'
              }`}
            >
              <img
                src={imgUrl(img)}
                alt={`${name} ${i + 1}`}
                className="h-16 w-24 object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MaterialDetailModal({ material, onClose, onEdit, onDelete, canEdit = false }) {
  const t = useT();

  const similarIds = useMemo(() => {
    const parsed = safeJsonParse(material?.similar_material_ids, []);
    return Array.isArray(parsed) ? parsed : [];
  }, [material?.similar_material_ids]);

  const envLinks = useMemo(() => {
    const parsed = safeJsonParse(material?.env_links, []);
    if (!parsed) return [];
    if (Array.isArray(parsed)) return parsed;
    return [];
  }, [material?.env_links]);

  const suff = useMemo(() => {
    const parsed = safeJsonParse(material?.principles_sufficiency, []);
    return Array.isArray(parsed) ? parsed : [];
  }, [material?.principles_sufficiency]);
  const cons = useMemo(() => {
    const parsed = safeJsonParse(material?.principles_consistency, []);
    return Array.isArray(parsed) ? parsed : [];
  }, [material?.principles_consistency]);
  const eff = useMemo(() => {
    const parsed = safeJsonParse(material?.principles_efficiency, []);
    return Array.isArray(parsed) ? parsed : [];
  }, [material?.principles_efficiency]);

  if (!material) return null;

  const ORIGIN_SOURCE_LABELS = {
    primary:                    '🏭 Neuware',
    'secondary_rückbau':        '🏗 Rückbau',
    secondary_restposten:       '🧱 Produktionsrest',
    'secondary_überschuss':     '📦 Überschuss',
    secondary_upcycling:        '♻ Upcycling',
    secondary_eigenproduktion:  '🛠 Eigenproduktion',
  };

  const gwpComponents = [
    { key: 'gwp_fossil',   label: 'fossil',   tipKey: 'gwpFossil' },
    { key: 'gwp_biogenic', label: 'biogen',   tipKey: 'gwpBiogenic' },
    { key: 'gwp_luluc',    label: 'luluc',    tipKey: 'gwpLuluc' },
  ];

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 p-4 flex items-center justify-center">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden bg-gray-50 rounded-2xl shadow-2xl border border-gray-200">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-5 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-primary-600" />
              <h2 className="text-xl font-bold text-gray-900 truncate">{material.name}</h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {material.category ? (
                <span className="px-2.5 py-1 rounded-full text-xs border border-gray-200 bg-gray-50 text-gray-800">
                  {material.category}
                </span>
              ) : null}
              {material.origin_source ? (
                <span className="px-2.5 py-1 rounded-full text-xs border border-amber-200 bg-amber-50 text-amber-900">
                  {ORIGIN_SOURCE_LABELS[material.origin_source] || material.origin_source}
                </span>
              ) : null}
              {typeof material.gwp_total_value === 'number' ? (
                <span className="px-2.5 py-1 rounded-full text-xs border border-primary-200 bg-primary-50 text-primary-900">
                  {t('materialDetail.labels.gwpTotal')}: {material.gwp_total_value} {material.gwp_total_unit || 'kg CO2e'}
                </span>
              ) : material.gwp_value !== null && material.gwp_value !== undefined ? (
                <span className="px-2.5 py-1 rounded-full text-xs border border-primary-200 bg-primary-50 text-primary-900">
                  GWP: {material.gwp_value} {material.gwp_unit || 'kg CO2e'}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {material.owner_id && (
              <OwnerLine
                ownerId={material.owner_id}
                ownerFirstName={material.owner_first_name}
                ownerLastName={material.owner_last_name}
                ownerEmail={material.owner_email}
                contextLabel={material.name}
              />
            )}
            {canEdit && onEdit && (
              <button
                onClick={onEdit}
                className="p-2 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-primary-50"
                aria-label={t('materialDetail.editAriaLabel')}
                type="button"
                title={t('materialDetail.editTitle')}
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
            {canEdit && onDelete && (
              <button
                onClick={() => { if (window.confirm(t('materialDetail.deleteConfirm'))) onDelete(); }}
                className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50"
                aria-label={t('materialDetail.deleteAriaLabel')}
                type="button"
                title={t('materialDetail.deleteTitle')}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              aria-label={t('materialDetail.closeAriaLabel')}
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[calc(92vh-144px)]">

          {/* Images */}
          {material.images && material.images.length > 0 && (
            <ImageGallery images={material.images} name={material.name} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title={t('materialDetail.sections.shortDescription')} icon={Info}>
              {material.short_description ? (
                <p className="text-sm text-gray-800 leading-relaxed">{material.short_description}</p>
              ) : material.description ? (
                <p className="text-sm text-gray-800 leading-relaxed">{material.description}</p>
              ) : (
                <EmptyHint>{t('materialDetail.empty.noDescription')}</EmptyHint>
              )}
            </Section>

            <Section title={t('materialDetail.sections.originAcquisition')} icon={Info}>
              {material.origin_acquisition ? (
                <p className="text-sm text-gray-800 leading-relaxed">{material.origin_acquisition}</p>
              ) : (
                <EmptyHint>{t('materialDetail.empty.noOrigin')}</EmptyHint>
              )}
            </Section>

            <Section title={t('materialDetail.sections.useProcessing')} icon={Wrench}>
              <div className="space-y-3">
                {material.use_processing ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">{t('materialDetail.labels.applicationAreas')}</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{material.use_processing}</div>
                  </div>
                ) : null}

                {material.use_indoor_outdoor ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">{t('materialDetail.labels.indoorOutdoor')}</div>
                    <div className="text-sm text-gray-800">{material.use_indoor_outdoor}</div>
                  </div>
                ) : null}

                {material.use_limitations ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">{t('materialDetail.labels.limitations')}</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{material.use_limitations}</div>
                  </div>
                ) : null}

                {similarIds.length ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">{t('materialDetail.labels.similarMaterials')}</div>
                    <div className="flex flex-wrap gap-2">
                      {similarIds.map((id) => (
                        <Link
                          key={id}
                          to={`/materials/${id}`}
                          className="px-3 py-1 rounded-full text-xs border border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100"
                          onClick={onClose}
                        >
                          {id}
                        </Link>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">{t('materialDetail.labels.similarHint')}</div>
                  </div>
                ) : null}

                {!material.use_processing && !material.use_indoor_outdoor && !material.use_limitations && !similarIds.length ? (
                  <EmptyHint>{t('materialDetail.empty.noUse')}</EmptyHint>
                ) : null}
              </div>
            </Section>

            <Section title={t('materialDetail.sections.technicalData')} icon={Ruler}>
              <CadButton material={material} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">{t('materialDetail.labels.availableThicknesses')}</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{material.tech_thicknesses || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">{t('materialDetail.labels.availableDimensions')}</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{material.tech_dimensions || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">{t('materialDetail.labels.density')}</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{material.tech_density || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">{t('materialDetail.labels.flammability')}</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{material.tech_flammability || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">{t('materialDetail.labels.acoustics')}</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{material.tech_acoustics || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">{t('materialDetail.labels.thermalInsulation')}</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{material.tech_thermal_insulation || '—'}</div>
                </div>
              </div>
            </Section>

            <Section title={t('materialDetail.sections.sustainability')} icon={Recycle}>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">{t('materialDetail.labels.climateImpact')}</div>
                  {material.sust_climate_description ? (
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{material.sust_climate_description}</div>
                  ) : (
                    <EmptyHint>{t('materialDetail.empty.noClimateDescription')}</EmptyHint>
                  )}
                  {typeof material.gwp_total_value === 'number' ? (
                    <div className="text-xs text-gray-600 mt-2">{t('materialDetail.labels.gwpTotal')}: {material.gwp_total_value} {material.gwp_total_unit || 'kg CO2e'}</div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">{t('materialDetail.labels.recyclateContent')}</div>
                    <div className="text-sm font-medium text-gray-900 mt-1">
                      {material.recyclate_content !== null && material.recyclate_content !== undefined && material.recyclate_content !== ''
                        ? `${material.recyclate_content}%`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">{t('materialDetail.labels.circularity')}</div>
                    <div className="text-sm font-medium text-gray-900 mt-1">{material.circularity || '—'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">{t('materialDetail.labels.humanHealth')}</div>
                    <div className="text-sm font-medium text-gray-900 mt-1">{material.human_health || '—'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">{t('materialDetail.labels.processingSustainability')}</div>
                    <div className="text-sm font-medium text-gray-900 mt-1">{material.processing_sustainability || '—'}</div>
                  </div>
                </div>

                {(suff.length || cons.length || eff.length) ? (
                  <div className="space-y-3">
                    <TagGroup title={t('materialDetail.labels.sufficiency')} items={suff} />
                    <TagGroup title={t('materialDetail.labels.consistency')} items={cons} />
                    <TagGroup title={t('materialDetail.labels.efficiency')} items={eff} />
                  </div>
                ) : (
                  <EmptyHint>{t('materialDetail.empty.noSustainabilityTags')}</EmptyHint>
                )}
              </div>
            </Section>

            {(material.gwp_fossil != null || material.gwp_biogenic != null || material.gwp_luluc != null ||
              material.adp_fossil != null || material.adp_elements != null || material.water_consumption != null ||
              material.declared_unit || material.lifecycle_scope) && (
              <Section title={t('materialDetail.sections.epd')} icon={Info}>
                <div className="space-y-3">
                  {(material.declared_unit || material.lifecycle_scope) && (
                    <div className="flex flex-wrap gap-4">
                      {material.declared_unit && (
                        <div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            {t('materialDetail.labels.declaredUnit')}
                            <span title={t('materialDetail.tooltips.declaredUnit')} className="cursor-help text-gray-400">ⓘ</span>
                          </div>
                          <div className="text-sm font-mono font-medium text-gray-900 mt-0.5">{material.declared_unit}</div>
                        </div>
                      )}
                      {material.lifecycle_scope && (
                        <div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            {t('materialDetail.labels.systemBoundary')}
                            <span title={t('materialDetail.tooltips.systemBoundary')} className="cursor-help text-gray-400">ⓘ</span>
                          </div>
                          <div className="text-sm font-medium text-gray-900 mt-0.5">{material.lifecycle_scope}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {(material.gwp_fossil != null || material.gwp_biogenic != null || material.gwp_luluc != null) && (
                    <div>
                      <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                        {t('materialDetail.labels.gwpPotential')}
                        <span title={t('materialDetail.tooltips.gwpTotal')} className="cursor-help text-gray-400">ⓘ</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {gwpComponents.map(({ key, label, tipKey }) => material[key] != null && (
                          <div key={key} className="bg-gray-50 rounded-xl border border-gray-200 p-2.5">
                            <div className="text-[10px] text-gray-500 flex items-center gap-0.5">
                              GWP {label} <span title={t(`materialDetail.tooltips.${tipKey}`)} className="cursor-help text-gray-400">ⓘ</span>
                            </div>
                            <div className="text-sm font-mono font-semibold text-gray-900 mt-0.5">
                              {Number(material[key]).toLocaleString('de-DE', { maximumFractionDigits: 4 })}
                              <span className="text-[10px] font-normal text-gray-500 ml-1">kg CO₂e</span>
                            </div>
                          </div>
                        ))}
                        {(() => {
                          const f = material.gwp_fossil ?? 0;
                          const b = material.gwp_biogenic ?? 0;
                          const l = material.gwp_luluc ?? 0;
                          const hasAny = material.gwp_fossil != null || material.gwp_biogenic != null || material.gwp_luluc != null;
                          if (!hasAny) return null;
                          const total = Number(f) + Number(b) + Number(l);
                          return (
                            <div className="bg-green-50 rounded-xl border border-green-200 p-2.5">
                              <div className="text-[10px] text-green-700 flex items-center gap-0.5">
                                {t('materialDetail.labels.gwpTotal')} <span title={t('materialDetail.tooltips.gwpTotalSum')} className="cursor-help text-green-500">ⓘ</span>
                              </div>
                              <div className="text-sm font-mono font-bold text-green-900 mt-0.5">
                                {total.toLocaleString('de-DE', { maximumFractionDigits: 4 })}
                                <span className="text-[10px] font-normal text-green-700 ml-1">kg CO₂e</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {(material.adp_fossil != null || material.adp_elements != null) && (
                    <div>
                      <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                        {t('materialDetail.labels.adpResources')}
                        <span title={t('materialDetail.tooltips.adpFossil')} className="cursor-help text-gray-400">ⓘ</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {material.adp_fossil != null && (
                          <div className="bg-gray-50 rounded-xl border border-gray-200 p-2.5">
                            <div className="text-[10px] text-gray-500 flex items-center gap-0.5">
                              {t('materialDetail.labels.adpFossil')} <span title={t('materialDetail.tooltips.adpFossil')} className="cursor-help text-gray-400">ⓘ</span>
                            </div>
                            <div className="text-sm font-mono font-semibold text-gray-900 mt-0.5">
                              {Number(material.adp_fossil).toLocaleString('de-DE', { maximumFractionDigits: 4 })}
                              <span className="text-[10px] font-normal text-gray-500 ml-1">MJ</span>
                            </div>
                          </div>
                        )}
                        {material.adp_elements != null && (
                          <div className="bg-gray-50 rounded-xl border border-gray-200 p-2.5">
                            <div className="text-[10px] text-gray-500 flex items-center gap-0.5">
                              {t('materialDetail.labels.adpElements')} <span title={t('materialDetail.tooltips.adpElements')} className="cursor-help text-gray-400">ⓘ</span>
                            </div>
                            <div className="text-sm font-mono font-semibold text-gray-900 mt-0.5">
                              {Number(material.adp_elements).toExponential(2)}
                              <span className="text-[10px] font-normal text-gray-500 ml-1">kg Sb-Äq.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {material.water_consumption != null && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-2.5 inline-flex flex-col">
                      <div className="text-[10px] text-gray-500 flex items-center gap-0.5">
                        {t('materialDetail.labels.waterConsumption')} <span title={t('materialDetail.tooltips.waterConsumption')} className="cursor-help text-gray-400">ⓘ</span>
                      </div>
                      <div className="text-sm font-mono font-semibold text-gray-900 mt-0.5">
                        {Number(material.water_consumption).toLocaleString('de-DE', { maximumFractionDigits: 5 })}
                        <span className="text-[10px] font-normal text-gray-500 ml-1">m³</span>
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            <Section title={t('materialDetail.sections.furtherInfo')} icon={ExternalLink}>
              {envLinks.length ? (
                <div className="space-y-2">
                  {envLinks.map((l, idx) => {
                    const url = typeof l === 'string' ? l : l?.url;
                    const label = typeof l === 'string' ? l : l?.label || l?.url;
                    if (!url) return null;
                    return (
                      <a
                        key={`${url}-${idx}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary-700 hover:text-primary-800"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="truncate">{label}</span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <EmptyHint>{t('materialDetail.empty.noLinks')}</EmptyHint>
              )}
            </Section>

            <Section title={t('materialDetail.sections.appendix')} icon={Info}>
              {material.appendix ? (
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{material.appendix}</div>
              ) : (
                <EmptyHint>{t('materialDetail.empty.noAppendix')}</EmptyHint>
              )}
            </Section>
          </div>

          {material.material_id && (
            <div className="pt-4">
              <MaterialIdSection
                materialId={material.material_id}
                passportType={material.passport_type || 'construction'}
                entityType="materials"
                entityId={material.id}
              />
            </div>
          )}
        </div>
        <SharePrintBar
          url={`${window.location.origin}/materials/${material.id}`}
          title={material.name}
          onPrint={() => exportMaterialPoster(material)}
          actions={<BookmarkButton entityType="material" entityId={material.id} showCount size="md" />}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CAD-Konfigurator Button
// ---------------------------------------------------------------------------

const CAD_APP_URL = 'https://martinwiesner.github.io/cad-app/';

function parseDimensions(dimStr) {
  if (!dimStr) return {};
  const m = dimStr.match(/(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return {};
  return {
    width: parseFloat(m[1].replace(',', '.')),
    height: parseFloat(m[2].replace(',', '.')),
  };
}

function parseThickness(thickStr) {
  if (!thickStr) return undefined;
  const m = thickStr.match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : undefined;
}

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

  const url = `${CAD_APP_URL}?${params.toString()}`;

  const hasAnyDim = dims.width || dims.height || thickness;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors w-fit"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
      {t('materialDetail.cad.openButton')}
      {hasAnyDim && (
        <span className="ml-1 text-xs text-blue-500">
          {[dims.width && `${dims.width}mm`, dims.height && `${dims.height}mm`, thickness && t('materialDetail.cad.thicknessLabel', { value: thickness })]
            .filter(Boolean).join(' × ')}
        </span>
      )}
    </a>
  );
}
