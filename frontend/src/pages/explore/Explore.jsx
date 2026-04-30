import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Network, Package, Store, FolderOpen, X, Map as MapIcon, LayoutList, Users } from 'lucide-react';
import clsx from 'clsx';

import { materialService } from '../../services/materialService';
import { inventoryService } from '../../services/inventoryService';
import { projectService } from '../../services/projectService';
import { actorService } from '../../services/actorService';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';

import ExploreMap from '../../components/maps/ExploreMap';
import EntityCard from '../../components/explore/EntityCard';
import MaterialForm from '../../components/materials/MaterialForm';
import InventoryForm from '../../components/inventory/InventoryForm';
import ProjectForm from '../../components/projects/ProjectForm';
import InventoryDetailModal from '../../components/inventory/InventoryDetailModal';
import MaterialRequestModal from '../../components/requests/MaterialRequestModal';
import ActorDetailOverlay from '../../pages/actors/ActorDetailOverlay';
import ActorForm from '../../components/actors/ActorForm';

import { MEDIA_BASE } from '../../services/api';

const API_BASE = MEDIA_BASE;

function dbImageUrl(images) {
  const first = Array.isArray(images) ? images[0] : null;
  if (!first?.file_path) return null;
  const base = (API_BASE || '').replace(/\/$/, '');
  const p = first.file_path.startsWith('/') ? first.file_path : '/' + first.file_path;
  return `${base}${p}`;
}

function normalizeStr(v) {
  return String(v || '').toLowerCase();
}

function getMaterialImage(material) {
  const name = normalizeStr(material?.name);
  if (name.includes('weizenspreu') && name.includes('los')) return '/assets/materials/weizenspreu-lose.png';
  if (name.includes('rundst') || name.includes('rundstäb') || name.includes('rundstaeb')) return '/assets/materials/rundstab.jpg';
  if (name.includes('hempflax') || name.includes('thermo hanf')) return '/assets/materials/hempflax.jpg';
  return null;
}

function getProjectImage(project) {
  const name = normalizeStr(project?.name);
  if (name.includes('akustik') || name.includes('absorber')) return '/assets/projects/akustikabsorber.jpg';
  return null;
}

function getOfferImage(offer) {
  // Offers are anchored to a material
  const name = normalizeStr(offer?.material_name);
  if (name.includes('weizenspreu') && name.includes('los')) return '/assets/materials/weizenspreu-lose.png';
  if (name.includes('rundst') || name.includes('rundstäb') || name.includes('rundstaeb')) return '/assets/materials/rundstab.jpg';
  if (name.includes('hempflax') || name.includes('thermo hanf')) return '/assets/materials/hempflax.jpg';
  return null;
}

function formatQty(qty, unit) {
  if (qty === null || qty === undefined) return null;
  const n = Number(qty);
  if (!Number.isFinite(n)) return null;
  const rounded = n >= 10 ? Math.round(n) : Math.round(n * 100) / 100;
  return `~${rounded} ${unit || ''}`.trim();
}

// ── Fake coordinates for entries without real location ────────────────────────
// Bounding box: 51.138527/11.859945 – 51.215849/12.278031 (approx Zeitz/Weißenfels area)
const GEO_BOX = {
  latMin: 50.971933, latMax: 51.215849,
  lonMin: 11.859945, lonMax: 12.391758,
};

function deterministicGeo(seed) {
  const s = String(seed);
  let h1 = 2166136261, h2 = 2246822519;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  const lat = GEO_BOX.latMin + ((h1 % 100000) / 100000) * (GEO_BOX.latMax - GEO_BOX.latMin);
  const lon = GEO_BOX.lonMin + ((h2 % 100000) / 100000) * (GEO_BOX.lonMax - GEO_BOX.lonMin);
  return { lat, lon, address: '' };
}
// ─────────────────────────────────────────────────────────────────────────────

function buildEntities({ materials, offers, projects, actors, search }) {
  const q = normalizeStr(search);

  const offerByMaterialId = (offers || []).reduce((acc, o) => {
    const id = o.material_id;
    if (!id) return acc;
    (acc[id] ||= []).push(o);
    return acc;
  }, {});

  const materialEntities = (materials || [])
    .filter((m) => {
      if (!q) return true;
      return normalizeStr(m?.name).includes(q) || normalizeStr(m?.category).includes(q) || normalizeStr(m?.description).includes(q);
    })
    .map((m) => {
      const relatedOffers = offerByMaterialId[m.id] || [];
      const offersWithGeo = relatedOffers.filter((o) => Number.isFinite(Number(o.latitude)) && Number.isFinite(Number(o.longitude)));

      // Material's own geo takes priority, then offer geo, then deterministic fallback
      const matGeo = Number.isFinite(Number(m.latitude)) && Number.isFinite(Number(m.longitude))
        ? { lat: Number(m.latitude), lon: Number(m.longitude), address: m.address || '' }
        : null;
      const offerGeo = offersWithGeo.length
        ? { lat: Number(offersWithGeo[0].latitude), lon: Number(offersWithGeo[0].longitude), address: offersWithGeo[0].address || '' }
        : null;
      const geo = matGeo || offerGeo || deterministicGeo(`material:${m.id}`);

      // If material has its own location AND there's also an offer with a different location, store offer location for the dashed line
      const offerGeoForLine = matGeo && offerGeo && (offerGeo.lat !== matGeo.lat || offerGeo.lon !== matGeo.lon) ? offerGeo : null;

      const totalQty = relatedOffers.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
      const unit = relatedOffers.find((o) => o.unit)?.unit || '';

      return {
        id: `material:${m.id}`,
        type: 'material',
        title: m.name,
        subtitle: m.category || 'Material',
        imageUrl: dbImageUrl(m.images) || getMaterialImage(m),
        location: geo,
        offerLocation: offerGeoForLine,
        quantityLabel: totalQty ? formatQty(totalQty, unit) : null,
        available: relatedOffers.length > 0,
        offerRaw: relatedOffers[0] || null,
        raw: m,
      };
    });

  const offerEntities = (offers || [])
    .filter((o) => {
      if (!q) return true;
      return (
        normalizeStr(o?.material_name).includes(q) ||
        normalizeStr(o?.location_name).includes(q) ||
        normalizeStr(o?.address).includes(q) ||
        normalizeStr(o?.notes).includes(q)
      );
    })
    .map((o) => {
      const realGeo = Number.isFinite(Number(o.latitude)) && Number.isFinite(Number(o.longitude))
        ? { lat: Number(o.latitude), lon: Number(o.longitude), address: o.address || '' }
        : null;
      const geo = realGeo || deterministicGeo(`offer:${o.id}`);
      return {
        id: `offer:${o.id}`,
        type: 'offer',
        title: o.material_name || 'Materialangebot',
        subtitle: o.location_name || 'Materialangebot',
        imageUrl: dbImageUrl(o.images) || getOfferImage(o),
        location: geo,
        quantityLabel: formatQty(o.quantity, o.unit || o.material_unit),
        raw: o,
      };
    });

  const projectEntities = (projects || [])
    .filter((p) => {
      if (!q) return true;
      return normalizeStr(p?.name).includes(q) || normalizeStr(p?.description).includes(q) || normalizeStr(p?.location_name).includes(q);
    })
    .map((p) => {
      const realGeo = Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))
        ? { lat: Number(p.latitude), lon: Number(p.longitude), address: p.address || '' }
        : null;
      const geo = realGeo || deterministicGeo(`project:${p.id}`);

      const totalGwp = p.total_gwp_value ?? p.totalGwpValue ?? null;
      const totalGwpUnit = p.total_gwp_unit ?? p.totalGwpUnit ?? null;

      return {
        id: `project:${p.id}`,
        type: 'project',
        title: p.name,
        subtitle: p.location_name || 'Projekt',
        imageUrl: dbImageUrl(p.images) || getProjectImage(p),
        location: geo,
        gwpTotal: typeof totalGwp === 'number' ? totalGwp : null,
        gwpUnit: totalGwpUnit || 'kg CO2e',
        available: p.is_available == 1,
        raw: p,
      };
    });

  const actorEntities = (actors || [])
    .filter((a) => {
      if (!q) return true;
      return normalizeStr(a?.name).includes(q) || normalizeStr(a?.type).includes(q) || normalizeStr(a?.location_name).includes(q);
    })
    .map((a) => {
      const realGeo = Number.isFinite(Number(a.latitude)) && Number.isFinite(Number(a.longitude))
        ? { lat: Number(a.latitude), lon: Number(a.longitude), address: a.address || '' }
        : null;
      const geo = realGeo || deterministicGeo(`actor:${a.id}`);
      return {
        id: `actor:${a.id}`,
        type: 'actor',
        title: a.name,
        subtitle: a.type || a.location_name || 'Akteur',
        imageUrl: a.images?.[0]?.file_path ? `${API_BASE}${a.images[0].file_path.replace(/^\./, '')}` : null,
        location: geo,
        available: false,
        raw: a,
      };
    });

  // Order: materials first, then projects, then actors, offers last (usually overlapping with materials)
  return [...materialEntities, ...projectEntities, ...actorEntities, ...offerEntities];
}

/**
 * Build connection lines for the selected entity.
 *
 * Lines drawn:
 *  • Project selected  → project–material (indigo) + material–offer (orange) for each used material
 *  • Material selected → material–offer (orange) + material–project (indigo) for each project using it
 *  • Offer selected    → offer–material (orange)
 *
 * @param {object|null} selected – the selected entity (from buildEntities)
 * @param {object[]}    allEntities – ALL entities (unfiltered, all with locations)
 */
function getConnectionsForSelection(selected, allEntities) {
  if (!selected) return [];

  const byId = new Map((allEntities || []).map((e) => [e.id, e]));
  const lines = [];

  if (selected.type === 'project') {
    const p = selected.raw;
    const pGeo = selected.location;
    if (!pGeo) return [];

    const usedMaterialIds = (p.materials || []).map((m) => m.material_id).filter(Boolean);

    for (const matId of usedMaterialIds) {
      const matEntity = byId.get(`material:${matId}`);
      const matGeo = matEntity?.location;

      if (matGeo) {
        // project → material
        lines.push({
          id: `conn:p${p.id}:m${matId}`,
          type: 'project-material',
          from: { lat: pGeo.lat, lon: pGeo.lon },
          to: { lat: matGeo.lat, lon: matGeo.lon },
        });

        // material → its offers
        for (const e of allEntities) {
          if (e.type === 'offer' && e.raw?.material_id === matId && e.location) {
            lines.push({
              id: `conn:m${matId}:o${e.raw.id}`,
              type: 'material-offer',
              from: { lat: matGeo.lat, lon: matGeo.lon },
              to: { lat: e.location.lat, lon: e.location.lon },
            });
          }
        }
      } else {
        // No material entity visible – draw project → offer directly
        for (const e of allEntities) {
          if (e.type === 'offer' && e.raw?.material_id === matId && e.location) {
            lines.push({
              id: `conn:p${p.id}:o${e.raw.id}`,
              type: 'project-offer',
              from: { lat: pGeo.lat, lon: pGeo.lon },
              to: { lat: e.location.lat, lon: e.location.lon },
            });
          }
        }
      }
    }

  } else if (selected.type === 'material') {
    const matId = selected.raw?.id;
    const matGeo = selected.location;
    if (!matId || !matGeo) return [];

    // material own-location → offer location (when both differ)
    if (selected.offerLocation) {
      lines.push({
        id: `conn:m${matId}:offerloc`,
        type: 'material-offer',
        from: { lat: matGeo.lat, lon: matGeo.lon },
        to: { lat: selected.offerLocation.lat, lon: selected.offerLocation.lon },
      });
    }

    // material → offers (entities)
    for (const e of allEntities) {
      if (e.type === 'offer' && e.raw?.material_id === matId && e.location) {
        lines.push({
          id: `conn:m${matId}:o${e.raw.id}`,
          type: 'material-offer',
          from: { lat: matGeo.lat, lon: matGeo.lon },
          to: { lat: e.location.lat, lon: e.location.lon },
        });
      }
    }

    // material → projects that use it
    for (const e of allEntities) {
      if (e.type === 'project' && e.location) {
        const ids = (e.raw?.materials || []).map((m) => m.material_id);
        if (ids.includes(matId)) {
          lines.push({
            id: `conn:m${matId}:p${e.raw.id}`,
            type: 'project-material',
            from: { lat: matGeo.lat, lon: matGeo.lon },
            to: { lat: e.location.lat, lon: e.location.lon },
          });
        }
      }
    }

  } else if (selected.type === 'offer') {
    const matId = selected.raw?.material_id;
    const offerGeo = selected.location;
    if (!matId || !offerGeo) return [];

    const matEntity = byId.get(`material:${matId}`);
    if (matEntity?.location) {
      lines.push({
        id: `conn:o${selected.raw.id}:m${matId}`,
        type: 'material-offer',
        from: { lat: offerGeo.lat, lon: offerGeo.lon },
        to: { lat: matEntity.location.lat, lon: matEntity.location.lon },
      });
    }

  } else if (selected.type === 'actor') {
    const actorGeo = selected.location;
    if (!actorGeo) return [];
    for (const link of (selected.raw?.links || [])) {
      const targetEntity = byId.get(`${link.entity_type}:${link.entity_id}`);
      if (targetEntity?.location) {
        lines.push({
          id: `conn:actor${selected.raw.id}:${link.entity_type}${link.entity_id}`,
          type: `actor-${link.entity_type}`,
          from: { lat: actorGeo.lat, lon: actorGeo.lon },
          to: { lat: targetEntity.location.lat, lon: targetEntity.location.lon },
        });
      }
    }
  }

  // For any selected entity, also draw lines FROM actors that link to it
  if (selected.type !== 'actor' && selected.type !== 'offer') {
    for (const e of allEntities) {
      if (e.type !== 'actor' || !e.location) continue;
      for (const link of (e.raw?.links || [])) {
        if (link.entity_type === selected.type && link.entity_id === selected.raw?.id) {
          lines.push({
            id: `conn:actor${e.raw.id}:${selected.type}${selected.raw.id}`,
            type: `actor-${selected.type}`,
            from: { lat: e.location.lat, lon: e.location.lon },
            to: { lat: selected.location.lat, lon: selected.location.lon },
          });
        }
      }
    }
  }

  return lines;
}

export default function Explore() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, token, user } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);
  const queryClient = useQueryClient();

  const deleteActorMutation = useMutation({
    mutationFn: (id) => actorService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors'] });
      setActorDetail(null);
    },
  });
  const handleDeleteActorFromExplore = (id) => {
    if (window.confirm('Akteur wirklich löschen?')) deleteActorMutation.mutate(id);
  };

  const requireAuth = () => {
    if (isAuthenticated && token) return true;
    openAuth({
      tab: 'login',
      reason: 'Bitte logge dich ein, um Materialien, Angebote oder Projekte anzulegen.',
    });
    return false;
  };

  const [search, setSearch] = useState('');
  const [showMap, setShowMap] = useState(true);
  const [showMaterials, setShowMaterials] = useState(true);
  const [showOffers, setShowOffers] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [showActors, setShowActors] = useState(true);
  const [filterAvailable, setFilterAvailable] = useState(false);

  const [selected, setSelected] = useState(null);
  const [offerDetailId, setOfferDetailId] = useState(null);
  const [actorDetail, setActorDetail] = useState(null);
  const [requestItem, setRequestItem] = useState(null); // raw inventory item for MaterialRequestModal

  // Create flows
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showActorForm, setShowActorForm] = useState(false);

  const materialsQuery = useQuery({
    queryKey: ['materials', { explore: true }],
    queryFn: () => materialService.getAll(),
  });

  // "Materialangebote" are inventory entries.
  // NOTE: /inventory/available returns *other users'* offers only, so for Explore we merge:
  // - own inventory (getAll)
  // - available inventory from others (getAvailable)
  const myOffersQuery = useQuery({
    queryKey: ['inventory', { explore: true }],
    queryFn: () => inventoryService.getAll({ is_available: true }),
    enabled: Boolean(isAuthenticated && token),
  });

  const availableOffersQuery = useQuery({
    queryKey: ['marketplace-inventory', { explore: true }],
    queryFn: () => inventoryService.getAvailable(),
  });

  const projectsQuery = useQuery({
    queryKey: ['projects', { explore: true }],
    queryFn: () => (isAuthenticated && token ? projectService.getAll() : projectService.getPublic()),
  });

  const actorsQuery = useQuery({
    queryKey: ['actors', { explore: true }],
    queryFn: () => actorService.getAll(),
  });

  // Helpers to deal with inconsistent response shapes (some endpoints return arrays, others {data: []})
  const unwrapList = (resp) => (Array.isArray(resp) ? resp : resp?.data || []);

  const materials = unwrapList(materialsQuery.data);
  const myOffers = unwrapList(myOffersQuery.data);
  const availableOffers = unwrapList(availableOffersQuery.data);
  const offers = useMemo(() => {
    const map = new Map();
    [...myOffers, ...availableOffers].forEach((o) => {
      if (o?.id != null) map.set(o.id, o);
    });
    return Array.from(map.values());
  }, [myOffers, availableOffers]);

  const projects = unwrapList(projectsQuery.data);
  const actors = unwrapList(actorsQuery.data);

  const entities = useMemo(() => buildEntities({ materials, offers, projects, actors, search }), [materials, offers, projects, actors, search]);

  const filteredEntities = useMemo(() => {
    return entities.filter((e) => {
      if (e.type === 'offer') return false; // replaced by "verfügbar" chip on material cards
      if (e.type === 'material' && !showMaterials) return false;
      if (e.type === 'project' && !showProjects) return false;
      if (e.type === 'actor' && !showActors) return false;
      if (filterAvailable && !e.available) return false;
      return true;
    });
  }, [entities, showMaterials, showOffers, showProjects, showActors, filterAvailable]);

  // All entities now always have a location (real or deterministic fake), so pass all filtered ones to the map
  const mapEntities = filteredEntities;

  // Connections use the full unfiltered entity list so lines are drawn even when a type is hidden by filters
  const connections = useMemo(() => getConnectionsForSelection(selected, entities), [selected, entities]);

  const isLoading =
    materialsQuery.isLoading ||
    myOffersQuery.isLoading ||
    availableOffersQuery.isLoading ||
    projectsQuery.isLoading ||
    actorsQuery.isLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2">
            <Network className="w-4 h-4 text-gray-700" />
            <h1 className="text-xl font-bold text-gray-900">Netzwerk</h1>
          </div>
          <span className="text-sm text-gray-500">Die regionale Plattform, auf der Materialien, Projekte und Beteiligte zusammenfinden.</span>
        </div>

        <div className="relative">
          <button
            data-onboarding="create-button"
            onClick={() => setCreateMenuOpen((v) => !v)}
            className="inline-flex items-center gap-2 bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Jetzt eintragen
          </button>

          {createMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-40">
              <button
                onClick={() => {
                  if (!requireAuth()) return;
                  setCreateMenuOpen(false);
                  setShowMaterialForm(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50"
              >
                <Package className="w-4 h-4" />
                Material
                <span className="ml-auto text-xs text-gray-400">(+ optional Angebot)</span>
              </button>
              <button
                onClick={() => {
                  if (!requireAuth()) return;
                  setCreateMenuOpen(false);
                  setShowProjectForm(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50"
              >
                <FolderOpen className="w-4 h-4" />
                Projekt
              </button>
              <button
                onClick={() => {
                  if (!requireAuth()) return;
                  setCreateMenuOpen(false);
                  setShowActorForm(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 border-t border-gray-100"
              >
                <Users className="w-4 h-4" />
                Akteur
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div data-onboarding="explore-filters" className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen (Name, Ort, Notizen…)"
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            {search ? (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowMaterials((v) => !v)}
              className="px-3 py-2 rounded-full text-sm font-medium border transition-all"
              style={showMaterials
                ? { background: 'linear-gradient(to bottom, #0033FF, rgba(0,51,255,0.72))', borderColor: '#0033FF', color: '#fff' }
                : { background: '#fff', borderColor: '#e5e7eb', color: '#6b7280' }}
            >
              Materialien
            </button>
            <button
              onClick={() => setShowProjects((v) => !v)}
              className="px-3 py-2 rounded-full text-sm font-medium border transition-all"
              style={showProjects
                ? { background: 'linear-gradient(to bottom, #639530, rgba(99,149,48,0.72))', borderColor: '#639530', color: '#fff' }
                : { background: '#fff', borderColor: '#e5e7eb', color: '#6b7280' }}
            >
              Projekte
            </button>
            <button
              onClick={() => setShowActors((v) => !v)}
              className="px-3 py-2 rounded-full text-sm font-medium border transition-all"
              style={showActors
                ? { background: 'linear-gradient(to bottom, #FF3B36, rgba(255,59,54,0.72))', borderColor: '#FF3B36', color: '#fff' }
                : { background: '#fff', borderColor: '#e5e7eb', color: '#6b7280' }}
            >
              Akteure
            </button>
            <button
              onClick={() => setFilterAvailable((v) => !v)}
              className={clsx(
                'px-3 py-2 rounded-full text-sm font-medium border transition-colors',
                filterAvailable
                  ? 'bg-gray-800 border-gray-800 text-white'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              )}
            >
              Nur verfügbare
            </button>
          </div>

          <div className="lg:ml-auto flex items-center">
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowMap(true)}
                className={clsx(
                  'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors',
                  showMap ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                )}
                title="Kartensicht"
              >
                <MapIcon className="w-4 h-4" />
                Karte
              </button>
              <button
                onClick={() => setShowMap(false)}
                className={clsx(
                  'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-200',
                  !showMap ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                )}
                title="Kartenansicht ausblenden"
              >
                <LayoutList className="w-4 h-4" />
                Liste
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main split */}
      <div className={clsx('grid gap-4', showMap ? 'grid-cols-1 xl:grid-cols-[1.6fr_1fr]' : 'grid-cols-1')}>
        {showMap && (
          <div data-onboarding="explore-map" className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="h-[70vh] min-h-[520px]">
              <ExploreMap
                entities={mapEntities}
                selected={selected}
                onSelect={setSelected}
                connections={connections}
                invalidateKey={`${showMaterialForm}-${showOfferForm}-${showProjectForm}-${!!offerDetailId}`}
                onOpenDetails={(e) => {
                  if (e.type === 'material') navigate(`/materials/${e.raw?.id}`);
                  if (e.type === 'project') navigate(`/projects/${e.raw?.id}`);
                  if (e.type === 'offer') setOfferDetailId(e.raw?.id);
                  if (e.type === 'actor') setActorDetail(e.raw);
                }}
              />
            </div>
          </div>
        )}

        <div data-onboarding="entity-list" className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900">Deine Umgebung</div>
              <div className="text-xs text-gray-500">{filteredEntities.length} Einträge</div>
            </div>
          </div>

          <div className="max-h-[70vh] min-h-[520px] overflow-y-auto p-4">
            {isLoading ? (
              <div className="text-center py-10">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="text-center py-10 text-gray-500">Keine Treffer.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredEntities.map((e) => (
                  <EntityCard
                    key={e.id}
                    entity={e}
                    active={selected?.id === e.id}
                    onSelect={() => setSelected(e)}
                    onOpenDetails={() => {
                      if (e.type === 'material') navigate(`/materials/${e.raw?.id}`);
                      if (e.type === 'project') navigate(`/projects/${e.raw?.id}`);
                      if (e.type === 'offer') setOfferDetailId(e.raw?.id);
                      if (e.type === 'actor') setActorDetail(e.raw);
                    }}
                    onRequest={
                      e.type === 'material' && e.offerRaw
                        ? () => {
                            if (!isAuthenticated) {
                              openAuth({ tab: 'login', reason: 'Bitte melde dich an, um Material anzufragen.' });
                            } else if (!user || e.offerRaw?.owner_id !== user.id) {
                              setRequestItem(e.offerRaw);
                            }
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showMaterialForm && (
        <MaterialForm
          onClose={() => setShowMaterialForm(false)}
          enableOfferOnCreate
        />
      )}
      {showOfferForm && <InventoryForm onClose={() => setShowOfferForm(false)} />}
      {showProjectForm && <ProjectForm onClose={() => setShowProjectForm(false)} />}
      {showActorForm && <ActorForm onClose={() => setShowActorForm(false)} />}
      {offerDetailId && (
        <InventoryDetailModal
          inventoryId={offerDetailId}
          onClose={() => setOfferDetailId(null)}
        />
      )}
      {requestItem && (
        <MaterialRequestModal
          item={requestItem}
          onClose={() => setRequestItem(null)}
        />
      )}
      {actorDetail && (
        <ActorDetailOverlay
          actor={actorDetail}
          isOwner={isAuthenticated && (actorDetail.owner_id === user?.id || user?.is_admin)}
          onClose={() => setActorDetail(null)}
          onEdit={() => {}}
          onDelete={handleDeleteActorFromExplore}
        />
      )}
    </div>
  );
}
