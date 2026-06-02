import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { materialService, materialActorService } from '../../services/materialService';
import { actorService } from '../../services/actorService';
import { inventoryService } from '../../services/inventoryService';
import { MapPin, X, Plus, Trash2, Users, Package, Upload, Search,
  ChevronDown, ChevronUp, Leaf, Wrench, Recycle, FlaskConical, Info } from 'lucide-react';
import GeolocateButton from '../shared/GeolocateButton';
import LocationPicker from '../shared/LocationPicker';
import ImageUploader from '../shared/ImageUploader';
import FileUploader from '../shared/FileUploader';
import InfoTooltip from '../shared/InfoTooltip';

import { MEDIA_BASE } from '../../services/api';
import { useToast } from '../../store/toastStore';
import { useT } from '../../i18n/useT';
const API_BASE = MEDIA_BASE;

// ── Accordion section ─────────────────────────────────────────────────────────

function AccordionSection({ icon: Icon, title, color = '#6b7280', filled = false, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          {filled && !open && (
            <span className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" title="Daten vorhanden" />
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-4 pb-5 pt-4 space-y-4">{children}</div>}
    </div>
  );
}

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
  latitude: '51.0532575',
  longitude: '12.1287658',
  location_name: '',
  address: '',

  // EPD / Ökobilanz-Grunddaten (EN 15804)
  declared_unit: '',
  gwp_fossil: '',
  gwp_biogenic: '',
  gwp_luluc: '',
  adp_fossil: '',
  adp_elements: '',
  lifecycle_scope: '',
  water_consumption: '',
};

export default function MaterialForm({ material, onClose, enableOfferOnCreate = false, initialMode }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useT();
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

  // Images queued for upload in gesuch mode (uploaded after gesuch is created)
  const [gesuchPendingImages, setGesuchPendingImages] = useState([]);
  const gesuchPendingImagesRef = useRef([]);

  // Optional: create a material offer (inventory entry) right after creating the material
  const [createOffer, setCreateOffer] = useState(false);
  const [offerData, setOfferData] = useState({
    quantity: '',
    unit: 'kg',
    location_name: '',
    address: '',
    latitude: '51.0532575',
    longitude: '12.1287658',
    is_available: true,
    available_for_transfer: false,
    available_for_gift: false,
    notes: '',
  });

  const [actorIds, setActorIds] = useState(['']); // list of selected actor IDs (empty string = unset slot)

  // Mode toggle: 'material' = full material creation, 'offer-only' = just create an inventory offer, 'gesuch' = wanted request
  const [mode, setMode] = useState(initialMode || 'material');
  const [offerMaterialId, setOfferMaterialId] = useState('');
  const [gesuchMaterialId, setGesuchMaterialId] = useState('');
  const [gesuchMode, setGesuchMode] = useState('existing'); // 'existing' | 'new'
  const [newMaterialData, setNewMaterialData] = useState({ name: '', category: '' });
  const [gesuchData, setGesuchData] = useState({
    quantity: '',
    unit: 'kg',
    notes: '',
    location_name: '',
    latitude: '51.0532575',
    longitude: '12.1287658',
  });

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

        declared_unit: material.declared_unit || '',
        gwp_fossil: material.gwp_fossil ?? '',
        gwp_biogenic: material.gwp_biogenic ?? '',
        gwp_luluc: material.gwp_luluc ?? '',
        adp_fossil: material.adp_fossil ?? '',
        adp_elements: material.adp_elements ?? '',
        lifecycle_scope: material.lifecycle_scope || '',
        water_consumption: material.water_consumption ?? '',
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
        toast.success(t('materialForm.toastCreated'));
      }
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || t('materialForm.errorCreate');
      setError(msg);
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => materialService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['material-categories'] });
      toast.success(t('materialForm.toastSaved'));
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || t('materialForm.errorUpdate');
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
      toast.success(t('materialForm.toastOfferCreated'));
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || t('materialForm.errorOffer');
      setError(msg);
      toast.error(msg);
    },
  });

  const gesuchMutation = useMutation({
    mutationFn: async () => {
      let matId = gesuchMaterialId;
      if (gesuchMode === 'new') {
        const created = await materialService.create({
          name: newMaterialData.name.trim(),
          category: newMaterialData.category.trim(),
        });
        matId = created?.id || created?.data?.id;
      }
      return inventoryService.create({
        material_id: matId,
        quantity: gesuchData.quantity ? parseFloat(gesuchData.quantity) : 0,
        unit: gesuchData.unit,
        location_name: gesuchData.location_name,
        latitude: gesuchData.latitude ? parseFloat(gesuchData.latitude) : null,
        longitude: gesuchData.longitude ? parseFloat(gesuchData.longitude) : null,
        notes: gesuchData.notes,
        is_available: true,
        entry_type: 'gesuch',
      });
    },
    onSuccess: async (created) => {
      if (created?.id && gesuchPendingImagesRef.current.length > 0) {
        try {
          await inventoryService.uploadImages(created.id, gesuchPendingImagesRef.current);
          gesuchPendingImagesRef.current = [];
          setGesuchPendingImages([]);
        } catch { /* non-critical */ }
      }
      queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['gesuche'], exact: false });
      if (gesuchMode === 'new') {
        queryClient.invalidateQueries({ queryKey: ['materials'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['material-categories'], exact: false });
      }
      toast.success(t('materialForm.toastGesuchCreated'));
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || t('materialForm.errorGesuch');
      setError(msg);
      toast.error(msg);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'gesuch') {
      if (gesuchMode === 'existing' && !gesuchMaterialId) { setError(t('materialForm.errorChooseMaterial')); return; }
      if (gesuchMode === 'new' && !newMaterialData.name.trim()) { setError(t('materialForm.errorEnterName')); return; }
      gesuchMutation.mutate();
      return;
    }

    if (mode === 'offer-only') {
      if (!offerMaterialId) { setError(t('materialForm.errorChooseMaterial')); return; }
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

    // Parse EPD numeric components
    const epdFossil   = formData.gwp_fossil   !== '' ? parseFloat(formData.gwp_fossil)   : null;
    const epdBiogenic = formData.gwp_biogenic  !== '' ? parseFloat(formData.gwp_biogenic)  : null;
    const epdLuluc    = formData.gwp_luluc     !== '' ? parseFloat(formData.gwp_luluc)     : null;
    // If at least one GWP component is filled, derive gwp_value as their sum (zero-fill missing ones)
    const hasEpdGwp = epdFossil !== null || epdBiogenic !== null || epdLuluc !== null;
    const derivedGwpValue = hasEpdGwp
      ? (epdFossil ?? 0) + (epdBiogenic ?? 0) + (epdLuluc ?? 0)
      : (formData.gwp_value !== '' ? parseFloat(formData.gwp_value) : null);

    const submitData = {
      ...formData,
      category: formData.category?.trim(),

      // normalize numeric fields
      gwp_value: derivedGwpValue,
      gwp_total_value: formData.gwp_total_value !== '' ? parseFloat(formData.gwp_total_value) : null,
      recyclate_content: formData.recyclate_content !== '' ? parseFloat(formData.recyclate_content) : null,
      recycling_percentage: formData.recycling_percentage !== '' ? parseFloat(formData.recycling_percentage) : null,
      recycled_content: formData.recycled_content ? parseFloat(formData.recycled_content) : null,
      latitude: formData.latitude !== '' ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude !== '' ? parseFloat(formData.longitude) : null,

      // EPD numeric fields
      gwp_fossil: epdFossil,
      gwp_biogenic: epdBiogenic,
      gwp_luluc: epdLuluc,
      adp_fossil:        formData.adp_fossil        !== '' ? parseFloat(formData.adp_fossil)        : null,
      adp_elements:      formData.adp_elements       !== '' ? parseFloat(formData.adp_elements)       : null,
      water_consumption: formData.water_consumption  !== '' ? parseFloat(formData.water_consumption)  : null,

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

  const isPending = createMutation.isPending || updateMutation.isPending || offerOnlyMutation.isPending || gesuchMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {material ? t('materialForm.titleEdit') : mode === 'offer-only' ? t('materialForm.titleOffer') : mode === 'gesuch' ? t('materialForm.titleGesuch') : t('materialForm.titleNew')}
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
                {t('materialForm.tabMaterial')}
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
                {t('materialForm.tabOfferOnly')}
              </button>
              <button
                type="button"
                onClick={() => setMode('gesuch')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  mode === 'gesuch'
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                {t('materialForm.tabGesuch')}
              </button>
            </div>
          )}

          {mode === 'gesuch' ? (
            /* ── Gesuch mode ─────────────────────────────────────────────── */
            <div className="space-y-4">
              <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                {t('materialForm.gesuchHint')}
              </p>

              {/* Material: existing or new */}
              <div className="flex p-1 bg-gray-100 rounded-lg gap-1">
                <button type="button" onClick={() => setGesuchMode('existing')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${gesuchMode === 'existing' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t('materialForm.gesuchExisting')}
                </button>
                <button type="button" onClick={() => setGesuchMode('new')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${gesuchMode === 'new' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t('materialForm.gesuchNew')}
                </button>
              </div>

              {gesuchMode === 'existing' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.materialRequired')}</label>
                  <select
                    value={gesuchMaterialId}
                    onChange={e => setGesuchMaterialId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  >
                    <option value="">{t('materialForm.materialChoose')}</option>
                    {allMaterials
                      .slice()
                      .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name))
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.name}{m.category ? ` (${m.category})` : ''}</option>
                      ))
                    }
                  </select>
                </div>
              ) : (
                <div className="space-y-3 bg-purple-50 border border-purple-100 rounded-lg p-3">
                  <p className="text-xs text-purple-600">{t('materialForm.gesuchNewHint')}</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.gesuchName')}</label>
                    <input type="text" value={newMaterialData.name}
                      onChange={e => setNewMaterialData(d => ({ ...d, name: e.target.value }))}
                      placeholder="z.B. Ziegelbruch, Hanffaser, Altholz"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.category')}</label>
                    <select value={newMaterialData.category}
                      onChange={e => setNewMaterialData(d => ({ ...d, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
                      <option value="">{t('materialForm.categoryOptional')}</option>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Quantity + Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.gesuchQty')}</label>
                  <input type="number" step="0.01" value={gesuchData.quantity}
                    onChange={e => setGesuchData(d => ({ ...d, quantity: e.target.value }))}
                    placeholder="optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.unitLabel')}</label>
                  <select value={gesuchData.unit} onChange={e => setGesuchData(d => ({ ...d, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="m">m</option>
                    <option value="m2">m²</option>
                    <option value="m3">m³</option>
                    <option value="Stück">Stück</option>
                    <option value="Liter">Liter</option>
                    <option value="Palette">Palette</option>
                    <option value="unit">unit</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="w-3.5 h-3.5 inline mr-1" />{t('materialForm.locationRegion')}
                </label>
                <input type="text" value={gesuchData.location_name}
                  onChange={e => setGesuchData(d => ({ ...d, location_name: e.target.value }))}
                  placeholder="z.B. Zeitz, Saalekreis"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
              <div>
                <GeolocateButton
                  onLocate={(lat, lon) => setGesuchData(d => ({ ...d, latitude: lat, longitude: lon }))}
                  className="mb-2"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.latitude')}</label>
                    <input type="number" step="0.000001" value={gesuchData.latitude || ''}
                      onChange={e => setGesuchData(d => ({ ...d, latitude: e.target.value }))}
                      placeholder="z.B. 51.05"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.longitude')}</label>
                    <input type="number" step="0.000001" value={gesuchData.longitude || ''}
                      onChange={e => setGesuchData(d => ({ ...d, longitude: e.target.value }))}
                      placeholder="z.B. 12.13"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.gesuchDescLabel')}</label>
                <textarea value={gesuchData.notes} onChange={e => setGesuchData(d => ({ ...d, notes: e.target.value }))} rows={3}
                  placeholder={t('materialForm.gesuchDescPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none" />
              </div>

              {/* Images */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">{t('materialForm.gesuchImages')}</label>
                {gesuchPendingImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {gesuchPendingImages.map((file, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border border-dashed border-purple-300 bg-purple-50">
                        <img src={URL.createObjectURL(file)} className="w-full h-20 object-cover opacity-90" alt={file.name} />
                        <button type="button"
                          onClick={() => {
                            const updated = gesuchPendingImages.filter((_, j) => j !== i);
                            gesuchPendingImagesRef.current = updated;
                            setGesuchPendingImages(updated);
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center leading-none">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-purple-600 hover:text-purple-700 border border-dashed border-purple-300 rounded-lg px-3 py-1.5 bg-purple-50 hover:bg-purple-100 transition-colors">
                  <Upload className="w-3 h-3" />
                  {gesuchPendingImages.length > 0 ? t('materialForm.gesuchImagesMore') : t('materialForm.gesuchImagesUpload')}
                  <input type="file" multiple accept="image/*" className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      const updated = [...gesuchPendingImagesRef.current, ...files];
                      gesuchPendingImagesRef.current = updated;
                      setGesuchPendingImages(updated);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isPending || (gesuchMode === 'existing' && !gesuchMaterialId) || (gesuchMode === 'new' && !newMaterialData.name.trim())}
                className="w-full py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? t('materialForm.gesuchSubmitting') : t('materialForm.gesuchSubmit')}
              </button>
            </div>
          ) : mode === 'offer-only' ? (
            /* ── Offer-only mode ─────────────────────────────────────────── */
            <div className="space-y-4">
              <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                {t('materialForm.offerOnlyHint')}
              </p>

              {/* Material selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.materialRequired')}</label>
                <select
                  value={offerMaterialId}
                  onChange={e => setOfferMaterialId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">{t('materialForm.materialChoose')}</option>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.qtyRequired')}</label>
                  <input type="number" step="0.01" name="quantity" value={offerData.quantity}
                    onChange={handleOfferChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.unitRequired')}</label>
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
                  <MapPin className="w-3.5 h-3.5 inline mr-1" />{t('materialForm.locationName')}
                </label>
                <input type="text" name="location_name" value={offerData.location_name}
                  onChange={handleOfferChange} placeholder="z.B. Lager Zeitz"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.address')}</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.latitude')}</label>
                    <input type="number" step="0.000001" name="latitude" value={offerData.latitude}
                      onChange={handleOfferChange} placeholder="z.B. 51.05"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.longitude')}</label>
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
                  {t('materialForm.visible')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" name="available_for_transfer" checked={offerData.available_for_transfer}
                    onChange={handleOfferChange} className="w-4 h-4 text-primary-500 border-gray-300 rounded" />
                  {t('materialForm.transfer')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" name="available_for_gift" checked={offerData.available_for_gift}
                    onChange={handleOfferChange} className="w-4 h-4 text-primary-500 border-gray-300 rounded" />
                  {t('materialForm.gift')}
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
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
                    <label className="block text-sm font-medium text-gray-700">{t('materialForm.offerImageLabel')}</label>

                    {/* Standard: material cover image with disclaimer */}
                    {coverUrl && offerPendingImages.length === 0 && (
                      <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                        <img src={coverUrl} alt={mat.name} className="w-full h-36 object-cover opacity-90" />
                        <span className="absolute bottom-2 left-2 text-[10px] text-white bg-black/50 px-2 py-0.5 rounded-full">
                          {t('materialForm.offerImageDefault')}
                        </span>
                      </div>
                    )}
                    {!coverUrl && offerPendingImages.length === 0 && (
                      <p className="text-xs text-gray-400 italic">{t('materialForm.offerImageNone')}</p>
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
                      {offerPendingImages.length > 0 ? t('materialForm.offerImagesMore') : t('materialForm.offerImagesUpload')}
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
            /* ── Material mode — new accordion UX ────────────────────────── */
            <>

          {/* ── Primär / Sekundär toggle (required) ───────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Was ist das Material? <span className="text-red-400">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  origin_source: prev.origin_source?.startsWith('secondary') ? prev.origin_source : 'secondary_rückbau',
                }))}
                className={`flex flex-col items-start gap-1 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  formData.origin_source?.startsWith('secondary')
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-semibold text-gray-900">♻ Sekundär / Rezyklat</span>
                <span className="text-[11px] text-gray-500 leading-snug">Rückbau, Überschuss, wiederverwendetes Material</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, origin_source: 'primary' }))}
                className={`flex flex-col items-start gap-1 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  formData.origin_source === 'primary'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-semibold text-gray-900">🏭 Primärmaterial / Neu</span>
                <span className="text-[11px] text-gray-500 leading-snug">Neues Produkt, Herstellerware</span>
              </button>
            </div>
          </div>

          {/* ── Grunddaten ────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('materialForm.name')} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('materialForm.category')}
                <span className="ml-1.5 text-[11px] font-normal text-gray-400">(optional)</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                disabled={catsLoading}
              >
                <option value="">
                  {catsLoading ? t('materialForm.categoryLoading') : t('materialForm.categoryChoose')}
                </option>
                {material && formData.category && !categories.includes(formData.category) && (
                  <option value={formData.category}>{formData.category} (legacy)</option>
                )}
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('materialForm.shortDesc')}
                <span className="ml-1.5 text-[11px] font-normal text-gray-400">(1–2 Sätze)</span>
              </label>
              <textarea
                name="short_description"
                value={formData.short_description}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                placeholder={t('materialForm.shortDescPlaceholder')}
              />
            </div>
          </div>

          {/* ── Images (top-level, always visible) ───────────────────────── */}
          {pendingImages.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-700">{t('materialForm.imagesPendingTitle')}</p>
              <div className="grid grid-cols-3 gap-2">
                {pendingImages.map((file, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border-2 border-dashed border-primary-300 bg-primary-50">
                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-24 object-cover opacity-80" />
                    <span className="absolute top-1 left-1 bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {i === 0 ? 'Cover' : `Bild ${i + 1}`}
                    </span>
                    <button type="button"
                      onClick={() => { const u = pendingImages.filter((_,j) => j!==i); pendingImagesRef.current=u; setPendingImages(u); }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ImageUploader
            images={localImages}
            onUpload={async (files, opts) => {
              const id = material?.id || savedId;
              if (!id) {
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
            onSetCredit={async (imageId, credit) => {
              const id = material?.id || savedId;
              if (!id) return;
              const { materialImageService } = await import('../../services/materialService');
              const updated = await materialImageService.updateMeta(id, imageId, { credit });
              if (Array.isArray(updated)) setLocalImages(updated);
            }}
            apiBase={API_BASE}
            showSteps={true}
            label={pendingImages.length > 0 ? t('materialForm.imagesLabelMore') : t('materialForm.imagesLabel')}
          />

          {savedId && !material && (
            <p className="text-xs text-primary-700 bg-primary-50 px-3 py-2 rounded-lg">
              {t('materialForm.savedNotice')}
            </p>
          )}

          {/* ── Accordion sections ───────────────────────────────────────── */}
          <div className="space-y-2 pt-1">

            {/* 1. Herkunft — auto-open, content depends on type */}
            <AccordionSection
              icon={formData.origin_source?.startsWith('secondary') ? Recycle : Package}
              title={formData.origin_source?.startsWith('secondary') ? 'Herkunft & Bezug' : 'Hersteller & Bezug'}
              color={formData.origin_source?.startsWith('secondary') ? '#16a34a' : '#2563eb'}
              defaultOpen={!!formData.origin_source}
              filled={!!(formData.origin_acquisition || formData.previous_use || formData.manufacturer || formData.sku)}
            >
              {formData.origin_source?.startsWith('secondary') ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.originSource')}</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { val: 'secondary_rückbau', label: t('materialForm.originSecondaryRueckbau') },
                        { val: 'secondary_überschuss', label: t('materialForm.originSecondaryUeberschuss') },
                        { val: 'secondary_restposten', label: t('materialForm.originSecondaryRestposten') },
                      ].map(({ val, label }) => (
                        <button key={val} type="button"
                          onClick={() => setFormData(prev => ({ ...prev, origin_source: val }))}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${formData.origin_source === val ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-700 border-gray-300 hover:border-primary-300'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.previousUse')}</label>
                    <input type="text" name="previous_use" value={formData.previous_use}
                      onChange={e => setFormData(prev => ({...prev, previous_use: e.target.value}))}
                      placeholder={t('materialForm.previousUsePlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.originAcquisition')}</label>
                    <textarea name="origin_acquisition" value={formData.origin_acquisition}
                      onChange={handleChange} rows={3}
                      placeholder={t('materialForm.originAcquisitionPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.similarIds')}</label>
                    <input type="text" name="similar_material_ids_input" value={formData.similar_material_ids_input}
                      onChange={handleChange}
                      placeholder={t('materialForm.similarIdsPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.manufacturer')}</label>
                      <input type="text" name="manufacturer" value={formData.manufacturer} onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SKU / Artikelnummer</label>
                      <input type="text" name="sku" value={formData.sku} onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.sourceUrl')}</label>
                    <input type="url" name="source_url" value={formData.source_url} onChange={handleChange}
                      placeholder="https://"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.similarIds')}</label>
                    <input type="text" name="similar_material_ids_input" value={formData.similar_material_ids_input}
                      onChange={handleChange}
                      placeholder={t('materialForm.similarIdsPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                  </div>
                </>
              )}
            </AccordionSection>

            {/* 2. Anwendung */}
            <AccordionSection
              icon={Wrench}
              title="Anwendung & Einsatz"
              color="#7c3aed"
              filled={!!(formData.description || formData.use_where || formData.use_limitations)}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.description')}</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('materialForm.applicationArea')}</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="checkbox" checked={formData.use_indoor} onChange={e => setFormData(prev=>({...prev, use_indoor: e.target.checked}))} className="w-4 h-4 text-primary-500 rounded" />
                    {t('materialForm.indoor')}
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="checkbox" checked={formData.use_outdoor} onChange={e => setFormData(prev=>({...prev, use_outdoor: e.target.checked}))} className="w-4 h-4 text-primary-500 rounded" />
                    {t('materialForm.outdoor')}
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.suitableFor')}</label>
                <textarea name="use_where" value={formData.use_where} onChange={e => setFormData(prev=>({...prev, use_where: e.target.value}))} rows={2}
                  placeholder={t('materialForm.suitableForPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.notSuitable')}</label>
                <textarea name="use_not_suitable" value={formData.use_not_suitable} onChange={e => setFormData(prev=>({...prev, use_not_suitable: e.target.value}))} rows={2}
                  placeholder={t('materialForm.notSuitablePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.limitations')}</label>
                <textarea name="use_limitations" value={formData.use_limitations} onChange={handleChange} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.processing') || 'Verarbeitung'}</label>
                <input type="text" name="use_processing" value={formData.use_processing} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              </div>
            </AccordionSection>

            {/* 3. Technische Daten */}
            <AccordionSection
              icon={FlaskConical}
              title={t('materialForm.sectionTech')}
              color="#0891b2"
              filled={!!(formData.tech_thicknesses || formData.tech_density || formData.tech_flammability)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { name: 'tech_thicknesses', label: t('materialForm.techThicknesses'), placeholder: 'z. B. 10 / 20 / 40 mm' },
                  { name: 'tech_dimensions',  label: t('materialForm.techDimensions'),  placeholder: 'z. B. 1200 x 580 mm' },
                  { name: 'tech_density',     label: t('materialForm.techDensity'),     placeholder: 'z. B. 35 kg/m³' },
                  { name: 'tech_flammability',label: t('materialForm.techFlammability'),placeholder: 'z. B. B2 / EN 13501-1' },
                  { name: 'tech_acoustics',   label: t('materialForm.techAcoustics'),   placeholder: '' },
                  { name: 'tech_thermal_insulation', label: t('materialForm.techThermal'), placeholder: '' },
                  { name: 'tech_compressive_strength', label: t('materialForm.techCompressive'), placeholder: 'z.B. 30 N/mm²' },
                  { name: 'tech_tensile_strength',     label: t('materialForm.techTensile'),     placeholder: 'z.B. 500 N/mm²' },
                ].map(({ name, label, placeholder }) => (
                  <div key={name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input type="text" name={name} value={formData[name]} onChange={handleChange}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                ))}
              </div>
            </AccordionSection>

            {/* 4. Ökobilanz / EPD */}
            <AccordionSection
              icon={Leaf}
              title={t('materialForm.sectionEnv')}
              color="#16a34a"
              filled={!!(formData.gwp_value || formData.gwp_fossil || formData.adp_fossil)}
            >
              {/* Simple GWP entry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.gwpTotal')}</label>
                  <input type="number" step="0.01" name="gwp_value" value={formData.gwp_value} onChange={handleChange}
                    placeholder="z. B. 2.5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                  {(formData.gwp_fossil !== '' || formData.gwp_biogenic !== '' || formData.gwp_luluc !== '') && (
                    <p className="text-[11px] text-amber-600 mt-1">{t('materialForm.gwpCalcHint')}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.gwpUnit')}</label>
                  <select name="gwp_unit" value={formData.gwp_unit} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                    <option value="kg CO2e/kg">kg CO₂e/kg</option>
                    <option value="kg CO2e/m2">kg CO₂e/m²</option>
                    <option value="kg CO2e/m3">kg CO₂e/m³</option>
                    <option value="kg CO2e/unit">kg CO₂e/unit</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-5">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" name="recyclable" checked={formData.recyclable} onChange={handleChange} className="w-4 h-4 text-primary-600 border-gray-300 rounded" />
                  {t('materialForm.recyclable')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" name="biodegradable" checked={formData.biodegradable} onChange={handleChange} className="w-4 h-4 text-primary-600 border-gray-300 rounded" />
                  {t('materialForm.biodegradable')}
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.recyclateContent')} %</label>
                  <input type="number" step="0.1" name="recyclate_content" value={formData.recyclate_content} onChange={handleChange}
                    placeholder="0–100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.recyclingPercent')} %</label>
                  <input type="number" step="0.1" min="0" max="100" name="recycling_percentage" value={formData.recycling_percentage}
                    onChange={e => setFormData(prev=>({...prev, recycling_percentage: e.target.value}))}
                    placeholder={t('materialForm.recyclingPercentPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.vocClass')}</label>
                  <input type="text" name="voc_values" value={formData.voc_values}
                    onChange={e => setFormData(prev=>({...prev, voc_values: e.target.value}))}
                    placeholder="z.B. A+"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
              </div>

              {/* EPD detail */}
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('materialForm.sectionEpd')}</p>
                <p className="text-[11px] text-gray-400 mb-3">{t('materialForm.epdHint')}</p>
                {(() => {
                  const f = parseFloat(formData.gwp_fossil), b = parseFloat(formData.gwp_biogenic), l = parseFloat(formData.gwp_luluc);
                  const hasAny = formData.gwp_fossil !== '' || formData.gwp_biogenic !== '' || formData.gwp_luluc !== '';
                  const total = (isNaN(f)?0:f)+(isNaN(b)?0:b)+(isNaN(l)?0:l);
                  return hasAny ? (
                    <div className="mb-3 flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
                      <span className="font-semibold">GWP =</span>
                      <span className="font-mono font-bold">{total.toLocaleString('de-DE',{maximumFractionDigits:4})} kg CO₂e</span>
                      <span className="text-green-600">fossil {isNaN(f)?'–':f} + biogen {isNaN(b)?'–':b} + luluc {isNaN(l)?'–':l}</span>
                    </div>
                  ) : null;
                })()}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                      {t('materialForm.epdDeclaredUnit')}<InfoTooltip text={t('materialForm.epdTooltipDeclaredUnit')} />
                    </label>
                    <input type="text" name="declared_unit" value={formData.declared_unit} onChange={handleChange}
                      placeholder="z. B. 1 kg"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                      {t('materialForm.epdSystemBoundary')}<InfoTooltip text={t('materialForm.epdTooltipSystemBoundary')} />
                    </label>
                    <select name="lifecycle_scope" value={formData.lifecycle_scope} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm">
                      <option value="">{t('materialForm.epdBoundaryNone')}</option>
                      <option value="A1-A3">{t('materialForm.epdBoundaryA1A3')}</option>
                      <option value="A1-A5">{t('materialForm.epdBoundaryA1A5')}</option>
                      <option value="A1-D">{t('materialForm.epdBoundaryA1D')}</option>
                    </select>
                  </div>
                  {[
                    { name: 'gwp_fossil',        label: t('materialForm.epdGwpFossil'),    tip: 'epdTooltipGwpFossil',    ph: 'z. B. 2.4' },
                    { name: 'gwp_biogenic',       label: t('materialForm.epdGwpBiogenic'),  tip: 'epdTooltipGwpBiogenic',  ph: 'z. B. -0.1' },
                    { name: 'gwp_luluc',          label: t('materialForm.epdGwpLuluc'),     tip: 'epdTooltipGwpLuluc',     ph: 'z. B. 0.01' },
                    { name: 'adp_fossil',         label: t('materialForm.epdAdpFossil'),    tip: 'epdTooltipAdpFossil',    ph: 'z. B. 45' },
                    { name: 'adp_elements',       label: t('materialForm.epdAdpElements'),  tip: 'epdTooltipAdpElements',  ph: 'z. B. 0.00012' },
                    { name: 'water_consumption',  label: t('materialForm.epdWater'),        tip: 'epdTooltipWater',        ph: 'z. B. 0.003' },
                  ].map(({ name, label, tip, ph }) => (
                    <div key={name}>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                        {label}<InfoTooltip text={t(`materialForm.${tip}`)} />
                      </label>
                      <input type="number" step="any" name={name} value={formData[name]} onChange={handleChange}
                        placeholder={ph}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm" />
                    </div>
                  ))}
                </div>
              </div>
            </AccordionSection>

            {/* 5. Kreislauf & Zertifizierung */}
            <AccordionSection
              icon={Recycle}
              title={t('materialForm.sectionEcodesign')}
              color="#d97706"
              filled={!!((formData.principles_consistency||[]).length || (formData.principles_efficiency||[]).length || formData.cert_epd || formData.cert_cradle_to_cradle)}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.climateDesc')}</label>
                <textarea name="sust_climate_description" value={formData.sust_climate_description} onChange={handleChange} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.circularity')}</label>
                  <input type="text" name="circularity" value={formData.circularity} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.humanHealth')}</label>
                  <input type="text" name="human_health" value={formData.human_health} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.processing')}</label>
                <input type="text" name="processing_sustainability" value={formData.processing_sustainability} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              {[
                { key: 'principles_consistency', label: t('materialForm.ecoConsistency'), opts: PRINCIPLES.consistency },
                { key: 'principles_efficiency',  label: t('materialForm.ecoEfficiency'),  opts: PRINCIPLES.efficiency },
              ].map(({ key, label, opts }) => (
                <div key={key}>
                  <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {opts.map(p => (
                      <button key={p} type="button"
                        onClick={() => setFormData(prev => ({ ...prev, [key]: toggleInArray(prev[key], p) }))}
                        className={`px-3 py-1 rounded-full text-xs border transition-all ${(formData[key]||[]).includes(p) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-300 hover:border-amber-300'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">{t('materialForm.sectionCerts')}</p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'cert_epd', label: t('materialForm.certEpd') },
                    { key: 'cert_cradle_to_cradle', label: 'Cradle-to-Cradle' },
                    { key: 'cert_fsc_pefc', label: 'FSC / PEFC' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                      <input type="checkbox" checked={formData[key]} onChange={e => setFormData(prev=>({...prev, [key]: e.target.checked}))} className="w-4 h-4 text-primary-500 rounded" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </AccordionSection>

            {/* 6. Standort */}
            <AccordionSection
              icon={MapPin}
              title={t('materialForm.sectionLocation')}
              color="#0891b2"
              filled={!!(formData.location_name || formData.latitude)}
            >
              <LocationPicker
                value={{
                  location_name: formData.location_name,
                  address: formData.address,
                  latitude: formData.latitude,
                  longitude: formData.longitude,
                }}
                onChange={(loc) => setFormData(prev => ({
                  ...prev,
                  location_name: loc.location_name || '',
                  address: loc.address || '',
                  latitude: loc.latitude ?? '',
                  longitude: loc.longitude ?? '',
                }))}
              />
            </AccordionSection>

            {/* 7. Akteure & Weitere Infos */}
            <AccordionSection
              icon={Info}
              title="Akteure & weitere Infos"
              color="#6b7280"
              filled={!!(actorIds.filter(Boolean).length || formData.env_links_input || formData.notes)}
            >
              {/* Actors */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{t('materialForm.sectionActors')}</p>
                <div className="space-y-2">
                  {actorIds.map((actorId, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select value={actorId}
                        onChange={(e) => { const next=[...actorIds]; next[idx]=e.target.value; setActorIds(next); }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm">
                        <option value="">{t('materialForm.actorChoose')}</option>
                        {allActors.map(a => (
                          <option key={a.id} value={a.id}>{a.name}{a.type ? ` (${a.type})` : ''}</option>
                        ))}
                      </select>
                      {actorIds.length > 1 && (
                        <button type="button" onClick={() => setActorIds(actorIds.filter((_,i)=>i!==idx))}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setActorIds([...actorIds,''])}
                    className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium">
                    <Plus className="w-4 h-4" /> {t('materialForm.actorAdd')}
                  </button>
                </div>
              </div>
              {/* Env links, notes, appendix */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.envLinks')}</label>
                <textarea name="env_links_input" value={formData.env_links_input} onChange={handleChange} rows={2}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.notesLabel')}</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.appendix')}</label>
                <textarea name="appendix" value={formData.appendix} onChange={handleChange} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
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
                label={t('materialForm.filesLabel')}
              />
            </AccordionSection>

          </div> {/* end accordion */}

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
                  <div className="text-sm font-bold text-primary-900">{t('materialForm.offerToggleTitle')}</div>
                  <div className="text-xs text-primary-700 mt-0.5">{t('materialForm.offerToggleHint')}</div>
                </div>
              </label>

              {createOffer ? (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.qtyRequired')}</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.unitRequired')}</label>
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
                      <MapPin className="w-4 h-4 inline mr-1" /> {t('materialForm.locationName')}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.address')}</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.latitude')}</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('materialForm.longitude')}</label>
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
                      <span className="text-sm text-gray-700">{t('materialForm.visible')}</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="available_for_transfer"
                        checked={offerData.available_for_transfer}
                        onChange={handleOfferChange}
                        className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{t('materialForm.transfer')}</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="available_for_gift"
                        checked={offerData.available_for_gift}
                        onChange={handleOfferChange}
                        className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{t('materialForm.gift')}</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
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
                {t('materialForm.manufacturer')}
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
            <h3 className="text-sm font-medium text-gray-900 mb-3">{t('materialForm.sectionEnv')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('materialForm.gwpTotal')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="gwp_value"
                  value={formData.gwp_value}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="z. B. 2.5"
                />
                {(formData.gwp_fossil !== '' || formData.gwp_biogenic !== '' || formData.gwp_luluc !== '') && (
                  <p className="text-[11px] text-amber-600 mt-1">{t('materialForm.gwpCalcHint')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('materialForm.gwpUnit')}
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
                <span className="text-sm text-gray-700">{t('materialForm.recyclable')}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="biodegradable"
                  checked={formData.biodegradable}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">{t('materialForm.biodegradable')}</span>
              </label>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-1">{t('materialForm.sectionEpd')}</h3>
            <p className="text-xs text-gray-400 mb-3">{t('materialForm.epdHint')}</p>
            {(() => {
              const f = parseFloat(formData.gwp_fossil);
              const b = parseFloat(formData.gwp_biogenic);
              const l = parseFloat(formData.gwp_luluc);
              const hasAny = formData.gwp_fossil !== '' || formData.gwp_biogenic !== '' || formData.gwp_luluc !== '';
              const total = (isNaN(f) ? 0 : f) + (isNaN(b) ? 0 : b) + (isNaN(l) ? 0 : l);
              return hasAny ? (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
                  <span className="font-semibold">GWP total =</span>
                  <span className="font-mono font-bold">{total.toLocaleString('de-DE', { maximumFractionDigits: 4 })} kg CO₂e</span>
                  <span className="text-green-600">(fossil {isNaN(f)?'–':f} + biogen {isNaN(b)?'–':b} + luluc {isNaN(l)?'–':l}) → wird als GWP-Wert gespeichert</span>
                </div>
              ) : null;
            })()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                  {t('materialForm.epdDeclaredUnit')}
                  <InfoTooltip text={t('materialForm.epdTooltipDeclaredUnit')} />
                </label>
                <input
                  type="text"
                  name="declared_unit"
                  value={formData.declared_unit}
                  onChange={handleChange}
                  placeholder="z. B. 1 kg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                  {t('materialForm.epdSystemBoundary')}
                  <InfoTooltip text={t('materialForm.epdTooltipSystemBoundary')} />
                </label>
                <select
                  name="lifecycle_scope"
                  value={formData.lifecycle_scope}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                >
                  <option value="">{t('materialForm.epdBoundaryNone')}</option>
                  <option value="A1-A3">{t('materialForm.epdBoundaryA1A3')}</option>
                  <option value="A1-A5">{t('materialForm.epdBoundaryA1A5')}</option>
                  <option value="A1-D">{t('materialForm.epdBoundaryA1D')}</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                  {t('materialForm.epdGwpFossil')}
                  <InfoTooltip text={t('materialForm.epdTooltipGwpFossil')} />
                </label>
                <input
                  type="number"
                  step="any"
                  name="gwp_fossil"
                  value={formData.gwp_fossil}
                  onChange={handleChange}
                  placeholder="z. B. 2.4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                  {t('materialForm.epdGwpBiogenic')}
                  <InfoTooltip text={t('materialForm.epdTooltipGwpBiogenic')} />
                </label>
                <input
                  type="number"
                  step="any"
                  name="gwp_biogenic"
                  value={formData.gwp_biogenic}
                  onChange={handleChange}
                  placeholder="z. B. -0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                  {t('materialForm.epdGwpLuluc')}
                  <InfoTooltip text={t('materialForm.epdTooltipGwpLuluc')} />
                </label>
                <input
                  type="number"
                  step="any"
                  name="gwp_luluc"
                  value={formData.gwp_luluc}
                  onChange={handleChange}
                  placeholder="z. B. 0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                  {t('materialForm.epdAdpFossil')}
                  <InfoTooltip text={t('materialForm.epdTooltipAdpFossil')} />
                </label>
                <input
                  type="number"
                  step="any"
                  name="adp_fossil"
                  value={formData.adp_fossil}
                  onChange={handleChange}
                  placeholder="z. B. 45"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                  {t('materialForm.epdAdpElements')}
                  <InfoTooltip text={t('materialForm.epdTooltipAdpElements')} />
                </label>
                <input
                  type="number"
                  step="any"
                  name="adp_elements"
                  value={formData.adp_elements}
                  onChange={handleChange}
                  placeholder="z. B. 0.00012"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                  {t('materialForm.epdWater')}
                  <InfoTooltip text={t('materialForm.epdTooltipWater')} />
                </label>
                <input
                  type="number"
                  step="any"
                  name="water_consumption"
                  value={formData.water_consumption}
                  onChange={handleChange}
                  placeholder="z. B. 0.003"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('materialForm.sourceUrl')}
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
              {t('materialForm.notesLabel')}
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
            />
          </div>


          {/* Images */}
          {/* Pending preview — shown before material is saved */}
          {pendingImages.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-700">{t('materialForm.imagesPendingTitle')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pendingImages.map((file, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border-2 border-dashed border-primary-300 bg-primary-50">
                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-28 object-cover opacity-80" />
                    <span className="absolute top-1 left-1 bg-primary-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                      {i === 0 ? 'Cover' : t('materialForm.imagePicLabel', { n: i + 1 })}
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
                {t('materialForm.imagesAutoUpload')}
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
            onSetCredit={async (imageId, credit) => {
              const id = material?.id || savedId;
              if (!id) return;
              const { materialImageService } = await import('../../services/materialService');
              const updated = await materialImageService.updateMeta(id, imageId, { credit });
              if (Array.isArray(updated)) setLocalImages(updated);
            }}
            apiBase={API_BASE}
            showSteps={true}
            label={pendingImages.length > 0 ? t('materialForm.imagesLabelMore') : t('materialForm.imagesLabel')}
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
            label={t('materialForm.filesLabel')}
          />

          {savedId && !material && (
            <p className="text-xs text-primary-700 bg-primary-50 px-3 py-2 rounded-lg">
              {t('materialForm.savedNotice')}
            </p>
          )}
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              {savedId && !material ? t('materialForm.btnClose') : t('materialForm.btnCancel')}
            </button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50">
              {isPending
                ? t('materialForm.btnSaving')
                : material
                  ? t('materialForm.btnSave')
                  : mode === 'offer-only'
                    ? t('materialForm.btnCreateOffer')
                    : t('materialForm.btnCreate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
