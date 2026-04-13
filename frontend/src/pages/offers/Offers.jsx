import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Warehouse, Plus, Search, MapPin, Package, ArrowRight, X,
  CheckCircle2, XCircle, Info, Truck, Users, Leaf,
} from 'lucide-react';
import clsx from 'clsx';
import { inventoryService } from '../../services/inventoryService';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import InventoryForm from '../../components/inventory/InventoryForm';
import InventoryDetailModal from '../../components/inventory/InventoryDetailModal';
import RzzDecoration from '../../components/ui/RzzDecoration';
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

const ALLOWED_MATERIALS = [
  'Holz, Holzreste, Platten (unbehandelt oder naturbelassen)',
  'Metall: Stahl, Aluminium, Kupfer, Messing (sortenrein oder gemischt)',
  'Baustoffe: Ziegel, Beton, Naturstein',
  'Dämmstoffe: Mineralwolle, Zellulose, Hanf, Schafwolle',
  'Textilien & Fasern: Naturfasern, Wolle, Leinen',
  'Keramik & Glas (unverschmutzt)',
  'Biogene Materialien: Stroh, Hanf, Holzwolle',
  'Wiedergewonnene Bauteile: Fenster, Türen, Beschläge',
  'Elektronik-Bauteile (funktionsfähig oder als Einzelteile)',
  'Kunststoffe (sortenrein und sauber, z. B. PET, HDPE)',
];

const DISALLOWED_MATERIALS = [
  'Asbest, KMF (Künstliche Mineralfasern) – gesundheitsgefährdend',
  'Teer, Bitumen, Teerpappe mit polyzyklischen Kohlenwasserstoffen',
  'Mit Schadstoffen kontaminierter Boden oder Bauschutt',
  'Farben, Lacke, Lösungsmittel (nicht ausgehärtet)',
  'Schimmelbelastete Materialien',
  'Gefahrstoffe, radioaktive Materialien',
  'Abfälle ohne Verwertungspotenzial (Restmüll, Sperrmüll)',
  'Materialien unbekannter Herkunft und Zusammensetzung',
];

function AllowedOverlay({ onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-200 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-bold text-gray-900">Welche Materialien sind erlaubt?</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-6">
          <div className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <h3 className="font-semibold text-gray-900">Erlaubte Materialien</h3>
            </div>
            <ul className="space-y-2">
              {ALLOWED_MATERIALS.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <h3 className="font-semibold text-gray-900">Nicht erlaubte Materialien</h3>
            </div>
            <ul className="space-y-2">
              {DISALLOWED_MATERIALS.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>Hinweis:</strong> Jeder Anbieter ist für die korrekte Deklaration seines Materials selbst verantwortlich.
            Im Zweifelsfall bitte vor der Abgabe einen Materialfachmann zurate ziehen.
          </div>
        </div>
      </div>
    </div>
  );
}

function OfferCard({ item, onOpenDetail }) {
  const imageUrl = item.images?.[0]?.file_path
    ? `${API_BASE}${item.images[0].file_path.replace(/^\./, '')}`
    : null;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => onOpenDetail(item.id)}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={item.material_name} className="w-full h-44 object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-44 bg-gray-100 flex items-center justify-center">
          <Package className="w-10 h-10 text-gray-300" />
        </div>
      )}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
          {item.material_name || 'Materialangebot'}
        </h3>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {item.category && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{item.category}</span>
          )}
          {item.condition && (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
              {CONDITION_LABELS[item.condition] || item.condition}
            </span>
          )}
          {item.value_type && (
            <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">
              {VALUE_TYPE_LABELS[item.value_type] || item.value_type}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            {item.quantity ? `${item.quantity} ${item.unit || ''}`.trim() : '—'}
          </span>
          {(item.location_name || item.address) && (
            <span className="flex items-center gap-1 truncate ml-2">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{item.location_name || item.address}</span>
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-end">
          <span className="text-xs text-primary-600 font-medium group-hover:underline flex items-center gap-1">
            Details <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Offers() {
  const { isAuthenticated, token } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [showAllowedOverlay, setShowAllowedOverlay] = useState(false);

  const requireAuth = () => {
    if (isAuthenticated && token) return true;
    openAuth({
      tab: 'login',
      reason: 'Bitte logge dich ein, um ein Materialangebot einzustellen.',
      onSuccess: () => setShowForm(true),
    });
    return false;
  };

  const { data: offersData, isLoading } = useQuery({
    queryKey: ['offers-page', search],
    queryFn: () => inventoryService.getAvailable({ search: search || undefined }),
  });

  const offers = Array.isArray(offersData) ? offersData : offersData?.data || [];
  const filtered = search
    ? offers.filter(
        (o) =>
          (o.material_name || '').toLowerCase().includes(search.toLowerCase()) ||
          (o.location_name || '').toLowerCase().includes(search.toLowerCase()) ||
          (o.category || '').toLowerCase().includes(search.toLowerCase())
      )
    : offers;

  return (
    <div className="space-y-0">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-white border border-orange-100 mb-8">
        <RzzDecoration className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-8 w-56 sm:w-72 md:w-96 lg:w-[30rem] text-amber-400 opacity-[0.18]" />
        <div className="relative px-8 py-12 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 text-sm font-medium mb-4">
            <Warehouse className="w-4 h-4" />
            Materialangebote
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
            Du hast Material übrig?<br />
            <span className="text-orange-500">Teile es mit der Community.</span>
          </h1>
          <p className="text-lg text-gray-600 mb-3 max-w-xl">
            Wir lagern nichts zentral – Materialien bleiben beim Anbieter, bis sich ein neuer Nutzer gefunden hat.
            Erst dann wird der Transport koordiniert.
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-8">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-orange-500" />
              Peer-to-peer – direkt von Mensch zu Mensch
            </span>
            <span className="flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-orange-500" />
              Transport nur bei bestätigter Abnahme
            </span>
            <span className="flex items-center gap-1.5">
              <Leaf className="w-4 h-4 text-orange-500" />
              Kreislaufwirtschaft statt Abfall
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { if (!requireAuth()) return; setShowForm(true); }}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold text-base transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Angebot einstellen
            </button>
            <button
              onClick={() => setShowAllowedOverlay(true)}
              className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-5 py-3 rounded-xl font-medium text-base border border-gray-200 transition-colors"
            >
              <Info className="w-4 h-4 text-orange-500" />
              Was darf ich anbieten?
            </button>
          </div>
        </div>
      </div>

      {/* Search + list */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900">
            Aktuelle Angebote
            {!isLoading && (
              <span className="ml-2 text-sm font-normal text-gray-500">({filtered.length})</span>
            )}
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Material, Ort oder Kategorie…"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <Warehouse className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {search ? 'Keine Treffer für deine Suche' : 'Noch keine Angebote vorhanden'}
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              {search
                ? 'Versuche einen anderen Suchbegriff oder schau bald wieder vorbei.'
                : 'Sei die erste Person, die ein Material anbietet!'}
            </p>
            {!search && (
              <button
                onClick={() => { if (!requireAuth()) return; setShowForm(true); }}
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Erstes Angebot einstellen
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <OfferCard key={item.id} item={item} onOpenDetail={setDetailId} />
            ))}
          </div>
        )}
      </div>

      {showForm && <InventoryForm onClose={() => setShowForm(false)} />}
      {detailId && (
        <InventoryDetailModal
          inventoryId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
      {showAllowedOverlay && <AllowedOverlay onClose={() => setShowAllowedOverlay(false)} />}
    </div>
  );
}
