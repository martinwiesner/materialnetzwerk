import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { materialService, materialActorService } from '../../services/materialService';
import { actorService } from '../../services/actorService';
import { inventoryService } from '../../services/inventoryService';
import { MapPin, X, Plus, Trash2, Users, Tag, Package, Upload } from 'lucide-react';
import GeolocateButton from '../shared/GeolocateButton';
import ImageUploader from '../shared/ImageUploader';
import FileUploader from '../shared/FileUploader';

import { MEDIA_BASE } from '../../services/api';
import { useToast } from '../../store/toastStore';
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

const PRINCIPLES = {
  consistency: ['Nachwachsende Rohstoffe', 'Recycelte Rohstoffe', 'Recyclinggerecht', 'Kompostierbar'],
  efficiency: ['Schadstofffrei', 'Naturraumerhaltend', 'Faire Materialgewinnung', 'Regional'],
};

function toggleInArray(arr, value) {
  const set = new Set(arr || []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set);
}

const initialFormState = {
  name: '',
  category: '',
  description: '',

  // Extended details
  short_description: '',
  origin_acquisition: '',
  use_processing: '',
  use_indoor_outdoor: '',
  use_limitations: '',
  similar_material_ids_input: '',

  // Technical data
  tech_thicknesses: '',
  tech_dimensions: '',
  tech_density: '',
  tech_flammability: '',
  tech_acoustics: '',
  tech_thermal_insulation: '',
  tech_compressive_strength: '',
  tech_tensile_strength: '',

  // Sustainability
  sust_climate_description: '',
  gwp_total_value: '',
  gwp_total_unit: 'kg CO2e',
  recyclate_content: '',
  recycling_percentage: '',
  voc_values: '',
  circularity: '',
  human_health: '',
  processing_sustainability: '',
  principles_sufficiency: [],
  principles_consistency: [],
  principles_efficiency: [],

  // Origin
  origin_source: '',
  previous_use: '',

  // Application limits
  use_indoor: true,
  use_outdoor: false,
  use_where: '',
  use_not_suitable: '',

  // Certifications
  cert_epd: false,
  cert_cradle_to_cradle: false,
  cert_fsc_pefc: false,

  // Further info / appendix
  env_links_input: '',
  appendix: '',

  manufacturer: '',
  sku: '',
  gwp_value: '',
  gwp_unit: 'kg CO2e/kg',
  recyclable: false,
  recycled_content: '',
  biodegradable: false,
  certifications: '',
  source_url: '',
  notes: '',

  // Location
  latitude: '',
  longitude: '',
  location_name: '',
  address: '',
};

export default function MaterialForm({ material, onClose, enableOfferOnCreate = false }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState(null);
  const [localImages, setLocalImages] = useState([]);
  const [localFiles, setLocalFiles] = useState([]);
  const [pendingImages, setPendingImages] = useState([]); // Files queued before save
  const [pendingFiles, setPendingFiles] = useState([]);   // Files queued before save
  const pendingImagesRef = useRef([]);
  const pendingFilesRef = useRef([]);
  const pendingActorIdsRef = useRef([]);

  // Images queued for upload in offer-only mode (uploaded after offer is created)
  const [offerPendingImages, setOfferPendingImages] = useState([]);
  const offerPendingImagesRef = useRef([]);

  // Optional: create a material offer (inventory entry) right after creating the material
  const [createOffer, setCreateOffer] = useState(false);
  const [offerData, setOfferData] = useState({
    quantity: '',
    unit: 'kg',
    location_name: '',
    address: '',
    latitude: '',
    longitude: '',
    is_available: true,
    available_for_transfer: false,
    available_for_gift: false,
    notes: '',
  });

  const [actorIds, setActorIds] = useState(['']); // list of selected actor IDs (empty string = unset slot)

  // Mode toggle: 'material' = full material creation, 'offer-only' = just create an inventory offer
  const [mode, setMode] = useState('material');
  const [offerMaterialId, setOfferMaterialId] = useState('');

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['material-categories'],
    queryFn: materialService.getCategories,
  });

  const { data: allActors = [] } = useQuery({
    queryKey: ['actors'],
    queryFn: () => actorService.getAll(),
    select: (d) => (Array.isArray(d) ? d : d?.data || []),
  });

  const { data: allMaterials = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materialService.getAll(),
    select: (d) => Array.isArray(d) ? d : (d?.data || []),
    enabled: !material, // only needed in create mode
  });

  useEffect(() => {
    if (material?.id) {
      materialActorService.getActors(material.id).then((actors) => {
        setActorIds(actors.length > 0 ? actors.map((a) => a.id) : ['']);
      }).catch(() => {});
    }
  }, [material?.id]);

  useEffect(() => {
    if (material) {
      setLocalImages(material.images || []);
      setLocalFiles(material.files || []);
      const similarIds = safeJsonParse(material.similar_material_ids, []);
      const envLinks = safeJsonParse(material.env_links, []);
      const envLines = Array.isArray(envLinks)
        ? envLinks
            .map((l) => (typeof l === 'string' ? l : l?.url || ''))
            .filter(Boolean)
        : [];

      setFormData({
        name: material.name || '',
        category: material.category || '',
        description: material.description || '',

        short_description: material.short_description || '',
        origin_acquisition: material.origin_acquisition || '',
        use_processing: material.use_processing || '',
        use_indoor_outdoor: material.use_indoor_outdoor || '',
        use_limitations: material.use_limitations || '',
        similar_material_ids_input: Array.isArray(similarIds) ? similarIds.join(', ') : '',

        tech_thicknesses: material.tech_thicknesses || '',
        tech_dimensions: material.tech_dimensions || '',
        tech_density: material.tech_density || '',
        tech_flammability: material.tech_flammability || '',
        tech_acoustics: material.tech_acoustics || '',
        tech_thermal_insulation: material.tech_thermal_insulation || '',
        tech_compressive_strength: material.tech_compressive_strength || '',
        tech_tensile_strength: material.tech_tensile_strength || '',

        sust_climate_description: material.sust_climate_description || '',
        gwp_total_value: material.gwp_total_value ?? '',
        gwp_total_unit: material.gwp_total_unit || 'kg CO2e',
        recyclate_content: material.recyclate_content ?? '',
        recycling_percentage: material.recycling_percentage ?? '',
        voc_values: material.voc_values || '',
        circularity: material.circularity || '',
        human_health: material.human_health || '',
        processing_sustainability: material.processing_sustainability || '',
        principles_sufficiency: safeJsonParse(material.principles_sufficiency, []),
        principles_consistency: safeJsonParse(material.principles_consistency, []),
        principles_efficiency: safeJsonParse(material.principles_efficiency, []),

        origin_source: material.origin_source || '',
        previous_use: material.previous_use || '',
        use_indoor: material.use_indoor !== undefined ? Boolean(material.use_indoor) : true,
        use_outdoor: Boolean(material.use_outdoor),
        use_where: material.use_where || '',
        use_not_suitable: material.use_not_suitable || '',

        cert_epd: Boolean(material.cert_epd),
        cert_cradle_to_cradle: Boolean(material.cert_cradle_to_cradle),
        cert_fsc_pefc: Boolean(material.cert_fsc_pefc),

        env_links_input: envLines.join('\n'),
        appendix: material.appendix || '',

        manufacturer: material.manufacturer || '',
        sku: material.sku || '',
        gwp_value: material.gwp_value || '',
        gwp_unit: material.gwp_unit || 'kg CO2e/kg',
        recyclable: Boolean(material.recyclable),
        recycled_content: material.recycled_content || '',
        biodegradable: Boolean(material.biodegradable),
        certifications: material.certifications || '',
        source_url: material.source_url || '',
        notes: material.notes || '',

        latitude: material.latitude ?? '',
        longitude: material.longitude ?? '',
        location_name: material.location_name || '',
        address: material.address || '',
      });
    }
  }, [material]);

  const createMutation = useMutation({
    mutationFn: materialService.create,
    onSuccess: async (created) => {
      setSavedId(created?.id || null);
      setLocalImages(created?.images || []);

      // Upload any images/files that were selected before saving (use refs to avoid stale closure)
      const imgQueue = pendingImagesRef.current;
      const fileQueue = pendingFilesRef.current;
      if (created?.id && (imgQueue.length > 0 || fileQueue.length > 0)) {
        const { materialImageService } = await import('../../services/materialService');
        if (imgQueue.length > 0) {
          const uploaded = await materialImageService.upload(created.id, imgQueue, { sort_start: 0 });
          setLocalImages(Array.isArray(uploaded) ? uploaded : [uploaded]);
          setPendingImages([]);
          pendingImagesRef.current = [];
        }
        if (fileQueue.length > 0) {
          const uploaded = await materialImageService.uploadFiles(created.id, fileQueue);
          setLocalFiles(Array.isArray(uploaded) ? uploaded : [uploaded]);
          setPendingFiles([]);
          pendingFilesRef.current = [];
        }
      }

      // Save actor associations
      if (created?.id && pendingActorIdsRef.current.length > 0) {
        materialActorService.setActors(created.id, pendingActorIdsRef.current).catch(() => {});
        pendingActorIdsRef.current = [];
      }

      try {
        if (enableOfferOnCreate && createOffer && created?.id) {
          const submitOffer = {
            material_id: created.id,
            quantity: offerData.quantity ? parseFloat(offerData.quantity) : 0,
            unit: offerData.unit,
            location_name: offerData.location_name,
            address: offerData.address,
            latitude: offerData.latitude ? parseFloat(offerData.latitude) : null,
            longitude: offerData.longitude ? parseFloat(offerData.longitude) : null,
            is_available: Boolean(offerData.is_available),
            available_for_transfer: Boolean(offerData.available_for_transfer),
            available_for_gift: Boolean(offerData.available_for_gift),
            notes: offerData.notes,
          };
          await inventoryService.create(submitOffer);
          queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['my-inventory'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['marketplace-inventory'], exact: false });
        }
      } finally {
        queryClient.invalidateQueries({ queryKey: ['materials'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['material-categories'], exact: false });
        toast.success('Material erfolgreich angelegt.');
      }
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Erstellen fehlgeschlagen.';
      setError(msg);
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => materialService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['material-categories'] });
      toast.success('Material gespeichert.');
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Aktualisieren fehlgeschlagen.';
      setError(msg);
      toast.error(msg);
    },
  });

  const offerOnlyMutation = useMutation({
    mutationFn: () => inventoryService.create({
      material_id: offerMaterialId,
      quantity: offerData.quantity ? parseFloat(offerData.quantity) : 0,
      unit: offerData.unit,
      location_name: offerData.location_name,
      address: offerData.address,
      latitude: offerData.latitude ? parseFloat(offerData.latitude) : null,
      longitude: offerData.longitude ? parseFloat(offerData.longitude) : null,
      is_available: Boolean(offerData.is_available),
      available_for_transfer: Boolean(offerData.available_for_transfer),
      available_for_gift: Boolean(offerData.available_for_gift),
      notes: offerData.notes,
    }),
    onSuccess: async (created) => {
      if (created?.id && offerPendingImagesRef.current.length > 0) {
        try {
          await inventoryService.uploadImages(created.id, offerPendingImagesRef.current);
          offerPendingImagesRef.current = [];
          setOfferPendingImages([]);
        } catch { /* non-critical */ }
      }
      queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['marketplace-inventory'], exact: false });
      toast.success('Angebot erfolgreich erstellt.');
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Angebot konnte nicht erstellt werden.';
      setError(msg);
      toast.error(msg);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'offer-only') {
      if (!offerMaterialId) { setError('Bitte ein Material auswählen.'); return; }
      offerOnlyMutation.mutate();
      return;
    }

    const similarIds = (formData.similar_material_ids_input || '')
      .split(/[\n,]/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const envLinks = (formData.env_links_input || '')
      .split(/\n/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((url) => ({ url }));

    const submitData = {
      ...formData,
      category: formData.category?.trim(),

      // normalize numeric fields
      gwp_value: formData.gwp_value !== '' ? parseFloat(formData.gwp_value) : null,
      gwp_total_value: formData.gwp_total_value !== '' ? parseFloat(formData.gwp_total_value) : null,
      recyclate_content: formData.recyclate_content !== '' ? parseFloat(formData.recyclate_content) : null,
      recycling_percentage: formData.recycling_percentage !== '' ? parseFloat(formData.recycling_percentage) : null,
      recycled_content: formData.recycled_content ? parseFloat(formData.recycled_content) : null,
      latitude: formData.latitude !== '' ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude !== '' ? parseFloat(formData.longitude) : null,

      // normalize arrays/JSON
      similar_material_ids: JSON.stringify(similarIds),
      env_links: JSON.stringify(envLinks),
      principles_sufficiency: JSON.stringify(formData.principles_sufficiency || []),
      principles_consistency: JSON.stringify(formData.principles_consistency || []),
      principles_efficiency: JSON.stringify(formData.principles_efficiency || []),
    };

    // Remove helper-only fields
    delete submitData.similar_material_ids_input;
    delete submitData.env_links_input;

    const validActorIds = actorIds.filter(Boolean);
    pendingActorIdsRef.current = validActorIds;

    if (material) {
      materialActorService.setActors(material.id, validActorIds).catch(() => {});
      updateMutation.mutate({ id: material.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleOfferChange = (e) => {
    const { name, value, type, checked } = e.target;
    setOfferData({
      ...offerData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending || offerOnlyMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {material ? 'Material bearbeiten' : mode === 'offer-only' ? 'Neues Angebot' : 'Neues Material'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Mode toggle — only when creating (not editing) */}
          {!material && (
            <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setMode('material')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  mode === 'material'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                Material anlegen
              </button>
              <button
                type="button"
                onClick={() => setMode('offer-only')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  mode === 'offer-only'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                Nur Angebot
              </button>
            </div>
          )}

          {mode === 'offer-only' ? (
            /* ── Offer-only mode ─────────────────────────────────────────── */
            <div className="space-y-4">
              <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                Es wird kein neues Material angelegt. Wähle ein bestehendes Material und trage die Verfügbarkeit ein.
              </p>

              {/* Material selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material *</label>
                <select
                  value={offerMaterialId}
                  onChange={e => setOfferMaterialId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">— Material auswählen —</option>
                  {allMaterials
                    .slice()
                    .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name))
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.name}{m.category ? ` (${m.category})` : ''}</option>
                    ))
                  }
                </select>
              </div>

              {/* Quantity + Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Menge *</label>
                  <input type="number" step="0.01" name="quantity" value={offerData.quantity}
                    onChange={handleOfferChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Einheit *</label>
                  <select name="unit" value={offerData.unit} onChange={handleOfferChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="m">m</option>
                    <option value="m2">m²</option>
                    <option value="m3">m³</option>
                    <option value="Stück">Stück</option>
                    <option value="unit">unit</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="w-3.5 h-3.5 inline mr-1" />Standortname
                </label>
                <input type="text" name="location_name" value={offerData.location_name}
                  onChange={handleOfferChange} placeholder="z.B. Lager Zeitz"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input type="text" name="address" value={offerData.address}
                  onChange={handleOfferChange} placeholder="Straße, PLZ, Ort"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <GeolocateButton
                  onLocate={(lat, lon) => setOfferData(d => ({ ...d, latitude: lat, longitude: lon }))}
                  className="mb-2"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Breitengrad</label>
                    <input type="number" step="0.000001" name="latitude" value={offerData.latitude}
                      onChange={handleOfferChange} placeholder="z.B. 51.05"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Längengrad</label>
                    <input type="number" step="0.000001" name="longitude" value={offerData.longitude}
                      onChange={handleOfferChange} placeholder="z.B. 12.13"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                </div>
              </div>

              {/* Availability flags */}
              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" name="is_available" checked={offerData.is_available}
                    onChange={handleOfferChange} className="w-4 h-4 text-orange-500 border-gray-300 rounded" />
                  Sichtbar
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" name="available_for_transfer" checked={offerData.available_for_transfer}
                    onChange={handleOfferChange} className="w-4 h-4 text-primary-500 border-gray-300 rounded" />
                  Transfer
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" name="available_for_gift" checked={offerData.available_for_gift}
                    onChange={handleOfferChange} className="w-4 h-4 text-primary-500 border-gray-300 rounded" />
                  Schenkung
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                <textarea name="notes" value={offerData.notes} onChange={handleOfferChange} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>

              {/* Image section */}
              {(() => {
                const mat = allMaterials.find(m => m.id === offerMaterialId);
                const coverPath = mat?.images?.[0]?.file_path;
                const coverUrl = coverPath ? `${API_BASE}${coverPath.replace(/^\./, '')}` : null;
                return (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Abbildung</label>

                    {/* Standard: material cover image with disclaimer */}
                    {coverUrl && offerPendingImages.length === 0 && (
                      <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                        <img src={coverUrl} alt={mat.name} className="w-full h-36 object-cover opacity-90" />
                        <span className="absolute bottom-2 left-2 text-[10px] text-white bg-black/50 px-2 py-0.5 rounded-full">
                          Standardbild · Abbildung kann abweichen
                        </span>
                      </div>
                    )}
                    {!coverUrl && offerPendingImages.length === 0 && (
                      <p className="text-xs text-gray-400 italic">Kein Standardbild verfügbar – du kannst ein eigenes Bild hochladen.</p>
                    )}

                    {/* Queued custom images */}
                    {offerPendingImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {offerPendingImages.map((file, i) => (
                          <div key={i} className="relative rounded-lg overflow-hidden border border-dashed border-primary-300 bg-primary-50">
                            <img src={URL.createObjectURL(file)} className="w-full h-20 object-cover opacity-90" alt={file.name} />
                            <button type="button"
                              onClick={() => {
                                const updated = offerPendingImages.filter((_, j) => j !== i);
                                offerPendingImagesRef.current = updated;
                                setOfferPendingImages(updated);
                              }}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center leading-none">
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload trigger */}
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-primary-600 hover:text-primary-700 border border-dashed border-primary-300 rounded-lg px-3 py-1.5 bg-primary-50 hover:bg-primary-100 transition-colors">
                      <Upload className="w-3 h-3" />
                      {offerPendingImages.length > 0 ? 'Weitere Bilder hinzufügen' : 'Eigene Bilder hochladen (ersetzt Standardbild)'}
                      <input type="file" multiple accept="image/*" className="hidden"
                        onChange={e => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          const updated = [...offerPendingImagesRef.current, ...files];
                          offerPendingImagesRef.current = updated;
                          setOfferPendingImages(updated);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* ── Material mode (existing form) ───────────────────────────── */
            <>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
                disabled={catsLoading}
              >
                <option value="" disabled>
                  {catsLoading ? 'Loading categories…' : 'Select a category'}
                </option>
                {/* Ensure legacy category appears if editing and not in list */}
                {material && formData.category && !categories.includes(formData.category) && (
                  <option value={formData.category}>{formData.category} (legacy)</option>
                )}
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Extended material details */}
          <div className="pt-2">
            <div className="text-sm font-semibold text-gray-900 mb-2">Materialdetails</div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kurzbeschreibung</label>
                <textarea
                  name="short_description"
                  value={formData.short_description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                  placeholder="Kurze, prägnante Beschreibung des Materials"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Herkunft &amp; Gewinnung</label>
                <textarea
                  name="origin_acquisition"
                  value={formData.origin_acquisition}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                  placeholder="Beschreibung der Gewinnung / Herstellung"
                />
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ähnliche Materialien (IDs)</label>
                  <input
                    type="text"
                    name="similar_material_ids_input"
                    value={formData.similar_material_ids_input}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="z. B. 123, 456 (kommagetrennt)"
                  />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grenzen des Materials</label>
                <textarea
                  name="use_limitations"
                  value={formData.use_limitations}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Technical data */}
          <div className="pt-2">
            <div className="text-sm font-semibold text-gray-900 mb-2">Technische Daten</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Materialstärken</label>
                <input
                  type="text"
                  name="tech_thicknesses"
                  value={formData.tech_thicknesses}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="z. B. 10 / 20 / 40 mm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Materialabmessungen</label>
                <input
                  type="text"
                  name="tech_dimensions"
                  value={formData.tech_dimensions}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="z. B. 1200 x 580 mm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dichte</label>
                <input
                  type="text"
                  name="tech_density"
                  value={formData.tech_density}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="z. B. 35 kg/m³"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entflammbarkeit</label>
                <input
                  type="text"
                  name="tech_flammability"
                  value={formData.tech_flammability}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="z. B. B2 / EN 13501-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Akustik</label>
                <input
                  type="text"
                  name="tech_acoustics"
                  value={formData.tech_acoustics}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wärmeisolation</label>
                <input
                  type="text"
                  name="tech_thermal_insulation"
                  value={formData.tech_thermal_insulation}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sustainability */}
          <div className="pt-2">
            <div className="text-sm font-semibold text-gray-900 mb-2">Nachhaltigkeit</div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Einfluss auf Klimawandel (Beschreibung)</label>
                <textarea
                  name="sust_climate_description"
                  value={formData.sust_climate_description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GWP gesamt</label>
                  <input
                    type="number"
                    step="0.001"
                    name="gwp_total_value"
                    value={formData.gwp_total_value}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="z. B. 12.34"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Einheit</label>
                  <input
                    type="text"
                    name="gwp_total_unit"
                    value={formData.gwp_total_unit}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recyclatanteil (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    name="recyclate_content"
                    value={formData.recyclate_content}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kreislauffähigkeit</label>
                  <input
                    type="text"
                    name="circularity"
                    value={formData.circularity}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Human Health (z. B. VOC)</label>
                  <input
                    type="text"
                    name="human_health"
                    value={formData.human_health}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Be- &amp; Verarbeitung</label>
                <input
                  type="text"
                  name="processing_sustainability"
                  value={formData.processing_sustainability}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-sm font-semibold text-gray-900 mb-3">Ökodesign-Prinzipien</div>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">Konsistenz</div>
                    <div className="flex flex-wrap gap-3">
                      {PRINCIPLES.consistency.map((p) => (
                        <label key={p} className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(formData.principles_consistency || []).includes(p)}
                            onChange={() => setFormData((prev) => ({ ...prev, principles_consistency: toggleInArray(prev.principles_consistency, p) }))}
                            className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                          />
                          {p}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">Effizienz</div>
                    <div className="flex flex-wrap gap-3">
                      {PRINCIPLES.efficiency.map((p) => (
                        <label key={p} className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(formData.principles_efficiency || []).includes(p)}
                            onChange={() => setFormData((prev) => ({ ...prev, principles_efficiency: toggleInArray(prev.principles_efficiency, p) }))}
                            className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                          />
                          {p}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Further info */}
          <div className="pt-2">
            <div className="text-sm font-semibold text-gray-900 mb-2">Weiterführende Informationen</div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Links zu Umweltinformationen (z. B. EPDs) – je Zeile ein Link</label>
                <textarea
                  name="env_links_input"
                  value={formData.env_links_input}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anhang (Quellen, Referenzen, Dokumente)</label>
                <textarea
                  name="appendix"
                  value={formData.appendix}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="pt-2">
            <div className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-gray-500" />
              Standort des Materials
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Standortname</label>
                <input
                  type="text"
                  name="location_name"
                  value={formData.location_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="z.B. Lager Zeitz, Werkstatt RZZ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Straße, PLZ Ort"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Breitengrad</label>
                  <input
                    type="number"
                    step="any"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="51.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Längengrad</label>
                  <input
                    type="number"
                    step="any"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="12.0"
                  />
                </div>
              </div>
              <GeolocateButton
                onLocate={(lat, lon) =>
                  setFormData((prev) => ({ ...prev, latitude: lat, longitude: lon }))
                }
              />
            </div>
          </div>

          {/* Beteiligte Akteure */}
          <div className="pt-2">
            <div className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-gray-500" />
              Beteiligte Akteure
            </div>
            <div className="space-y-2">
              {actorIds.map((actorId, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={actorId}
                    onChange={(e) => {
                      const next = [...actorIds];
                      next[idx] = e.target.value;
                      setActorIds(next);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                  >
                    <option value="">— Akteur wählen —</option>
                    {allActors.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}{a.type ? ` (${a.type})` : ''}</option>
                    ))}
                  </select>
                  {actorIds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setActorIds(actorIds.filter((_, i) => i !== idx))}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setActorIds([...actorIds, ''])}
                className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Weiteren Akteur hinzufügen
              </button>
            </div>
          </div>

          {/* Optional offer creation (only when creating a new material) */}
          {!material && enableOfferOnCreate && (
            <div className="border-2 border-primary-200 bg-primary-50 rounded-xl p-4">
              <label className="flex items-center gap-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createOffer}
                  onChange={(e) => setCreateOffer(e.target.checked)}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500 flex-shrink-0"
                />
                <div>
                  <div className="text-sm font-bold text-primary-900">Material als Angebot verfügbar machen</div>
                  <div className="text-xs text-primary-700 mt-0.5">Aktivieren um Menge, Standort und Verfügbarkeit einzutragen – das Material erscheint dann in der Angebotsübersicht.</div>
                </div>
              </label>

              {createOffer ? (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Menge *</label>
                      <input
                        type="number"
                        step="0.01"
                        name="quantity"
                        value={offerData.quantity}
                        onChange={handleOfferChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Einheit *</label>
                      <select
                        name="unit"
                        value={offerData.unit}
                        onChange={handleOfferChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                        required
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="m">m</option>
                        <option value="m2">m²</option>
                        <option value="m3">m³</option>
                        <option value="piece">piece</option>
                        <option value="unit">unit</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MapPin className="w-4 h-4 inline mr-1" /> Standortname
                    </label>
                    <input
                      type="text"
                      name="location_name"
                      value={offerData.location_name}
                      onChange={handleOfferChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      placeholder="z.B. Lager Zeitz"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                    <input
                      type="text"
                      name="address"
                      value={offerData.address}
                      onChange={handleOfferChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      placeholder="Straße, PLZ, Ort"
                    />
                  </div>

                  <div>
                    <GeolocateButton
                      onLocate={(lat, lon) => setOfferData(d => ({ ...d, latitude: lat, longitude: lon }))}
                      className="mb-2"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Breitengrad</label>
                        <input
                          type="number"
                          step="0.000001"
                          name="latitude"
                          value={offerData.latitude}
                          onChange={handleOfferChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                          placeholder="z.B. 51.05"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Längengrad</label>
                        <input
                          type="number"
                          step="0.000001"
                          name="longitude"
                          value={offerData.longitude}
                          onChange={handleOfferChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                          placeholder="z.B. 12.13"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="is_available"
                        checked={offerData.is_available}
                        onChange={handleOfferChange}
                        className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Sichtbar</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="available_for_transfer"
                        checked={offerData.available_for_transfer}
                        onChange={handleOfferChange}
                        className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Transfer</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="available_for_gift"
                        checked={offerData.available_for_gift}
                        onChange={handleOfferChange}
                        className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Gift</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                    <textarea
                      name="notes"
                      value={offerData.notes}
                      onChange={handleOfferChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manufacturer
              </label>
              <input
                type="text"
                name="manufacturer"
                value={formData.manufacturer}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Environmental Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GWP Value
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="gwp_value"
                  value={formData.gwp_value}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="e.g., 2.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GWP Unit
                </label>
                <select
                  name="gwp_unit"
                  value={formData.gwp_unit}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="kg CO2e/kg">kg CO₂e/kg</option>
                  <option value="kg CO2e/m2">kg CO₂e/m²</option>
                  <option value="kg CO2e/m3">kg CO₂e/m³</option>
                  <option value="kg CO2e/unit">kg CO₂e/unit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recycled Content (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  name="recycled_content"
                  value={formData.recycled_content}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certifications
                </label>
                <input
                  type="text"
                  name="certifications"
                  value={formData.certifications}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="e.g., FSC, LEED"
                />
              </div>
            </div>

            <div className="flex gap-6 mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="recyclable"
                  checked={formData.recyclable}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Recyclable</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="biodegradable"
                  checked={formData.biodegradable}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Biodegradable</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source URL
            </label>
            <input
              type="url"
              name="source_url"
              value={formData.source_url}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="https://"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* NEW: technical properties */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold text-gray-800">🔧 Technische Eigenschaften</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Druckfestigkeit</label>
                <input type="text" name="tech_compressive_strength" value={formData.tech_compressive_strength}
                  onChange={e => setFormData({...formData, tech_compressive_strength: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="z.B. 30 N/mm²" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Zugfestigkeit</label>
                <input type="text" name="tech_tensile_strength" value={formData.tech_tensile_strength}
                  onChange={e => setFormData({...formData, tech_tensile_strength: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="z.B. 500 N/mm²" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Recyclinganteil (%)</label>
                <input type="number" step="0.1" min="0" max="100" name="recycling_percentage" value={formData.recycling_percentage}
                  onChange={e => setFormData({...formData, recycling_percentage: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">VOC-Werte</label>
                <input type="text" name="voc_values" value={formData.voc_values}
                  onChange={e => setFormData({...formData, voc_values: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="z.B. A+" />
              </div>
            </div>
          </div>

          {/* NEW: Origin */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold text-gray-800">🌍 Herkunft</p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Quelle</label>
              <select name="origin_source" value={formData.origin_source}
                onChange={e => setFormData({...formData, origin_source: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="">Wählen…</option>
                <option value="primary">Primärquelle</option>
                <option value="secondary_rückbau">Sekundärquelle – Rückbau</option>
                <option value="secondary_überschuss">Sekundärquelle – Überschuss</option>
                <option value="secondary_restposten">Sekundärquelle – Restposten</option>
              </select>
            </div>
            {formData.origin_source?.startsWith('secondary') && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vorherige Nutzung</label>
                <input type="text" name="previous_use" value={formData.previous_use}
                  onChange={e => setFormData({...formData, previous_use: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="z.B. Dachstuhl, Industriehalle" />
              </div>
            )}
          </div>

          {/* NEW: Application limits */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold text-gray-800">🏗️ Grenzen der Anwendung</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={formData.use_indoor} onChange={e => setFormData({...formData, use_indoor: e.target.checked})} className="w-4 h-4 text-primary-500 rounded" />
                Innen
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={formData.use_outdoor} onChange={e => setFormData({...formData, use_outdoor: e.target.checked})} className="w-4 h-4 text-primary-500 rounded" />
                Außen
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Geeignet für</label>
              <textarea name="use_where" value={formData.use_where} onChange={e => setFormData({...formData, use_where: e.target.value})} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" placeholder="Wo kann das Material verwendet werden?" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nicht geeignet für</label>
              <textarea name="use_not_suitable" value={formData.use_not_suitable} onChange={e => setFormData({...formData, use_not_suitable: e.target.value})} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" placeholder="Wo ist es nicht geeignet?" />
            </div>
          </div>

          {/* NEW: Certifications */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-gray-800">🏅 Zertifizierungen & Standards</p>
            {[
              { key: 'cert_epd', label: 'Umweltproduktdeklarationen (EPD)' },
              { key: 'cert_cradle_to_cradle', label: 'Cradle-to-Cradle' },
              { key: 'cert_fsc_pefc', label: 'FSC / PEFC' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={formData[key]} onChange={e => setFormData({...formData, [key]: e.target.checked})} className="w-4 h-4 text-primary-500 rounded" />
                {label}
              </label>
            ))}
          </div>

          {/* Images */}
          {/* Pending preview — shown before material is saved */}
          {pendingImages.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-700">Bilder (erstes = Cover)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pendingImages.map((file, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border-2 border-dashed border-primary-300 bg-primary-50">
                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-28 object-cover opacity-80" />
                    <span className="absolute top-1 left-1 bg-primary-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                      {i === 0 ? 'Cover' : `Bild ${i + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = pendingImages.filter((_, j) => j !== i);
                        pendingImagesRef.current = updated;
                        setPendingImages(updated);
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >×</button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg">
                Bilder werden automatisch beim Speichern hochgeladen.
              </p>
            </div>
          )}
          <ImageUploader
            images={localImages}
            onUpload={async (files, opts) => {
              const id = material?.id || savedId;
              if (!id) {
                // Queue for upload after save
                const updated = [...pendingImagesRef.current, ...files];
                pendingImagesRef.current = updated;
                setPendingImages(updated);
                return;
              }
              const { materialImageService } = await import('../../services/materialService');
              const result = await materialImageService.upload(id, files, opts);
              setLocalImages(prev => [...prev, ...(Array.isArray(result) ? result : [result])]);
            }}
            onDelete={async (imageId) => {
              const id = material?.id || savedId;
              if (!id) return;
              const { materialImageService } = await import('../../services/materialService');
              await materialImageService.delete(id, imageId);
              setLocalImages(prev => prev.filter(i => i.id !== imageId));
            }}
            apiBase={API_BASE}
            showSteps={true}
            label={pendingImages.length > 0 ? 'Weitere Bilder hinzufügen' : 'Bilder (erstes = Cover)'}
          />

          {/* Files */}
          <FileUploader
            files={localFiles}
            onUpload={async (files) => {
              const id = material?.id || savedId;
              if (!id) {
                const updated = [...pendingFilesRef.current, ...files];
                pendingFilesRef.current = updated;
                setPendingFiles(updated);
                return;
              }
              const { materialImageService } = await import('../../services/materialService');
              const result = await materialImageService.uploadFiles(id, files);
              setLocalFiles(prev => [...prev, ...(Array.isArray(result) ? result : [result])]);
            }}
            onDelete={async (fileId) => {
              const id = material?.id || savedId;
              if (!id) return;
              const { materialImageService } = await import('../../services/materialService');
              await materialImageService.deleteFile(id, fileId);
              setLocalFiles(prev => prev.filter(f => f.id !== fileId));
            }}
            apiBase={API_BASE}
            label="Fertigungsdaten & Dateien"
          />

          {savedId && !material && (
            <p className="text-xs text-primary-700 bg-primary-50 px-3 py-2 rounded-lg">
              ✓ Material gespeichert – du kannst jetzt Bilder und Dateien hinzufügen oder schließen.
            </p>
          )}
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              {savedId && !material ? 'Schließen' : 'Abbrechen'}
            </button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50">
              {isPending
                ? 'Speichern…'
                : material
                  ? 'Material speichern'
                  : mode === 'offer-only'
                    ? 'Angebot erstellen'
                    : 'Material anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
