import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Stable initial view — MapController handles all subsequent panning
const DEFAULT_CENTER = [51.09, 12.12];
const DEFAULT_ZOOM = 11;

const createDefaultIcon = () =>
  new L.Icon({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

// ── MapController ─────────────────────────────────────────────────────────────
// Runs inside MapContainer so it has access to the Leaflet map instance.
// Handles:
//  1. Fly to selected entity when selection changes
//  2. invalidateSize after overlays close (triggered by invalidateKey prop change)
function MapController({ selected, invalidateKey, entities }) {
  const map = useMap();
  const fittedRef = useRef(false);

  // Initial fit — when entities first appear, fit the map bounds once
  useEffect(() => {
    if (fittedRef.current || !entities || entities.length === 0) return;
    const validPoints = entities
      .filter((e) => e.location && Number.isFinite(e.location.lat) && Number.isFinite(e.location.lon))
      .map((e) => [e.location.lat, e.location.lon]);
    if (validPoints.length === 0) return;
    fittedRef.current = true;
    try {
      const bounds = L.latLngBounds(validPoints);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: false });
    } catch (_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities?.length > 0]);

  // Fly to selected entity
  useEffect(() => {
    if (!selected?.location) return;
    const lat = Number(selected.location.lat);
    const lon = Number(selected.location.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    map.flyTo([lat, lon], Math.max(map.getZoom(), 13), { animate: true, duration: 0.6 });
  }, [selected?.id, map]);

  // Re-validate after overlay interactions (overlays can shift the map container)
  useEffect(() => {
    if (!invalidateKey) return;
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => clearTimeout(t);
  }, [invalidateKey, map]);

  return null;
}
// ─────────────────────────────────────────────────────────────────────────────

function toLatLng(entity) {
  if (!entity?.location) return null;
  const lat = Number(entity.location.lat);
  const lon = Number(entity.location.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lat, lon];
}

function styleForType(type, active) {
  if (type === 'material') {
    // Core Blue #0033FF
    return { color: '#0029cc', fillColor: '#0033FF', weight: active ? 4 : 2, radius: active ? 11 : 8 };
  }
  if (type === 'offer') {
    return { color: '#0029cc', fillColor: '#3366ff', weight: active ? 4 : 2, radius: active ? 11 : 8 };
  }
  if (type === 'actor') {
    // Pulse Red #FF3B36
    return { color: '#cc1f1a', fillColor: '#FF3B36', weight: active ? 4 : 2, radius: active ? 13 : 10 };
  }
  // project — Extra Grün #639530
  return { color: '#507826', fillColor: '#639530', weight: active ? 4 : 2, radius: active ? 11 : 8 };
}

const CONNECTION_STYLES = {
  'project-material': { color: '#639530', weight: 1.5, dashArray: '5 7', opacity: 0.75 },
  'material-offer':   { color: '#0033FF', weight: 1.5, dashArray: '5 7', opacity: 0.75 },
  'project-offer':    { color: '#6b7280', weight: 1.5, dashArray: '5 7', opacity: 0.6  },
  'actor-material':   { color: '#FF3B36', weight: 2,   dashArray: '4 6', opacity: 0.8  },
  'actor-project':    { color: '#e82f2a', weight: 2,   dashArray: '4 6', opacity: 0.8  },
};

const TYPE_LABELS = { material: 'Material', offer: 'Materialangebot', project: 'Projekt', actor: 'Akteur' };

export default function ExploreMap({
  entities = [],
  selected = null,
  onSelect,
  connections = [],
  onOpenDetails,
  invalidateKey,
}) {
  useEffect(() => {
    L.Marker.prototype.options.icon = createDefaultIcon();
  }, []);

  const points = useMemo(
    () => (entities || []).map((e) => ({ e, pos: toLatLng(e) })).filter((x) => x.pos),
    [entities]
  );

  const polylines = useMemo(() => {
    return (connections || [])
      .map((c) => {
        const a = [Number(c.from?.lat), Number(c.from?.lon)];
        const b = [Number(c.to?.lat), Number(c.to?.lon)];
        if (![a[0], a[1], b[0], b[1]].every(Number.isFinite)) return null;
        return { id: c.id, positions: [a, b], type: c.type };
      })
      .filter(Boolean);
  }, [connections]);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />

      <MapController
        selected={selected}
        invalidateKey={invalidateKey}
        entities={entities}
      />

      {/* Connection lines — rendered below markers */}
      {polylines.map((l) => {
        const style = CONNECTION_STYLES[l.type] || CONNECTION_STYLES['project-offer'];
        return (
          <Polyline
            key={l.id}
            positions={l.positions}
            pathOptions={style}
          />
        );
      })}

      {/* Entity markers */}
      {points.map(({ e, pos }) => {
        const active = selected?.id === e.id;
        const style = styleForType(e.type, active);
        return (
          <CircleMarker
            key={e.id}
            center={pos}
            radius={style.radius}
            pathOptions={{
              color: style.color,
              fillColor: style.fillColor,
              fillOpacity: 0.9,
              weight: style.weight,
            }}
            eventHandlers={{ click: () => onSelect?.(e) }}
          >
            <Popup>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginBottom: 2 }}>
                  {TYPE_LABELS[e.type] || e.type}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{e.title}</div>
                {e.subtitle && e.subtitle !== e.title ? (
                  <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 2 }}>{e.subtitle}</div>
                ) : null}
                {e.location?.address ? (
                  <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 4 }}>{e.location.address}</div>
                ) : null}
                {e.quantityLabel ? (
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 2 }}>{e.quantityLabel}</div>
                ) : null}
                {typeof e.gwpTotal === 'number' ? (
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>
                    GWP: {e.gwpTotal.toFixed(2)} {e.gwpUnit || 'kg CO2e'}
                  </div>
                ) : null}
                {onOpenDetails ? (
                  <button
                    onClick={() => onOpenDetails(e)}
                    style={{
                      marginTop: 8,
                      width: '100%',
                      padding: '6px 0',
                      background: '#0f172a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Details anzeigen →
                  </button>
                ) : null}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
