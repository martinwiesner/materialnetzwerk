import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// (Auth navigation is handled via overlay; no route redirect needed)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materialService } from '../../services/materialService';
import { inventoryService } from '../../services/inventoryService';
import { Plus, Search, Edit2, Trash2, Leaf, MapPinned, List, MapPin, Package2, FlaskConical, Recycle, Database, Tag, Info, X, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '../../store/toastStore';
import MaterialForm from '../../components/materials/MaterialForm';
import clsx from 'clsx';
import GeoMap from '../../components/maps/GeoMap';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import RzzDecoration from '../../components/ui/RzzDecoration';
import { MEDIA_BASE } from '../../services/api';

function getMaterialImage(material) {
  // 1. Real DB image takes priority
  const first = material?.images?.[0];
  if (first?.file_path) {
    const base = (MEDIA_BASE || '').replace(/\/$/, '');
    const p = first.file_path.replace(/^\./, '');
    return `${base}${p.startsWith('/') ? p : '/' + p}`;
  }
  // 2. Static name-based fallback
  const name = (material?.name || '').toLowerCase();
  if (name.includes('weizenspreu') && name.includes('los')) return '/assets/materials/weizenspreu-lose.png';
  if (name.includes('rundst') || name.includes('rundstäb') || name.includes('rundstaeb')) return '/assets/materials/rundstab.jpg';
  return null;
}

function formatApproxQty(qty, unit) {
  if (qty === null || qty === undefined) return null;
  const n = Number(qty);
  if (Number.isNaN(n)) return null;
  const rounded = n >= 10 ? Math.round(n) : Math.round(n * 100) / 100;
  return `~${rounded} ${unit || ''}`.trim();
}

export default function Materials() {
  const navigate = useNavigate();
  const { isAuthenticated, token, user } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);

  const requireAuth = () => {
    if (isAuthenticated && token) return true;
    openAuth({
      tab: 'login',
      reason: 'Bitte logge dich ein, um Materialien anzulegen oder zu bearbeiten.',
      onSuccess: () => {
        // re-open the form after successful login
        setShowForm(true);
      },
    });
    return false;
  };

  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [filterAvailable, setFilterAvailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [showGuide, setShowGuide] = useState(false);

  const { data: materialsData, isLoading } = useQuery({
    queryKey: ['materials', { search, category }],
    queryFn: () => materialService.getAll({ search, category }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['material-categories'],
    queryFn: materialService.getCategories,
  });

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryService.getAll(),
    enabled: Boolean(isAuthenticated && token),
  });

  const toast = useToast();

  const deleteMutation = useMutation({
    mutationFn: materialService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast.success('Material gelöscht.');
    },
    onError: () => toast.error('Löschen fehlgeschlagen.'),
  });

  const handleDelete = (id) => {
    if (!requireAuth()) return;
    if (window.confirm('Material wirklich löschen?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (material) => {
    if (!requireAuth()) return;
    setEditingMaterial(material);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingMaterial(null);
  };

  const allMaterials = materialsData?.data || [];
  const categories = categoriesData?.data || [];
  const inventory = inventoryData?.data || inventoryData || [];

  // Aggregate inventory so each material card can show an approximate available amount
  const inventoryByMaterial = (inventory || []).reduce((acc, item) => {
    const matId = item.material_id || item.materialId;
    if (!matId) return acc;
    const qty = Number(item.quantity || 0);
    if (!acc[matId]) {
      acc[matId] = {
        quantity: 0,
        unit: item.unit || item.material_unit || '',
        location_name: item.location_name || '',
        address: item.address || '',
      };
    }
    acc[matId].quantity += Number.isNaN(qty) ? 0 : qty;
    // If unit differs between entries, we keep the first one (can be improved later)
    return acc;
  }, {});

  const materials = filterAvailable
    ? allMaterials.filter(m => Boolean(inventoryByMaterial[m.id]?.quantity))
    : allMaterials;

  const mapPoints = (inventory || [])
    .filter((i) => i?.latitude && i?.longitude)
    .map((i) => ({
      id: i.id,
      type: 'material',
      title: i.material_name || 'Material',
      subtitle: `${i.quantity} ${i.unit || i.material_unit || ''}`.trim() + (i.location_name ? ` • ${i.location_name}` : ''),
      latitude: Number(i.latitude),
      longitude: Number(i.longitude),
      address: i.address || '',
    }));

  return (
    <div>
      {/* Dos & Don'ts Guide Overlay */}
      {showGuide && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGuide(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-primary-700 rounded-t-2xl">
              <div className="flex items-center gap-2 text-white">
                <Info className="w-5 h-5" />
                <h2 className="text-lg font-bold">Was darf eingetragen werden?</h2>
              </div>
              <button onClick={() => setShowGuide(false)} className="p-1.5 text-white/70 hover:text-white rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-6">
              <p className="text-sm text-gray-600">
                Die Materialbibliothek dokumentiert <strong>Sekundärmaterialien und Reststoffe</strong> aus der Kreislaufwirtschaft.
                Nicht alle Materialien sind geeignet — hier ein Überblick.
              </p>

              {/* Dos */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-project-600 flex-shrink-0" />
                  <h3 className="font-semibold text-gray-900">Erlaubt & erwünscht</h3>
                </div>
                <ul className="space-y-2">
                  {[
                    'Sekundärrohstoffe und Reststoffe aus Produktion oder Abbruch',
                    'Urban-Mining-Materialien (z. B. zurückgewonnene Metalle, Holz, Mineralien)',
                    'Naturmaterialien und nachwachsende Rohstoffe (Stroh, Hanf, Holz, Lehm)',
                    'Recyclingmaterialien mit dokumentiertem Ursprung',
                    'Experimentelle oder seltene Werkstoffe mit ökologischem Potenzial',
                    'Materialien mit Herkunftsangabe, Menge und möglichen Verwendungen',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-project-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Don'ts */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="w-5 h-5 text-actor-600 flex-shrink-0" />
                  <h3 className="font-semibold text-gray-900">Nicht erlaubt</h3>
                </div>
                <ul className="space-y-2">
                  {[
                    'Gefährliche Abfälle, Sondermüll oder schadstoffbelastete Materialien (z. B. Asbest, PCB)',
                    'Materialien ohne nachvollziehbare Herkunft oder unklare Zusammensetzung',
                    'Konventionelle Neuware ohne Sekundäranteil oder ökologische Relevanz',
                    'Privatverkäufe oder kommerzielle Produktangebote (dafür gibt es den Marketplace)',
                    'Materialien, die gesetzlichen Entsorgungsvorschriften unterliegen',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-actor-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Hinweis */}
              <div className="flex items-start gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-primary-800">
                  Bei Unklarheiten ob ein Material geeignet ist, bitte vor dem Eintragen kurz Kontakt aufnehmen.
                  Einträge, die nicht den Richtlinien entsprechen, werden ohne Ankündigung entfernt.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowGuide(false)}
                className="px-5 py-2 text-sm font-semibold bg-primary-700 hover:bg-primary-800 text-white rounded-xl transition-colors"
              >
                Verstanden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 mb-8">
        <RzzDecoration className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-8 w-56 sm:w-72 md:w-96 lg:w-[30rem] text-white opacity-[0.13]" />
        <div className="relative px-8 py-12 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 text-white text-sm font-medium mb-4">
            <FlaskConical className="w-4 h-4" />
            Materialbibliothek
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white mb-4 leading-tight">
            Materialien für die Kreislaufwirtschaft.<br />
            <span className="text-primary-100">Erfasse Materialien und stelle sie bereit.</span>
          </h1>
          <p className="text-lg text-white/80 mb-3 max-w-xl">
            Für Materialforschende, Urban Miner und alle, die Sekundärmaterialien zugänglich machen wollen:
            Lege Materialien mit Herkunft und Eigenschaften an und mache sie für die Community verfügbar.
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-white/70 mb-8">
            <span className="flex items-center gap-1.5">
              <FlaskConical className="w-4 h-4" />
              GWP-Werte & Ökobilanzdaten
            </span>
            <span className="flex items-center gap-1.5">
              <Database className="w-4 h-4" />
              Offene Materialdatenbank
            </span>
            <span className="flex items-center gap-1.5">
              <Recycle className="w-4 h-4" />
              Urban Mining & Sekundärmaterialien
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { if (!requireAuth()) return; setShowForm(true); }}
              className="inline-flex items-center gap-2 bg-white text-primary-700 hover:bg-primary-50 px-6 py-3 rounded-xl font-semibold text-base transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Material dokumentieren
            </button>
            <button
              onClick={() => setShowGuide(true)}
              className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white px-5 py-3 rounded-xl font-medium text-base transition-colors"
            >
              <Info className="w-5 h-5" />
              Was ist erlaubt?
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Materialien</h2>
          <p className="text-gray-600">Nachhaltige Materialbibliothek</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'px-3 py-2 text-sm font-medium inline-flex items-center gap-2',
                viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
              )}
              title="List"
            >
              <List className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={clsx(
                'px-3 py-2 text-sm font-medium inline-flex items-center gap-2',
                viewMode === 'map' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
              )}
              title="Map"
            >
              <MapPinned className="w-4 h-4" />
              Map
            </button>
          </div>

          <button
            onClick={() => {
              if (!requireAuth()) return;
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Material
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search materials..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            onClick={() => setFilterAvailable(v => !v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              filterAvailable ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-orange-300 text-orange-600 hover:bg-orange-50'
            }`}
          >
            Nur verfügbare
          </button>
        </div>
      </div>

      {/* Map */}
      {viewMode === 'map' ? (
        inventoryLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : mapPoints.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No mapped inventory yet</h3>
            <p className="text-gray-600">Add inventory entries with a location to see them on the map.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
            <div className="h-[520px]">
              <GeoMap points={mapPoints} className="h-full" />
            </div>
          </div>
        )
      ) : isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : materials.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No materials found</h3>
          <p className="text-gray-600 mb-4">Get started by adding your first material</p>
          <button
            onClick={() => {
              if (!requireAuth()) return;
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Material
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((material) => (
            <div
              key={material.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/materials/${material.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') navigate(`/materials/${material.id}`);
              }}
            >
              {/* Image */}
              <div className="relative">
                {getMaterialImage(material) ? (
                  <img
                    src={getMaterialImage(material)}
                    alt={material.name}
                    className="w-full h-44 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-44 bg-gray-100 flex items-center justify-center">
                    <Package2 className="w-10 h-10 text-gray-300" />
                  </div>
                )}

                {/* Top meta row */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-gray-200 text-sm text-gray-700 shadow-sm">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">
                      {inventoryByMaterial[material.id]?.location_name || '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {inventoryByMaterial[material.id]?.quantity > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/90 text-white text-xs font-medium shadow-sm">
                        <Tag className="w-3.5 h-3.5" />
                        verfügbar
                      </div>
                    )}
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-gray-200 text-sm text-gray-700 shadow-sm">
                      <Package2 className="w-4 h-4" />
                      <span>
                        {formatApproxQty(inventoryByMaterial[material.id]?.quantity, inventoryByMaterial[material.id]?.unit) || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{material.name}</h3>
                    <span className="inline-block px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full mt-1">
                      {material.category}
                    </span>
                  </div>

                  {(isAuthenticated && (material.created_by === user?.id || user?.is_admin)) && (
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(material);
                        }}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(material.id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {material.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {material.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {material.gwp_value !== null && material.gwp_value !== undefined && (
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-500 block text-xs">GWP</span>
                      <span className="font-medium text-gray-900">
                        {material.gwp_value} {material.gwp_unit || 'kg CO₂e'}
                      </span>
                    </div>
                  )}
                  {material.unit && (
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-500 block text-xs">Unit</span>
                      <span className="font-medium text-gray-900 truncate block">
                        {material.unit}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Material Form Modal */}
      {showForm && (
        <MaterialForm
          material={editingMaterial}
          onClose={handleFormClose}
          enableOfferOnCreate={true}
        />
      )}
    </div>
  );
}
