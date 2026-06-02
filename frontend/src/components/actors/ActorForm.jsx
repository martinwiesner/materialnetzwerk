import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, Upload, Trash2, Plus, Link2, Package, FolderOpen,
  ChevronDown, ChevronUp, Phone, MapPin } from 'lucide-react';
import { actorService } from '../../services/actorService';
import { materialService } from '../../services/materialService';
import { projectService } from '../../services/projectService';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../store/toastStore';
import LocationPicker from '../shared/LocationPicker';
import { MEDIA_BASE } from '../../services/api';
import { useT } from '../../i18n/useT';

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

function AccordionSection({ icon: Icon, title, color = '#6b7280', filled = false, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        aria-expanded={open}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          {filled && !open && <span className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" title="Daten vorhanden" />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-4 pb-5 pt-4 space-y-4">{children}</div>}
    </div>
  );
}

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
  latitude: null,
  longitude: null,
};

export default function ActorForm({ actor, onClose }) {
  const t = useT();
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
    latitude: actor.latitude ?? null,
    longitude: actor.longitude ?? null,
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
    if (!form.name.trim()) { setError(t('actorForm.nameRequired')); return; }
    const payload = {
      ...form,
      latitude: form.latitude != null ? parseFloat(form.latitude) : null,
      longitude: form.longitude != null ? parseFloat(form.longitude) : null,
    };
    saveMutation.mutate(payload);
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (!isEdit) { setError(t('actorForm.imagesHint')); return; }
    setUploadingImage(true);
    try {
      const result = await actorService.uploadImages(actor.id, files);
      setImages(prev => [...prev, ...(result.images || [])]);
    } catch {
      setError(t('actorForm.uploading'));
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const imgUrl = (img) => img?.file_path
    ? `${MEDIA_BASE}${img.file_path.replace(/^\./, '')}`
    : null;

  const contactFilled = !!(form.website || form.email || form.phone);
  const locationFilled = !!(form.latitude && form.longitude);
  const linksFilled = links.length > 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? t('actorForm.titleEdit') : t('actorForm.titleNew')}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl">{error}</div>
          )}

          {/* Name + Typ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('actorForm.labelName')} <span className="text-red-400">*</span>
              </label>
              <input type="text" value={form.name} onChange={set('name')}
                placeholder={t('actorForm.placeholderName')}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('actorForm.labelType')}</label>
              <select value={form.type} onChange={set('type')}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none">
                <option value="">{t('actorForm.chooseType')}</option>
                {ACTOR_TYPES.map(tp => <option key={tp} value={tp}>{tp}</option>)}
              </select>
            </div>
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('actorForm.labelTagline')}</label>
            <input type="text" value={form.tagline} onChange={set('tagline')}
              placeholder={t('actorForm.placeholderTagline')}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none" />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('actorForm.labelDescription')}</label>
            <textarea value={form.description} onChange={set('description')} rows={3}
              placeholder={t('actorForm.placeholderDescription')}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none resize-none" />
          </div>

          {/* Bilder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('actorForm.labelImages')}</label>
            {!isEdit && <p className="text-xs text-gray-500 mb-2">{t('actorForm.imagesHint')}</p>}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {images.map(img => (
                  <div key={img.id} className="flex flex-col w-24">
                    <div className="relative group">
                      <img src={imgUrl(img)} alt="" className="w-24 h-24 object-cover rounded-t-xl border border-b-0 border-gray-200" />
                      <button type="button"
                        onClick={() => deleteImageMutation.mutate({ actorId: actor.id, imageId: img.id })}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <input type="text" placeholder="© Credit" defaultValue={img.credit || ''}
                      onBlur={async (e) => {
                        const val = e.target.value;
                        if (val !== (img.credit || '')) {
                          await actorService.updateImage(actor.id, img.id, { credit: val });
                          setImages(prev => prev.map(i => i.id === img.id ? { ...i, credit: val } : i));
                        }
                      }}
                      className="w-full text-[10px] px-1.5 py-1 border border-t-0 border-gray-200 rounded-b-xl focus:outline-none focus:ring-1 focus:ring-actor-300 bg-white text-gray-500 placeholder-gray-300" />
                  </div>
                ))}
              </div>
            )}
            {isEdit && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer px-3 py-2 text-sm font-medium text-actor-600 bg-actor-50 border border-actor-200 rounded-xl hover:bg-actor-100 transition-colors">
                <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                {uploadingImage
                  ? <span>{t('actorForm.uploading')}</span>
                  : <><Upload className="w-4 h-4" /> {t('actorForm.uploadImage')}</>
                }
              </label>
            )}
          </div>

          {/* Accordions */}
          <div className="space-y-2">

            {/* Kontakt */}
            <AccordionSection icon={Phone} title="Kontakt" color="#0891b2"
              filled={contactFilled} defaultOpen={contactFilled}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.website')}</label>
                  <input type="url" value={form.website} onChange={set('website')}
                    placeholder="https://beispiel.de"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.email')}</label>
                  <input type="email" value={form.email} onChange={set('email')}
                    placeholder="kontakt@beispiel.de"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('actorForm.labelPhone')}</label>
                  <input type="tel" value={form.phone} onChange={set('phone')}
                    placeholder="+49 3441 …"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-actor-400 focus:border-transparent outline-none" />
                </div>
              </div>
            </AccordionSection>

            {/* Standort */}
            <AccordionSection icon={MapPin} title="Standort" color="#2563eb"
              filled={locationFilled} defaultOpen={locationFilled}>
              <LocationPicker
                value={{ location_name: form.location_name, address: form.address, latitude: form.latitude, longitude: form.longitude }}
                onChange={loc => setForm(f => ({ ...f, location_name: loc.location_name, address: loc.address, latitude: loc.latitude, longitude: loc.longitude }))}
              />
            </AccordionSection>

            {/* Verknüpfungen — nur im Edit-Modus */}
            {isEdit && (
              <AccordionSection icon={Link2} title={t('actorForm.labelLinks')} color="#7c3aed"
                filled={linksFilled} defaultOpen={linksFilled}>
                <p className="text-xs text-gray-500">{t('actorForm.linksHint')}</p>

                {/* Materialien */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
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
                      defaultValue="">
                      <option value="">{t('actorForm.linkMaterial')}</option>
                      {availableMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  )}
                </div>

                {/* Projekte */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
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
                      defaultValue="">
                      <option value="">{t('actorForm.linkProject')}</option>
                      {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </div>
              </AccordionSection>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            {t('common.cancel')}
          </button>
          <button type="submit" onClick={handleSubmit} disabled={saveMutation.isPending}
            className="px-5 py-2 text-sm font-semibold bg-actor-600 hover:bg-actor-700 text-white rounded-xl transition-colors disabled:opacity-50">
            {saveMutation.isPending ? t('common.saving') : isEdit ? t('actorForm.btnSave') : t('actorForm.btnCreate')}
          </button>
        </div>
      </div>
    </div>
  );
}
