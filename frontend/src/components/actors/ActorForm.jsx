import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, Upload, Trash2, Plus, Link2, Package, FolderOpen } from 'lucide-react';
import { actorService } from '../../services/actorService';
import { materialService } from '../../services/materialService';
import { projectService } from '../../services/projectService';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../store/toastStore';
import GeolocateButton from '../shared/GeolocateButton';
import { MEDIA_BASE } from '../../services/api';

const ACTOR_TYPES = [
  'Hersteller',
  'Lieferant / Händler',
  'Forschung / Labor',
  'Recycling / Verwertung',
  'Urban Mining',
  'Makerspace',
  'Repair Café / Upcycling',
  'Kreativwerkstatt',
  'Verein',
  'Unternehmen',
  'Sonstiges',
];

const EMPTY = {
  name: '',
  type: '',
  tagline: '',
  description: '',
  website: '',
  email: '',
  phone: '',
  location_name: '',
  address: '',
  latitude: '',
  longitude: '',
};

export default function ActorForm({ actor, onClose }) {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const imageInputRef = useRef(null);

  const isEdit = Boolean(actor?.id);
  const [form, setForm] = useState(isEdit ? {
    name: actor.name || '',
    type: actor.type || '',
    tagline: actor.tagline || '',
    description: actor.description || '',
    website: actor.website || '',
    email: actor.email || '',
    phone: actor.phone || '',
    location_name: actor.location_name || '',
    address: actor.address || '',
    latitude: actor.latitude ?? '',
    longitude: actor.longitude ?? '',
  } : EMPTY);

  const [images, setImages] = useState(actor?.images || []);
  const [links, setLinks] = useState(actor?.links || []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const { data: allMaterials } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materialService.getAll(),
    enabled: isEdit,
  });
  const { data: allProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getAll(),
    enabled: isEdit,
  });

  const addLinkMutation = useMutation({
    mutationFn: ({ entityType, entityId }) => actorService.addLink(actor.id, entityType, entityId),
    onSuccess: (link) => setLinks(prev => [...prev, link]),
  });
  const removeLinkMutation = useMutation({
    mutationFn: (linkId) => actorService.removeLink(actor.id, linkId),
    onSuccess: (_, linkId) => setLinks(prev => prev.filter(l => l.id !== linkId)),
  });

  const materials = (allMaterials?.data || allMaterials || []);
  const projects = Array.isArray(allProjects) ? allProjects : (allProjects?.data || []);
  const linkedMaterialIds = links.filter(l => l.entity_type === 'material').map(l => l.entity_id);
  const linkedProjectIds = links.filter(l => l.entity_type === 'project').map(l => l.entity_id);
  const availableMaterials = materials.filter(m => !linkedMaterialIds.includes(m.id));
  const availableProjects = projects.filter(p => !linkedProjectIds.includes(p.id));

  // Prevent body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isEdit) return actorService.update(actor.id, data);
      return actorService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors'] });
      toast.success(isEdit ? 'Akteur gespeichert.' : 'Akteur erfolgreich angelegt.');
      onClose();
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Fehler beim Speichern.';
      setError(msg);
      toast.error(msg);
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: ({ actorId, imageId }) => actorService.deleteImage(actorId, imageId),
    onSuccess: (_, { imageId }) => setImages(imgs => imgs.filter(i => i.id !== imageId)),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Name ist erforderlich.'); return; }
    const payload = {
      ...form,
      latitude: form.latitude !== '' ? parseFloat(form.latitude) : null,
      longitude: form.longitude !== '' ? parseFloat(form.longitude) : null,
    };
    saveMutation.mutate(payload);
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (!isEdit) { setError('Bitte erst speichern, dann Bilder hochladen.'); return; }
    setUploadingImage(true);
    try {
      const result = await actorService.uploadImages(actor.id, files);
      setImages(prev => [...prev, ...(result.images || [])]);
    } catch {
      setError('Bild-Upload fehlgeschlagen.');
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const imgUrl = (img) => img?.file_path
    ? `${MEDIA_BASE}${img.file_path.replace(/^\./, '')}`
    : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Akteur bearbeiten' : 'Akteur eintragen'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl">{error}</div>
          )}

          {/* Name + Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name / Organisation *</label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="z.B. Zeitz Recycling GmbH"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
              <select
                value={form.type}
                onChange={set('type')}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none"
              >
                <option value="">— Bitte wählen —</option>
                {ACTOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kurzslogan</label>
            <input
              type="text"
              value={form.tagline}
              onChange={set('tagline')}
              placeholder="Ein kurzer Satz, der euch beschreibt"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={3}
              placeholder="Was macht ihr? Womit beschäftigt ihr euch?"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="url"
                value={form.website}
                onChange={set('website')}
                placeholder="https://beispiel.de"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="kontakt@beispiel.de"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                placeholder="+49 3441 …"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Standort *</label>
              <input
                type="text"
                value={form.location_name}
                onChange={set('location_name')}
                placeholder="z.B. Zeitz, Deutschland"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Koordinaten werden automatisch aus dem Standortnamen ermittelt</p>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <input
              type="text"
              value={form.address}
              onChange={set('address')}
              placeholder="Straße, Hausnummer, PLZ Ort"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none"
            />
          </div>

          {/* Coordinates */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Koordinaten</label>
              <GeolocateButton onLocate={(lat, lon) => setForm(f => ({ ...f, latitude: lat, longitude: lon }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={set('latitude')}
                placeholder="Breitengrad (lat)"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none"
              />
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={set('longitude')}
                placeholder="Längengrad (lon)"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Images — only available in edit mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bilder</label>
            {!isEdit && (
              <p className="text-xs text-gray-500 mb-2">Bilder können nach dem ersten Speichern hochgeladen werden.</p>
            )}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {images.map(img => (
                  <div key={img.id} className="relative group">
                    <img
                      src={imgUrl(img)}
                      alt=""
                      className="w-20 h-20 object-cover rounded-xl border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => deleteImageMutation.mutate({ actorId: actor.id, imageId: img.id })}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {isEdit && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer px-3 py-2 text-sm font-medium text-actor-600 bg-actor-50 border border-actor-200 rounded-xl hover:bg-actor-100 transition-colors">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
                {uploadingImage
                  ? <span>Hochladen…</span>
                  : <><Upload className="w-4 h-4" /> Bild hinzufügen</>
                }
              </label>
            )}
          </div>

          {/* Verknüpfungen — only in edit mode */}
          {isEdit && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="w-4 h-4 text-actor-600" />
                <label className="block text-sm font-medium text-gray-700">Verknüpfungen</label>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Verknüpfe Materialien und Projekte mit diesem Akteur. Die Verbindungen werden in der Explore-Karte als Linien angezeigt.
              </p>

              {/* Linked materials */}
              <div className="mb-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                  <Package className="w-3.5 h-3.5" /> Materialien
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {links.filter(l => l.entity_type === 'material').map(link => {
                    const mat = materials.find(m => m.id === link.entity_id);
                    return (
                      <span key={link.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-actor-50 border border-actor-200 text-xs text-actor-700">
                        {mat?.name || link.entity_id}
                        <button type="button" onClick={() => removeLinkMutation.mutate(link.id)} className="ml-0.5 hover:text-red-600">×</button>
                      </span>
                    );
                  })}
                </div>
                {availableMaterials.length > 0 && (
                  <select
                    onChange={(e) => { if (e.target.value) { addLinkMutation.mutate({ entityType: 'material', entityId: e.target.value }); e.target.value = ''; } }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-actor-400 outline-none"
                    defaultValue=""
                  >
                    <option value="">+ Material verknüpfen…</option>
                    {availableMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
              </div>

              {/* Linked projects */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                  <FolderOpen className="w-3.5 h-3.5" /> Projekte
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {links.filter(l => l.entity_type === 'project').map(link => {
                    const proj = projects.find(p => p.id === link.entity_id);
                    return (
                      <span key={link.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs text-blue-700">
                        {proj?.name || link.entity_id}
                        <button type="button" onClick={() => removeLinkMutation.mutate(link.id)} className="ml-0.5 hover:text-red-600">×</button>
                      </span>
                    );
                  })}
                </div>
                {availableProjects.length > 0 && (
                  <select
                    onChange={(e) => { if (e.target.value) { addLinkMutation.mutate({ entityType: 'project', entityId: e.target.value }); e.target.value = ''; } }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-actor-400 outline-none"
                    defaultValue=""
                  >
                    <option value="">+ Projekt verknüpfen…</option>
                    {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            className="px-5 py-2 text-sm font-semibold bg-actor-600 hover:bg-actor-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Speichern…' : isEdit ? 'Änderungen speichern' : 'Akteur anlegen'}
          </button>
        </div>
      </div>
    </div>
  );
}
