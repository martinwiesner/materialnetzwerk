import { useQuery } from '@tanstack/react-query';
import { X, MapPin, Package, User, Calendar, Truck, Tag, MessageSquare, Download, ExternalLink } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { MEDIA_BASE } from '../../services/api';

const API_BASE = MEDIA_BASE;

const VALUE_TYPE_LABELS = {
  swap: 'Tausch',
  free: 'Kostenlose Abgabe',
  loan: 'Entleihe',
  negotiable: 'Verhandlungsbasis',
  fixed: 'Fixer Preis',
};

const CONDITION_LABELS = {
  new: 'Neu',
  used: 'Gebraucht',
  damaged: 'Beschädigt',
  tested: 'Geprüft',
};

function Badge({ children, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    orange: 'bg-orange-100 text-orange-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>{children}</span>
  );
}

function Section({ title, children }) {
  return (
    <div className="pt-4 border-t border-gray-100">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function InfoRow({ label, value, className = '' }) {
  if (!value && value !== 0) return null;
  return (
    <div className={`flex items-start gap-2 text-sm ${className}`}>
      <span className="text-gray-500 w-44 flex-shrink-0">{label}</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  );
}

export default function InventoryDetailModal({ inventoryId, onClose, onContact }) {
  const { data: item, isLoading } = useQuery({
    queryKey: ['inventory-detail', inventoryId],
    queryFn: () => inventoryService.getById(inventoryId),
    enabled: Boolean(inventoryId),
  });

  const imageUrl = (img) => {
    if (!img?.file_path) return null;
    return `${API_BASE}${img.file_path.replace(/^\./, '')}`;
  };

  const coverImage = item?.images?.[0];
  const stepImages = item?.images?.slice(1) || [];

  let transactionOpts = [];
  let logisticsOpts = [];
  try { transactionOpts = item?.transaction_options ? JSON.parse(item.transaction_options) : []; } catch (_) {}
  try { logisticsOpts = item?.logistics_options ? JSON.parse(item.logistics_options) : []; } catch (_) {}

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {isLoading ? '…' : item?.material_name || 'Materialangebot'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : !item ? (
          <p className="p-6 text-gray-500">Angebot nicht gefunden.</p>
        ) : (
          <div className="px-6 pb-6">
            {/* Cover Image */}
            {coverImage ? (
              <img
                src={imageUrl(coverImage)}
                alt={item.material_name}
                className="w-full h-56 object-cover rounded-xl mt-4 mb-4"
              />
            ) : (
              <div className="w-full h-32 bg-gray-100 rounded-xl mt-4 mb-4 flex items-center justify-center">
                <Package className="w-10 h-10 text-gray-300" />
              </div>
            )}

            {/* Category & badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {item.category && <Badge color="gray">{item.category}</Badge>}
              {item.condition && <Badge color="blue">{CONDITION_LABELS[item.condition] || item.condition}</Badge>}
              {item.value_type && <Badge color="green">{VALUE_TYPE_LABELS[item.value_type] || item.value_type}</Badge>}
              {item.is_mobile ? <Badge color="orange">Mobil / Transportierbar</Badge> : null}
            </div>

            {/* Core details */}
            <div className="space-y-2">
              <InfoRow label="Menge" value={item.quantity ? `${item.quantity} ${item.unit || item.material_unit || ''}` : null} />
              <InfoRow label="Mindestabnahme" value={item.min_order_quantity ? `${item.min_order_quantity} ${item.unit || ''}` : null} />
              {(item.location_name || item.address) && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-800">{item.location_name || item.address}</span>
                </div>
              )}
            </div>

            {/* Pricing */}
            {(item.value_type || item.price) && (
              <Section title="Preis & Gegenwert">
                <div className="space-y-2">
                  <InfoRow label="Gegenwert" value={VALUE_TYPE_LABELS[item.value_type] || item.value_type} />
                  {item.price != null && <InfoRow label="Preis" value={`${item.price}${item.price_unit ? ' ' + item.price_unit : ' €'}`} />}
                  {item.is_negotiable ? <InfoRow label="Verhandelbar" value="Ja" /> : null}
                </div>
              </Section>
            )}

            {/* Availability */}
            <Section title="Verfügbarkeit">
              <div className="space-y-2">
                {item.is_immediately_available ? (
                  <p className="text-sm text-green-700 font-medium">✓ Sofort verfügbar</p>
                ) : item.available_from_date ? (
                  <InfoRow label="Verfügbar ab" value={item.available_from_date} />
                ) : null}
                {item.is_regularly_available && (
                  <InfoRow
                    label="Regelmäßig"
                    value={`${item.regular_availability_period || ''} ${item.regular_availability_type === 'monthly' ? '(monatlich)' : item.regular_availability_type === 'yearly' ? '(jährlich)' : ''}`.trim()}
                  />
                )}
                {(item.season_from || item.season_to) && (
                  <InfoRow label="Saison" value={`${item.season_from || '?'} – ${item.season_to || '?'}`} />
                )}
              </div>
            </Section>

            {/* Transaction & Logistics */}
            {(transactionOpts.length > 0 || logisticsOpts.length > 0) && (
              <Section title="Transaktion & Logistik">
                {transactionOpts.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1.5">Transaktionsoptionen</p>
                    <div className="flex flex-wrap gap-1.5">
                      {transactionOpts.map(o => <Badge key={o} color="purple">{o}</Badge>)}
                    </div>
                  </div>
                )}
                {logisticsOpts.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Logistik</p>
                    <div className="flex flex-wrap gap-1.5">
                      {logisticsOpts.map(o => <Badge key={o} color="blue">{o}</Badge>)}
                    </div>
                  </div>
                )}
                {item.transport_costs && <InfoRow label="Transportkosten" value={item.transport_costs} className="mt-2" />}
              </Section>
            )}

            {/* Notes */}
            {item.notes && (
              <Section title="Notizen">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.notes}</p>
              </Section>
            )}

            {/* Step images */}
            {stepImages.length > 0 && (
              <Section title="Bilder & Anleitung">
                <div className="space-y-4">
                  {stepImages.map((img, i) => (
                    <div key={img.id} className="rounded-xl overflow-hidden border border-gray-200">
                      <img src={imageUrl(img)} alt={img.step_caption || `Schritt ${i + 1}`} className="w-full object-cover max-h-60" />
                      {img.step_caption && (
                        <p className="text-sm text-gray-600 p-3 bg-gray-50">{img.step_caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Files */}
            {item.files?.length > 0 && (
              <Section title="Fertigungsdaten & Dateien">
                <ul className="space-y-1">
                  {item.files.map(f => (
                    <li key={f.id}>
                      <a
                        href={`${API_BASE}${f.file_path?.replace(/^\./, '')}`}
                        download={f.original_name}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 py-1"
                      >
                        <Download className="w-4 h-4" />
                        {f.original_name || f.filename}
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* External URL */}
            {item.external_url && (
              <Section title="Externer Link">
                <a href={item.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700">
                  <ExternalLink className="w-4 h-4" />
                  Zum Angebot
                </a>
              </Section>
            )}

            {/* Owner / Contact */}
            <Section title="Ansprechpartner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <User className="w-4 h-4 text-gray-400" />
                  {item.owner_first_name || item.owner_email?.split('@')[0] || 'Unbekannt'}
                </div>
                {onContact && (
                  <button
                    onClick={() => onContact(item)}
                    className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Kontakt aufnehmen
                  </button>
                )}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
