import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '../../services/inventoryService';
import { materialService } from '../../services/materialService';
import { X, MapPin, Plus, Trash2 } from 'lucide-react';
import ImageUploader from '../shared/ImageUploader';
import FileUploader from '../shared/FileUploader';
import GeolocateButton from '../shared/GeolocateButton';

import { MEDIA_BASE } from '../../services/api';
const API_BASE = MEDIA_BASE;

const VALUE_TYPE_OPTIONS = [
  { value: '', label: 'Gegenwert wählen…' },
  { value: 'swap', label: 'Tausch' },
  { value: 'free', label: 'Kostenlose Abgabe' },
  { value: 'loan', label: 'Entleihe' },
  { value: 'negotiable', label: 'Verhandlungsbasis' },
  { value: 'fixed', label: 'Fixer Preis' },
];

const TRANSACTION_OPTIONS = ['Verkauf', 'Vermietung', 'Leasing', 'Tausch', 'Kooperation'];
const LOGISTICS_OPTIONS = ['Selbstabholung', 'Lieferung möglich'];
const CONDITION_OPTIONS = [
  { value: '', label: 'Zustand wählen…' },
  { value: 'new', label: 'Neu' },
  { value: 'used', label: 'Gebraucht' },
  { value: 'damaged', label: 'Beschädigt' },
  { value: 'tested', label: 'Geprüft' },
];

const initialFormState = {
  material_id: '',
  quantity: '',
  unit: 'kg',
  location_name: '',
  address: '',
  latitude: '',
  longitude: '',
  is_available: true,
  availability_mode: 'negotiable',
  external_url: '',
  season_from: '',
  season_to: '',
  swap_possible: false,
  swap_against: '',
  available_for_transfer: false,
  available_for_gift: false,
  notes: '',
  // New fields
  min_order_quantity: '',
  available_from_date: '',
  is_immediately_available: true,
  is_regularly_available: false,
  regular_availability_period: '',
  regular_availability_type: '',
  is_mobile: false,
  contact_user_id: '',
  value_type: '',
  price: '',
  price_unit: '€',
  is_negotiable: false,
  transaction_options: [],
  logistics_options: [],
  transport_costs: '',
  condition: '',
};

function SectionTitle({ children }) {
  return <p className="text-sm font-semibold text-gray-800 mb-3 pt-2">{children}</p>;
}

function CheckboxGroup({ options, value = [], onChange }) {
  const toggle = (opt) => {
    const set = new Set(value);
    set.has(opt) ? set.delete(opt) : set.add(opt);
    onChange(Array.from(set));
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <label key={opt} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors
          ${value.includes(opt) ? 'bg-primary-50 border-primary-400 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} className="sr-only" />
          {opt}
        </label>
      ))}
    </div>
  );
}

export default function InventoryForm({ item, editingItem, onClose }) {
  const editItem = item || editingItem;
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState(null);
  const [localImages, setLocalImages] = useState([]);
  const [localFiles, setLocalFiles] = useState([]);

  const { data: materialsData } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materialService.getAll(),
  });

  useEffect(() => {
    if (editItem) {
      let txOpts = editItem.transaction_options;
      let logOpts = editItem.logistics_options;
      try { txOpts = txOpts ? JSON.parse(txOpts) : []; } catch { txOpts = []; }
      try { logOpts = logOpts ? JSON.parse(logOpts) : []; } catch { logOpts = []; }
      setFormData({
        material_id: editItem.material_id || '',
        quantity: editItem.quantity || '',
        unit: editItem.unit || 'kg',
        location_name: editItem.location_name || '',
        address: editItem.address || '',
        latitude: editItem.latitude || '',
        longitude: editItem.longitude || '',
        is_available: editItem.is_available ?? true,
        availability_mode: editItem.availability_mode || 'negotiable',
        external_url: editItem.external_url || '',
        season_from: editItem.season_from || '',
        season_to: editItem.season_to || '',
        swap_possible: Boolean(editItem.swap_possible),
        swap_against: editItem.swap_against || '',
        available_for_transfer: Boolean(editItem.available_for_transfer),
        available_for_gift: Boolean(editItem.available_for_gift),
        notes: editItem.notes || '',
        min_order_quantity: editItem.min_order_quantity || '',
        available_from_date: editItem.available_from_date || '',
        is_immediately_available: editItem.is_immediately_available ?? true,
        is_regularly_available: Boolean(editItem.is_regularly_available),
        regular_availability_period: editItem.regular_availability_period || '',
        regular_availability_type: editItem.regular_availability_type || '',
        is_mobile: Boolean(editItem.is_mobile),
        contact_user_id: editItem.contact_user_id || '',
        value_type: editItem.value_type || '',
        price: editItem.price || '',
        price_unit: editItem.price_unit || '€',
        is_negotiable: Boolean(editItem.is_negotiable),
        transaction_options: txOpts,
        logistics_options: logOpts,
        transport_costs: editItem.transport_costs || '',
        condition: editItem.condition || '',
      });
      setLocalImages(editItem.images || []);
      setLocalFiles(editItem.files || []);
      if (editItem.id) setSavedId(editItem.id);
    }
  }, [editItem]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['my-inventory'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['marketplace-inventory'], exact: false });
  };

  const createMutation = useMutation({
    mutationFn: inventoryService.create,
    onSuccess: (data) => { setSavedId(data.id); invalidate(); },
    onError: (err) => setError(err.response?.data?.error || 'Fehler beim Erstellen'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => inventoryService.update(id, data),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (err) => setError(err.response?.data?.error || 'Fehler beim Aktualisieren'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const submitData = {
      ...formData,
      quantity: parseFloat(formData.quantity),
      min_order_quantity: formData.min_order_quantity ? parseFloat(formData.min_order_quantity) : null,
      price: formData.price ? parseFloat(formData.price) : null,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
    };
    if (editItem?.id || savedId) {
      updateMutation.mutate({ id: editItem?.id || savedId, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleImageUpload = async (files, options) => {
    const id = editItem?.id || savedId;
    if (!id) { setError('Bitte zuerst speichern, dann Bilder hinzufügen'); return; }
    const result = await inventoryService.uploadImages(id, files, options);
    setLocalImages(prev => [...prev, ...(Array.isArray(result) ? result : [result])]);
  };

  const handleImageDelete = async (imageId) => {
    const id = editItem?.id || savedId;
    if (!id) return;
    await inventoryService.deleteImage(id, imageId);
    setLocalImages(prev => prev.filter(i => i.id !== imageId));
  };

  const handleFileUpload = async (files) => {
    const id = editItem?.id || savedId;
    if (!id) { setError('Bitte zuerst speichern, dann Dateien hinzufügen'); return; }
    const result = await inventoryService.uploadFiles(id, files);
    setLocalFiles(prev => [...prev, ...(Array.isArray(result) ? result : [result])]);
  };

  const handleFileDelete = async (fileId) => {
    const id = editItem?.id || savedId;
    if (!id) return;
    await inventoryService.deleteFile(id, fileId);
    setLocalFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const materials = materialsData?.data || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">
            {editItem ? 'Materialangebot bearbeiten' : 'Neues Materialangebot'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          {/* Material */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Material *</label>
            <select name="material_id" value={formData.material_id} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required>
              <option value="">Material wählen</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Menge *</label>
              <input type="number" step="0.01" name="quantity" value={formData.quantity} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Einheit *</label>
              <select name="unit" value={formData.unit} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required>
                {['kg','g','lb','m','m2','m3','unit','piece','Stück','Liter'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Condition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zustand</label>
            <select name="condition" value={formData.condition} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
              {CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Location */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <SectionTitle>📍 Standort</SectionTitle>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ortsname</label>
              <input type="text" name="location_name" value={formData.location_name} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="z.B. Lager A" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input type="text" name="address" value={formData.address} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <GeolocateButton
                onLocate={(lat, lon) => setFormData(f => ({ ...f, latitude: lat, longitude: lon }))}
                className="mb-2"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Breitengrad</label>
                  <input type="number" step="0.000001" name="latitude" value={formData.latitude} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="z.B. 51.05" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Längengrad</label>
                  <input type="number" step="0.000001" name="longitude" value={formData.longitude} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="z.B. 12.13" />
                </div>
              </div>
            </div>
          </div>

          {/* Availability */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <SectionTitle>📅 Verfügbarkeit</SectionTitle>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="is_available" checked={formData.is_available} onChange={handleChange} className="w-4 h-4 text-primary-500 rounded" />
              <span className="text-sm text-gray-700">Verfügbar (global)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="is_immediately_available" checked={formData.is_immediately_available} onChange={handleChange} className="w-4 h-4 text-primary-500 rounded" />
              <span className="text-sm text-gray-700">Sofort verfügbar</span>
            </label>

            {!formData.is_immediately_available && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Verfügbar ab Datum</label>
                <input type="date" name="available_from_date" value={formData.available_from_date} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mindestabnahmemenge</label>
              <input type="number" step="0.01" name="min_order_quantity" value={formData.min_order_quantity} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="optional" />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="is_regularly_available" checked={formData.is_regularly_available} onChange={handleChange} className="w-4 h-4 text-primary-500 rounded" />
              <span className="text-sm text-gray-700">Regelmäßig verfügbar</span>
            </label>
            {formData.is_regularly_available && (
              <div className="pl-6 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Zeitraum</label>
                  <input type="text" name="regular_availability_period" value={formData.regular_availability_period} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="z.B. Quartal 1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Intervall</label>
                  <select name="regular_availability_type" value={formData.regular_availability_type} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                    <option value="">Wählen…</option>
                    <option value="monthly">Monatlich</option>
                    <option value="yearly">Jährlich</option>
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Saison von</label>
                <input type="text" name="season_from" value={formData.season_from} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="MM-TT" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Saison bis</label>
                <input type="text" name="season_to" value={formData.season_to} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="MM-TT" />
              </div>
            </div>
          </div>

          {/* Pricing & Value */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <SectionTitle>💰 Preis & Gegenwert</SectionTitle>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gegenwert</label>
              <select name="value_type" value={formData.value_type} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                {VALUE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {formData.value_type === 'fixed' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Preis</label>
                  <input type="number" step="0.01" name="price" value={formData.price} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Preiseinheit</label>
                  <input type="text" name="price_unit" value={formData.price_unit} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="€" />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="is_negotiable" checked={formData.is_negotiable} onChange={handleChange} className="w-4 h-4 text-primary-500 rounded" />
              <span className="text-sm text-gray-700">Verhandelbar</span>
            </label>
          </div>

          {/* Transactions & Logistics */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <SectionTitle>🔄 Transaktionsoptionen</SectionTitle>
            <CheckboxGroup options={TRANSACTION_OPTIONS} value={formData.transaction_options}
              onChange={v => setFormData(f => ({ ...f, transaction_options: v }))} />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <SectionTitle>🚚 Logistik</SectionTitle>
            <CheckboxGroup options={LOGISTICS_OPTIONS} value={formData.logistics_options}
              onChange={v => setFormData(f => ({ ...f, logistics_options: v }))} />
            {formData.logistics_options.includes('Lieferung möglich') && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Transportkosten</label>
                <input type="text" name="transport_costs" value={formData.transport_costs} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="z.B. nach Vereinbarung" />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="is_mobile" checked={formData.is_mobile} onChange={handleChange} className="w-4 h-4 text-primary-500 rounded" />
              <span className="text-sm text-gray-700">Mobil / transportfähig</span>
            </label>
          </div>

          {/* Availability mode */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <SectionTitle>📋 Verfügbarkeitsart</SectionTitle>
            <div className="space-y-2">
              {[
                { value: 'negotiable', label: 'Über diese Plattform verhandelbar' },
                { value: 'external', label: 'Über externe Webseite' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="availability_mode" value={opt.value} checked={formData.availability_mode === opt.value} onChange={handleChange} className="w-4 h-4 text-primary-500" />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
              {formData.availability_mode === 'external' && (
                <input type="url" name="external_url" value={formData.external_url} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none ml-6"
                  placeholder="https://…" required />
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="swap_possible" checked={formData.swap_possible} onChange={handleChange} className="w-4 h-4 text-primary-500 rounded" />
              <span className="text-sm text-gray-700">Tausch möglich</span>
            </label>
            {formData.swap_possible && (
              <input type="text" name="swap_against" value={formData.swap_against} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none ml-6"
                placeholder="Tausch gegen …" />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
          </div>

          {/* Images */}
          <ImageUploader
            images={localImages}
            onUpload={handleImageUpload}
            onDelete={handleImageDelete}
            apiBase={API_BASE}
            showSteps={true}
            label="Bilder (erstes = Cover)"
          />

          {/* Files */}
          <FileUploader
            files={localFiles}
            onUpload={handleFileUpload}
            onDelete={handleFileDelete}
            apiBase={API_BASE}
            label="Fertigungsdaten & Dateien"
          />

          {savedId && !editItem?.id && (
            <p className="text-xs text-primary-700 bg-primary-50 px-3 py-2 rounded-lg">
              ✓ Angebot gespeichert – du kannst jetzt Bilder und Dateien hinzufügen.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Abbrechen
            </button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50">
              {isPending ? 'Speichern…' : editItem ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
