import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookMarked, MapPin, Package, User, ArrowLeft, Printer, Tag, Edit2, X, Save } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { exportGesuchPoster } from '../../utils/exportUtils';
import SharePrintBar from '../../components/shared/SharePrintBar';
import { formatDate } from '../../utils/dates';
import { useAuthStore } from '../../store/authStore';
import ImageUploader from '../../components/shared/ImageUploader';
import { MEDIA_BASE } from '../../services/api';

export default function GesuchDetail() {
  const { id } = useParams();
  const { isAuthenticated, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState(null);
  const [localImages, setLocalImages] = useState([]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['gesuch-detail', id],
    queryFn: () => inventoryService.getById(id),
  });

  const gesuch = data?.data || data;

  useEffect(() => {
    if (gesuch?.images) setLocalImages(gesuch.images);
  }, [gesuch]);

  const handleImageUpload = async (files) => {
    const result = await inventoryService.uploadImages(id, files);
    setLocalImages(prev => [...prev, ...(Array.isArray(result) ? result : [result])]);
  };

  const handleImageDelete = async (imageId) => {
    await inventoryService.deleteImage(id, imageId);
    setLocalImages(prev => prev.filter(img => img.id !== imageId));
  };

  const updateMutation = useMutation({
    mutationFn: (updates) => inventoryService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gesuch-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['gesuche'], exact: false });
      setShowEdit(false);
    },
  });

  const openEdit = () => {
    setEditData({
      notes: gesuch?.notes || '',
      quantity: gesuch?.quantity ?? '',
      unit: gesuch?.unit || gesuch?.material_unit || '',
      location_name: gesuch?.location_name || '',
      is_available: gesuch?.is_available === 1 || gesuch?.is_available === true,
    });
    setShowEdit(true);
  };

  const isOwner = isAuthenticated && gesuch && (user?.id === gesuch.owner_id || user?.is_admin);

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
    ? formatDate(gesuch.created_at, { year: 'numeric', month: 'long', day: 'numeric' })
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
          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                onClick={openEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Bearbeiten
              </button>
            )}
            <button
              onClick={() => exportGesuchPoster(gesuch)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Aushang drucken
            </button>
          </div>
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

          {/* Images */}
          {localImages.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Bilder</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[...localImages]
                  .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
                  .map((img) => {
                    const url = `${MEDIA_BASE}${img.file_path?.startsWith('/') ? img.file_path : '/' + img.file_path}`;
                    return (
                      <div key={img.id} className="rounded-xl overflow-hidden border border-gray-200">
                        <img src={url} alt={img.original_name || 'Bild'} className="w-full h-32 object-cover" />
                      </div>
                    );
                  })}
              </div>
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

      <SharePrintBar
        url={window.location.href}
        title={gesuch.material_name}
        onPrint={() => exportGesuchPoster(gesuch)}
      />

      {/* Edit Modal */}
      {showEdit && editData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowEdit(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-purple-50 flex-shrink-0">
              <div className="flex items-center gap-2 text-purple-800">
                <Edit2 className="w-4 h-4" />
                <span className="font-semibold">Gesuch bearbeiten</span>
              </div>
              <button onClick={() => setShowEdit(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung / Hinweise</label>
                <textarea
                  rows={4}
                  value={editData.notes}
                  onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Menge</label>
                  <input
                    type="number" min="0" step="any"
                    value={editData.quantity}
                    onChange={e => setEditData(d => ({ ...d, quantity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Einheit</label>
                  <input
                    type="text"
                    value={editData.unit}
                    onChange={e => setEditData(d => ({ ...d, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ort</label>
                <input
                  type="text"
                  value={editData.location_name}
                  onChange={e => setEditData(d => ({ ...d, location_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editData.is_available}
                  onChange={e => setEditData(d => ({ ...d, is_available: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                Gesuch als <span className="font-medium text-red-600">erfüllt / inaktiv</span> markieren
              </label>

              <ImageUploader
                images={localImages}
                onUpload={handleImageUpload}
                onDelete={handleImageDelete}
                label="Bilder"
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setShowEdit(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors">
                Abbrechen
              </button>
              <button
                onClick={() => updateMutation.mutate({
                  notes: editData.notes,
                  quantity: editData.quantity ? parseFloat(editData.quantity) : null,
                  unit: editData.unit,
                  location_name: editData.location_name,
                  is_available: editData.is_available ? 1 : 0,
                })}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {updateMutation.isPending ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
