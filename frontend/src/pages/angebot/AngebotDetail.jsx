import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Store, MapPin, Package, User, ArrowLeft, Printer, Tag, Send, ExternalLink } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { exportAngebotPoster } from '../../utils/exportUtils';
import SharePrintBar from '../../components/shared/SharePrintBar';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import { useState } from 'react';
import MaterialRequestModal from '../../components/requests/MaterialRequestModal';
import { formatDate } from '../../utils/dates';

const VALUE_TYPE_LABELS = {
  swap: 'Tausch',
  free: 'Kostenlose Abgabe',
  loan: 'Entleihe',
  negotiable: 'Verhandlungsbasis',
  fixed: 'Fixer Preis',
};

export default function AngebotDetail() {
  const { id } = useParams();
  const { isAuthenticated } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['angebot-detail', id],
    queryFn: () => inventoryService.getById(id),
  });

  const offer = data?.data || data;

  function handleRequestClick() {
    if (!isAuthenticated) {
      openAuth({ tab: 'login', reason: 'Bitte melde dich an, um Material anzufragen.' });
    } else {
      setShowRequestModal(true);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !offer || offer.entry_type === 'gesuch') {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <Store className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Angebot nicht gefunden</h2>
        <p className="text-gray-500 mb-6">Dieses Materialangebot existiert nicht oder wurde entfernt.</p>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  const qty = offer.quantity != null
    ? `${offer.quantity} ${offer.unit || offer.material_unit || ''}`.trim()
    : null;
  const ownerName = offer.owner_first_name
    ? `${offer.owner_first_name} ${offer.owner_last_name || ''}`.trim()
    : offer.owner_email?.split('@')[0] || null;
  const createdAt = offer.created_at
    ? formatDate(offer.created_at, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const valueLabel = VALUE_TYPE_LABELS[offer.value_type] || offer.value_type;
  const price = offer.price != null
    ? `${offer.price}${offer.price_unit ? ' ' + offer.price_unit : ' €'}`
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Zurück zur Karte
      </Link>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header strip */}
        <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-green-700" />
            <span className="text-sm font-semibold text-green-700 uppercase tracking-wide">Materialangebot</span>
            {valueLabel && (
              <span className="inline-block px-2.5 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full border border-green-200">
                {valueLabel}{price ? ` · ${price}` : ''}
              </span>
            )}
          </div>
          <button
            onClick={() => exportAngebotPoster(offer)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-green-200 bg-white text-green-700 hover:bg-green-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Aushang drucken
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              {offer.material_name || 'Material verfügbar'}
            </h1>
            {offer.category && (
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100">
                {offer.category}
              </span>
            )}
          </div>

          {/* Meta grid */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {qty && (
              <div className="flex items-start gap-2.5">
                <Package className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Menge</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-0.5">{qty}</dd>
                </div>
              </div>
            )}
            {(offer.location_name || offer.address) && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Abholort</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                    {offer.location_name}
                    {offer.address && offer.address !== offer.location_name && (
                      <span className="block text-xs text-gray-500 font-normal">{offer.address}</span>
                    )}
                  </dd>
                </div>
              </div>
            )}
            {ownerName && (
              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Anbieter</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-0.5">{ownerName}</dd>
                </div>
              </div>
            )}
            {createdAt && (
              <div className="flex items-start gap-2.5">
                <Tag className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Eingestellt am</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-0.5">{createdAt}</dd>
                </div>
              </div>
            )}
          </dl>

          {/* Notes */}
          {offer.notes && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Beschreibung / Hinweise</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{offer.notes}</p>
            </div>
          )}

          {/* Offer conditions */}
          {(offer.available_for_gift || offer.swap_possible || offer.is_negotiable) && (
            <div className="flex flex-wrap gap-2">
              {offer.available_for_gift && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-green-50 border border-green-200 text-green-800">
                  🎁 Zu Verschenken
                </span>
              )}
              {offer.swap_possible && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 border border-blue-200 text-blue-800">
                  🔄 Tausch möglich
                </span>
              )}
              {offer.is_negotiable && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 border border-gray-200 text-gray-700">
                  💬 Preis verhandelbar
                </span>
              )}
            </div>
          )}

          {/* External listing */}
          {offer.external_url && (
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a
                href={offer.external_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary-600 hover:text-primary-700 underline underline-offset-2 break-all"
              >
                Extern inseriert – zum Angebot
              </a>
            </div>
          )}
        </div>

        {/* Footer / CTA */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <p className="text-xs text-gray-400">
            Veröffentlicht auf <span className="font-medium text-gray-600">RZZ Materialien</span> · reallabor-zekiwa-zeitz.de
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => exportAngebotPoster(offer)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Aushang
            </button>
            <button
              onClick={handleRequestClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              <Send className="w-4 h-4" />
              Material anfragen
            </button>
          </div>
        </div>
      </div>

      <SharePrintBar
        url={window.location.href}
        title={offer.material_name}
        onPrint={() => exportAngebotPoster(offer)}
      />

      {showRequestModal && offer && (
        <MaterialRequestModal
          item={offer}
          onClose={() => setShowRequestModal(false)}
        />
      )}
    </div>
  );
}
