import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookMarked, MapPin, Package, User, ArrowLeft, Printer, Tag } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { exportGesuchPoster } from '../../utils/exportUtils';

export default function GesuchDetail() {
  const { id } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['gesuch-detail', id],
    queryFn: () => inventoryService.getById(id),
  });

  const gesuch = data?.data || data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !gesuch || gesuch.entry_type !== 'gesuch') {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <BookMarked className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Gesuch nicht gefunden</h2>
        <p className="text-gray-500 mb-6">Dieses Materialgesuch existiert nicht oder wurde entfernt.</p>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  const qty = gesuch.quantity != null
    ? `${gesuch.quantity} ${gesuch.unit || gesuch.material_unit || ''}`.trim()
    : null;
  const ownerName = gesuch.owner_first_name
    ? `${gesuch.owner_first_name} ${gesuch.owner_last_name || ''}`.trim()
    : gesuch.owner_email || null;
  const createdAt = gesuch.created_at
    ? new Date(gesuch.created_at).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })
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
        <div className="bg-purple-50 border-b border-purple-100 px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-purple-700" />
            <span className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Materialgesuch</span>
          </div>
          <button
            onClick={() => exportGesuchPoster(gesuch)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Aushang drucken
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              {gesuch.material_name || 'Material gesucht'}
            </h1>
            {gesuch.category && (
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full border border-purple-100">
                {gesuch.category}
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
            {(gesuch.location_name || gesuch.address) && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Ort</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                    {gesuch.location_name}
                    {gesuch.address && gesuch.address !== gesuch.location_name && (
                      <span className="block text-xs text-gray-500 font-normal">{gesuch.address}</span>
                    )}
                  </dd>
                </div>
              </div>
            )}
            {ownerName && (
              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Eingestellt von</dt>
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
          {gesuch.notes && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Beschreibung / Hinweise</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{gesuch.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <p className="text-xs text-gray-400">
            Veröffentlicht auf <span className="font-medium text-gray-600">RZZ Materialien</span> · reallabor-zekiwa-zeitz.de
          </p>
          <button
            onClick={() => exportGesuchPoster(gesuch)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Als Aushang drucken
          </button>
        </div>
      </div>

      {/* Link hint */}
      <div className="text-xs text-gray-400 text-center">
        Direktlink zu diesem Gesuch:{' '}
        <span className="font-mono text-gray-600 select-all">{window.location.href}</span>
      </div>
    </div>
  );
}
