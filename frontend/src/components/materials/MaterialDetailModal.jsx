import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { X, ExternalLink, Leaf, Info, Wrench, Ruler, Recycle, Edit2 } from 'lucide-react';
import { OwnerLine } from '../shared/ContactButton';

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

export default function MaterialDetailModal({ material, onClose, onEdit, canEdit = false }) {
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
              {typeof material.gwp_total_value === 'number' ? (
                <span className="px-2.5 py-1 rounded-full text-xs border border-primary-200 bg-primary-50 text-primary-900">
                  GWP gesamt: {material.gwp_total_value} {material.gwp_total_unit || 'kg CO2e'}
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
                aria-label="Edit"
                type="button"
                title="Material bearbeiten"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              aria-label="Close"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[calc(92vh-72px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Kurzbeschreibung" icon={Info}>
              {material.short_description ? (
                <p className="text-sm text-gray-800 leading-relaxed">{material.short_description}</p>
              ) : material.description ? (
                <p className="text-sm text-gray-800 leading-relaxed">{material.description}</p>
              ) : (
                <EmptyHint>Keine Kurzbeschreibung hinterlegt.</EmptyHint>
              )}
            </Section>

            <Section title="Herkunft & Gewinnung" icon={Info}>
              {material.origin_acquisition ? (
                <p className="text-sm text-gray-800 leading-relaxed">{material.origin_acquisition}</p>
              ) : (
                <EmptyHint>Keine Informationen zur Gewinnung/Herstellung hinterlegt.</EmptyHint>
              )}
            </Section>

            <Section title="Einsatz & Verarbeitung" icon={Wrench}>
              <div className="space-y-3">
                {material.use_processing ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">Anwendungsgebiete</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{material.use_processing}</div>
                  </div>
                ) : null}

                {material.use_indoor_outdoor ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">Innen / Außen</div>
                    <div className="text-sm text-gray-800">{material.use_indoor_outdoor}</div>
                  </div>
                ) : null}

                {material.use_limitations ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">Grenzen des Materials</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{material.use_limitations}</div>
                  </div>
                ) : null}

                {similarIds.length ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">Ähnliche Materialien</div>
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
                    <div className="text-xs text-gray-500 mt-2">Hinweis: Wenn nur IDs angezeigt werden, fehlen noch Namen für die verlinkten Materialien.</div>
                  </div>
                ) : null}

                {!material.use_processing && !material.use_indoor_outdoor && !material.use_limitations && !similarIds.length ? (
                  <EmptyHint>Keine Informationen zur Nutzung/Verarbeitung hinterlegt.</EmptyHint>
                ) : null}
              </div>
            </Section>

            <Section title="Technische Daten" icon={Ruler}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Verfügbare Materialstärken</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{material.tech_thicknesses || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Verfügbare Materialabmessungen</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{material.tech_dimensions || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Dichte</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{material.tech_density || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Entflammbarkeit</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{material.tech_flammability || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Akustik</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{material.tech_acoustics || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Wärmeisolation</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{material.tech_thermal_insulation || '—'}</div>
                </div>
              </div>
            </Section>

            <Section title="Nachhaltigkeit" icon={Recycle}>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Einfluss auf Klimawandel</div>
                  {material.sust_climate_description ? (
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{material.sust_climate_description}</div>
                  ) : (
                    <EmptyHint>Keine Beschreibung hinterlegt.</EmptyHint>
                  )}
                  {typeof material.gwp_total_value === 'number' ? (
                    <div className="text-xs text-gray-600 mt-2">GWP gesamt: {material.gwp_total_value} {material.gwp_total_unit || 'kg CO2e'}</div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Recyclatanteil</div>
                    <div className="text-sm font-medium text-gray-900 mt-1">
                      {material.recyclate_content !== null && material.recyclate_content !== undefined && material.recyclate_content !== ''
                        ? `${material.recyclate_content}%`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Kreislauffähigkeit</div>
                    <div className="text-sm font-medium text-gray-900 mt-1">{material.circularity || '—'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Human Health (z. B. VOC)</div>
                    <div className="text-sm font-medium text-gray-900 mt-1">{material.human_health || '—'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Be- &amp; Verarbeitung</div>
                    <div className="text-sm font-medium text-gray-900 mt-1">{material.processing_sustainability || '—'}</div>
                  </div>
                </div>

                {(suff.length || cons.length || eff.length) ? (
                  <div className="space-y-3">
                    <TagGroup title="Suffizienz" items={suff} />
                    <TagGroup title="Konsistenz" items={cons} />
                    <TagGroup title="Effizienz" items={eff} />
                  </div>
                ) : (
                  <EmptyHint>Keine Nachhaltigkeits-Tags hinterlegt.</EmptyHint>
                )}
              </div>
            </Section>

            <Section title="Weiterführende Informationen" icon={ExternalLink}>
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
                <EmptyHint>Keine Links hinterlegt (z. B. EPDs).</EmptyHint>
              )}
            </Section>

            <Section title="Anhang" icon={Info}>
              {material.appendix ? (
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{material.appendix}</div>
              ) : (
                <EmptyHint>Keine Quellen/Referenzen/Dokumente hinterlegt.</EmptyHint>
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
