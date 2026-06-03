import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Globe, Package, FolderOpen, X, Map as MapIcon, LayoutList, Users, BookOpen } from 'lucide-react';
import clsx from 'clsx';

import { materialService } from '../../services/materialService';
import { inventoryService } from '../../services/inventoryService';
import { projectService } from '../../services/projectService';
import { actorService } from '../../services/actorService';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import { useGuidelinesStore } from '../../store/guidelinesStore';

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
import { exportGesuchPoster, exportAngebotPoster } from '../../utils/exportUtils';
import { useT } from '../../i18n/useT';

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

// Zeitz city center coordinates
const ZEITZ_LAT = 51.0534;
const ZEITZ_LON = 12.1353;

function distKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns 0 (fully complete) to 1 (empty) — used to penalise sparse entries
function completenessScore(e) {
  const raw = e.raw || {};
  let filled = 0;
  let total = 0;
  const chk = (val) => { total++; if (val) filled++; };

  // Common: image, description, real location
  chk(raw.images?.length > 0);
  chk(raw.description || raw.content || raw.short_description);
  chk(Number.isFinite(Number(raw.latitude)) && Number.isFinite(Number(raw.longitude)));

  if (e.type === 'material') {
    chk(raw.category);
    chk(raw.manufacturer);
    chk(raw.gwp_total_value != null || raw.gwp_value != null || raw.gwp_fossil != null);
  } else if (e.type === 'project') {
    chk(raw.tools);
    chk(raw.time_effort);
    try {
      const steps = Array.isArray(raw.steps) ? raw.steps : JSON.parse(raw.steps || '[]');
      chk(steps.some((s) => s?.text || s?.title));
    } catch { chk(false); }
  } else if (e.type === 'actor') {
    chk(raw.email || raw.website || raw.phone);
    chk(raw.type);
  } else if (e.type === 'offer' || e.type === 'gesuch') {
    chk(raw.quantity);
    chk(raw.notes);
  }

  return total > 0 ? 1 - filled / total : 0.5;
}

// Combined recency + completeness + proximity score — lower = higher in list
// Completeness (30%): penalise incomplete entries; Recency (50%): newer first; Proximity (20%): closer first
function entityScore(e) {
  const lat = e.location?.lat ?? ZEITZ_LAT;
  const lon = e.location?.lon ?? ZEITZ_LON;
  const dist = distKm(ZEITZ_LAT, ZEITZ_LON, lat, lon);

  // Try both snake_case and camelCase field names; fall back to now (= score 0, appears first)
  const rawDate = e.raw?.created_at || e.raw?.createdAt;
  const createdMs = rawDate ? new Date(rawDate).getTime() : Date.now();
  const ageDays = Math.max(0, (Date.now() - createdMs) / 86400000);

  const distScore = Math.min(dist / 150, 1);
  const ageScore = Math.min(ageDays / 180, 1);
  const incomplete = completenessScore(e);
  return distScore * 0.20 + ageScore * 0.50 + incomplete * 0.30;
}

function buildEntities({ materials, offers, projects, actors, gesuche, search }) {
  const q = normalizeStr(search);

  const offerByMaterialId = (offers || []).reduce((acc, o) => {
    const id = o.material_id;
    if (!id) return acc;
    (acc[id] ||= []).push(o);
    return acc;
  }, {});

  // Set of material IDs that have at least one gesuch
  const gesuchMaterialIds = new Set((gesuche || []).map((g) => g.material_id).filter(Boolean));

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
        hasGesuch: gesuchMaterialIds.has(m.id),
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

  const gesuchEntities = (gesuche || [])
    .filter((g) => {
      if (!q) return true;
      return (
        normalizeStr(g?.material_name).includes(q) ||
        normalizeStr(g?.notes).includes(q) ||
        normalizeStr(g?.location_name).includes(q)
      );
    })
    .map((g) => {
      const realGeo = Number.isFinite(Number(g.latitude)) && Number.isFinite(Number(g.longitude))
        ? { lat: Number(g.latitude), lon: Number(g.longitude), address: g.address || '' }
        : null;
      const geo = realGeo || deterministicGeo(`gesuch:${g.id}`);
      return {
        id: `gesuch:${g.id}`,
        type: 'gesuch',
        title: g.material_name || 'Materialgesuch',
        subtitle: g.location_name || 'Gesuch',
        imageUrl: dbImageUrl(g.images) || getOfferImage(g),
        location: geo,
        quantityLabel: g.quantity ? formatQty(g.quantity, g.unit || g.material_unit) : null,
        hasGesuch: true,
        available: false,
        raw: g,
      };
    });

  // Sort all entities together by recency + proximity to Zeitz (offers are excluded via filteredEntities)
  const all = [...gesuchEntities, ...materialEntities, ...projectEntities, ...actorEntities, ...offerEntities];
  return all.sort((a, b) => entityScore(a) - entityScore(b));
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
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, token, user } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);
  const openGuidelines = useGuidelinesStore((s) => s.open);
  const queryClient = useQueryClient();

  const deleteActorMutation = useMutation({
    mutationFn: (id) => actorService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors'] });
      setActorDetail(null);
    },
  });
  const handleDeleteActorFromExplore = (id) => {
    if (window.confirm(t('actors.deleteConfirm'))) deleteActorMutation.mutate(id);
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
  // filterMode: 'all' | 'available' | 'gesuche'
  const [filterMode, setFilterMode] = useState('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  const [selected, setSelected] = useState(null);
  const [offerDetailId, setOfferDetailId] = useState(null);
  const [actorDetail, setActorDetail] = useState(null);
  const [requestItem, setRequestItem] = useState(null); // raw inventory item for MaterialRequestModal

  // Create flows
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [materialFormInitialMode, setMaterialFormInitialMode] = useState(undefined);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showActorForm, setShowActorForm] = useState(false);

  const materialsQuery = useQuery({
    queryKey: ['materials', { explore: true }],
    queryFn: () => materialService.getAll(),
    staleTime: 0,
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
    staleTime: 0,
  });

  const projectsQuery = useQuery({
    queryKey: ['projects', { explore: true }],
    queryFn: () => (isAuthenticated && token ? projectService.getAll() : projectService.getPublic()),
    staleTime: 0,
  });

  const actorsQuery = useQuery({
    queryKey: ['actors', { explore: true }],
    queryFn: () => actorService.getAll(),
    staleTime: 0,
  });

  const gesucheQuery = useQuery({
    queryKey: ['gesuche', { explore: true }],
    queryFn: () => inventoryService.getGesuche(),
    staleTime: 0, // always refetch on focus/mount so new Gesuche appear for all users
  });

  const matchesQuery = useQuery({
    queryKey: ['matches', { explore: true }],
    queryFn: () => inventoryService.getMatches(),
    refetchOnWindowFocus: false,
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
  const gesuche = unwrapList(gesucheQuery.data);
  const rawMatches = unwrapList(matchesQuery.data);

  const entities = useMemo(() => buildEntities({ materials, offers, projects, actors, gesuche, search }), [materials, offers, projects, actors, gesuche, search]);

  // Match connections for selected entity (gesuch or offer) — shown on click only
  const matchConnections = useMemo(() => {
    if (!selected) return [];
    const rawId = selected.raw?.id;
    return rawMatches
      .filter((m) => {
        if (selected.type === 'gesuch') return m.gesuch_id === rawId;
        if (selected.type === 'offer')  return m.offer_id  === rawId;
        return false;
      })
      .filter((m) =>
        Number.isFinite(Number(m.offer_lat)) && Number.isFinite(Number(m.offer_lon)) &&
        Number.isFinite(Number(m.gesuch_lat)) && Number.isFinite(Number(m.gesuch_lon))
      )
      .map((m) => ({
        id: `match:${m.offer_id}:${m.gesuch_id}`,
        from: [Number(m.offer_lat), Number(m.offer_lon)],
        to:   [Number(m.gesuch_lat), Number(m.gesuch_lon)],
        mid:  [(Number(m.offer_lat) + Number(m.gesuch_lat)) / 2,
               (Number(m.offer_lon) + Number(m.gesuch_lon)) / 2],
        materialName: m.material_name,
      }));
  }, [selected, rawMatches]);

  const filteredEntities = useMemo(() => {
    return entities.filter((e) => {
      if (e.type === 'offer') return false; // replaced by "verfügbar" chip on material cards
      // filterMode overrides type visibility
      if (filterMode === 'gesuche') return e.type === 'gesuch';
      if (filterMode === 'available') {
        if (e.type === 'gesuch') return false;
        if (!e.available) return false;
      }
      // type toggles (only active when filterMode === 'all')
      if (e.type === 'material' && !showMaterials) return false;
      if (e.type === 'project' && !showProjects) return false;
      if (e.type === 'actor' && !showActors) return false;
      if (e.type === 'gesuch') return true; // always show gesuche in 'all' mode
      return true;
    });
  }, [entities, showMaterials, showProjects, showActors, filterMode]);

  const mapEntities = filteredEntities;

  // Connections use the full unfiltered entity list so lines are drawn even when a type is hidden by filters
  const connections = useMemo(() => getConnectionsForSelection(selected, entities), [selected, entities]);

  const isLoading =
    materialsQuery.isLoading ||
    myOffersQuery.isLoading ||
    availableOffersQuery.isLoading ||
    projectsQuery.isLoading ||
    actorsQuery.isLoading ||
    gesucheQuery.isLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        {/* Row 1: title + action button (always side by side) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-gray-700 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{t('explore.title')}</h1>
            <button
              data-onboarding="guidelines-button"
              onClick={openGuidelines}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1 transition-colors hover:bg-gray-50 flex-shrink-0"
            >
              <BookOpen className="w-3.5 h-3.5" />
              {t('explore.infoRules')}
            </button>
          </div>

          <div className="relative flex-shrink-0">
          <button
            data-onboarding="create-button"
            onClick={() => setCreateMenuOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">{t('explore.addEntry')}</span>
            <span className="xs:hidden">{t('explore.addBtn')}</span>
          </button>

          {createMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-40">
              <button
                onClick={() => {
                  if (!requireAuth()) return;
                  setCreateMenuOpen(false);
                  setMaterialFormInitialMode(undefined);
                  setShowMaterialForm(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50"
              >
                <Package className="w-4 h-4" />
                {t('nav.materials')}
                <span className="ml-auto text-xs text-gray-400">{t('explore.materialWithOffer')}</span>
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
                {t('nav.projects')}
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
                {t('nav.actors')}
              </button>
              <div className="border-t border-gray-100">
                <button
                  onClick={() => { setCreateMenuOpen(false); openGuidelines(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  {t('explore.whatCanIAdd')}
                </button>
              </div>
            </div>
          )}
          </div>{/* end relative button wrapper */}
        </div>{/* end Row 1 */}
        {/* Row 2: description + mobile info button */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-gray-500 leading-snug">
            <span className="sm:hidden">
              {t('explore.subtitle').split('RZZ').map((part, i, arr) =>
                i < arr.length - 1 ? (
                  <span key={i}>{part}<a href="https://www.reallabor-zekiwa-zeitz.de" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 hover:text-gray-700 transition-colors">
                    RZZ<svg className="w-3 h-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a></span>
                ) : <span key={i}>{part}</span>
              )}
            </span>
            <span className="hidden sm:inline">
              {t('explore.subtitleLong').split('RZZ').map((part, i, arr) =>
                i < arr.length - 1 ? (
                  <span key={i}>{part}<a href="https://www.reallabor-zekiwa-zeitz.de" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 hover:text-gray-700 transition-colors">
                    RZZ<svg className="w-3 h-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a></span>
                ) : <span key={i}>{part}</span>
              )}
            </span>
          </span>
          <button
            data-onboarding="guidelines-button"
            onClick={openGuidelines}
            className="sm:hidden inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1 transition-colors hover:bg-gray-50 flex-shrink-0"
          >
            <BookOpen className="w-3 h-3" />
            {t('explore.info')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div data-onboarding="explore-filters" className="bg-white rounded-xl border border-gray-200 p-2.5 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('explore.searchPlaceholder')}
              className="w-full pl-10 pr-10 py-1.5 sm:py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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

          <div className="flex flex-wrap gap-1.5">
            {/* Filter dropdown */}
            <div className="relative">
              <button
                onClick={() => setFilterDropdownOpen((v) => !v)}
                className={clsx(
                  'px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-colors flex items-center gap-1',
                  filterMode !== 'all' || !showMaterials || !showProjects || !showActors
                    ? 'bg-gray-800 border-gray-800 text-white'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                )}
              >
                {filterMode === 'available' ? t('explore.filterAvailable') : filterMode === 'gesuche' ? t('explore.filterWanted') : t('common.filter')}
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {filterDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setFilterDropdownOpen(false)} />
                  <div className="absolute top-full mt-1 left-0 sm:left-auto sm:right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-56 py-1 text-sm">
                    {/* Ansicht-Filter */}
                    {[
                      { value: 'all', label: t('explore.filterModeAll') },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => { setFilterMode(value); setFilterDropdownOpen(false); }}
                        className={clsx(
                          'w-full text-left px-4 py-2 transition-colors flex items-center gap-2',
                          filterMode === value ? 'bg-gray-50 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', filterMode === value ? 'bg-gray-800' : 'bg-gray-200')} />
                        {label}
                      </button>
                    ))}

                    {/* Typ-Toggles (immer sichtbar, Mehrfachauswahl) */}
                    <div className="border-t border-gray-100 px-3 pt-2 pb-1">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t('explore.types')}</p>
                      {[
                        { key: 'materials', label: t('explore.filterMaterials'), color: '#0033FF', active: showMaterials, toggle: () => setShowMaterials((v) => !v) },
                        { key: 'projects',  label: t('explore.filterProjects'),   color: '#639530', active: showProjects,  toggle: () => setShowProjects((v) => !v) },
                        { key: 'actors',    label: t('explore.filterActors'),     color: '#FF3B36', active: showActors,    toggle: () => setShowActors((v) => !v) },
                      ].map(({ key, label, color, active, toggle }) => (
                        <button
                          key={key}
                          onClick={(e) => { e.stopPropagation(); toggle(); }}
                          className="w-full flex items-center gap-2.5 px-1 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors" style={{ background: active ? color : '#e5e7eb' }} />
                          <span className={active ? 'text-gray-900 font-medium' : 'text-gray-400'}>{label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Weitere Filter */}
                    <div className="border-t border-gray-100 pt-1">
                      {[
                        { value: 'available', label: t('explore.filterAvailableOffers') },
                        { value: 'gesuche',   label: t('explore.filterWanted') },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => { setFilterMode(value); setFilterDropdownOpen(false); }}
                          className={clsx(
                            'w-full text-left px-4 py-2 transition-colors flex items-center gap-2',
                            filterMode === value ? 'bg-gray-50 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                          )}
                        >
                          <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', filterMode === value ? 'bg-gray-800' : 'bg-gray-200')} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center flex-shrink-0">
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowMap(true)}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium transition-colors',
                  showMap ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                )}
                title={t('explore.mapView')}
              >
                <MapIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {t('common.map')}
              </button>
              <button
                onClick={() => setShowMap(false)}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium transition-colors border-l border-gray-200',
                  !showMap ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                )}
                title={t('explore.mapHide')}
              >
                <LayoutList className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {t('common.list')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main split */}
      <div className={clsx('grid gap-4', showMap ? 'grid-cols-1 xl:grid-cols-[1.6fr_1fr]' : 'grid-cols-1')}>
        {showMap && (
          <div data-onboarding="explore-map" className="bg-white rounded-2xl border border-gray-200 overflow-hidden isolate">
            <div className="h-[42vh] sm:h-[55vh] xl:h-[70vh] min-h-[260px] sm:min-h-[380px] xl:min-h-[520px]">
              <ExploreMap
                entities={mapEntities}
                selected={selected}
                onSelect={setSelected}
                connections={connections}
                matchConnections={matchConnections}
                search={search}
                invalidateKey={`${showMaterialForm}-${showOfferForm}-${showProjectForm}-${!!offerDetailId}`}
                onOpenDetails={(e) => {
                  if (e.type === 'material') navigate(`/materials/${e.raw?.id}`);
                  if (e.type === 'project') navigate(`/projects/${e.raw?.id}`);
                  if (e.type === 'offer') setOfferDetailId(e.raw?.id);
                  if (e.type === 'actor') setActorDetail(e.raw);
                  if (e.type === 'gesuch') navigate(`/gesuch/${e.raw?.id}`);
                }}
              />
            </div>
          </div>
        )}

        <div data-onboarding="entity-list" className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900">{t('explore.surroundings')}</div>
              <div className="text-xs text-gray-500">{filteredEntities.length} {t('explore.entries')}</div>
            </div>
          </div>

          <div className="max-h-[70vh] min-h-[520px] overflow-y-auto p-4">
            {isLoading ? (
              <div className="text-center py-10">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="text-center py-10 text-gray-500">{t('explore.empty')}</div>
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
                      if (e.type === 'gesuch') navigate(`/gesuch/${e.raw?.id}`);
                    }}
                    onPrint={e.type === 'gesuch' ? () => exportGesuchPoster(e.raw) : undefined}
                    onPrintOffer={e.type === 'material' && e.offerRaw ? () => exportAngebotPoster(e.offerRaw) : undefined}
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
          onClose={() => { setShowMaterialForm(false); setMaterialFormInitialMode(undefined); }}
          enableOfferOnCreate
          initialMode={materialFormInitialMode}
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
