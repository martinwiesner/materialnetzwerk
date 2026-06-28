import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Stable initial view — MapController handles all subsequent panning
const DEFAULT_CENTER = [51.0532575, 12.1287658];
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
function fitToEntities(map, entities, animate = true) {
  const validPoints = (entities || [])
    .filter((e) => e.location && Number.isFinite(e.location.lat) && Number.isFinite(e.location.lon))
    .map((e) => [e.location.lat, e.location.lon]);
  if (validPoints.length === 0) return;
  try {
    if (validPoints.length === 1) {
      map.flyTo(validPoints[0], 13, { animate, duration: 0.6 });
    } else {
      map.fitBounds(L.latLngBounds(validPoints), { padding: [40, 40], maxZoom: 14, animate, duration: 0.6 });
    }
  } catch (_) {}
}

function MapController({ selected, invalidateKey, entities, search }) {
  const map = useMap();
  const fittedRef = useRef(false);
  const prevSearchRef = useRef('');

  // Initial fit — when entities first appear, fit the map bounds once
  useEffect(() => {
    if (fittedRef.current || !entities || entities.length === 0) return;
    fittedRef.current = true;
    fitToEntities(map, entities, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities?.length > 0]);

  // Fit to search results whenever search string changes
  useEffect(() => {
    if (prevSearchRef.current === search) return;
    prevSearchRef.current = search;
    if (!search) return; // clearing search → keep current view
    if (!entities || entities.length === 0) return;
    const t = setTimeout(() => fitToEntities(map, entities, true), 150);
    return () => clearTimeout(t);
  }, [search, entities, map]);

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

const COLOR_MATERIAL = '#0033FF';
const COLOR_PROJECT  = '#639530';
const COLOR_ACTOR    = '#FF3B36';
const AVAIL_COLOR    = '#F97316'; // orange badge
const GESUCH_COLOR   = '#7C3AED'; // purple badge

// Solid base color per type (used when no badge present)
const BASE_COLORS = {
  material: COLOR_MATERIAL,
  offer:    COLOR_MATERIAL,
  project:  COLOR_PROJECT,
  actor:    COLOR_ACTOR,
};

function createGradientMarker(type, active, available = false, hasGesuch = false) {
  const r  = active ? 11 : 8;
  const sw = active ? 3  : 2;
  const hasBadge = available || hasGesuch;
  // Extra padding on all sides so badge dots don't clip outside the SVG
  const pad = hasBadge ? 4 : 0;
  const size = (r + sw) * 2 + pad * 2;
  const cx = r + sw + pad;
  const cy = r + sw + pad;
  const a = active ? 'a' : '';

  const solidColor = BASE_COLORS[type] || COLOR_MATERIAL;
  const fillDef = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${solidColor}" stroke="${solidColor}" stroke-width="${sw}" stroke-opacity="0.5"/>`;

  // Orange dot top-right when available
  const availBadge = available
    ? `<circle cx="${cx + r - 1}" cy="${cy - r + 1}" r="3.5" fill="${AVAIL_COLOR}" stroke="white" stroke-width="1.2"/>`
    : '';
  // Purple dot top-left when gesuch
  const gesuchBadge = hasGesuch
    ? `<circle cx="${cx - r + 1}" cy="${cy - r + 1}" r="3.5" fill="${GESUCH_COLOR}" stroke="white" stroke-width="1.2"/>`
    : '';

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    fillDef,
    availBadge,
    gesuchBadge,
    `</svg>`,
  ].join('');

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size],
    iconAnchor: [cx, cy],
    popupAnchor: [0, -(cy + 4)],
  });
}

const CONNECTION_STYLES = {
  'project-material': { color: '#639530', weight: 1.5, dashArray: '5 7', opacity: 0.75 },
  'material-offer':   { color: '#0033FF', weight: 1.5, dashArray: '5 7', opacity: 0.75 },
  'project-offer':    { color: '#6b7280', weight: 1.5, dashArray: '5 7', opacity: 0.6  },
  'actor-material':   { color: '#FF3B36', weight: 2,   dashArray: '4 6', opacity: 0.8  },
  'actor-project':    { color: '#e82f2a', weight: 2,   dashArray: '4 6', opacity: 0.8  },
  'match':            { color: '#7C3AED', weight: 2,   dashArray: '6 5', opacity: 0.8  },
};

const TYPE_LABELS = { material: 'Material', offer: 'Materialangebot', project: 'Projekt', actor: 'Akteur', gesuch: 'Materialgesuch' };

// Legend dot: solid color or gradient circle + optional badge overlays
function LegendDot({ color = null, gradient = false, available = false, hasGesuch = false }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 20, height: 20, flexShrink: 0 }}>
      <span style={{
        position: 'absolute', top: 3, left: 3,
        width: 14, height: 14,
        borderRadius: '50%',
        background: gradient
          ? `linear-gradient(to left, ${COLOR_MATERIAL}, ${COLOR_PROJECT})`
          : color || COLOR_MATERIAL,
        boxShadow: `0 0 0 2px ${(color || COLOR_MATERIAL)}33`,
        display: 'block',
      }} />
      {available && (
        <span style={{
          position: 'absolute', top: 0, right: 0,
          width: 8, height: 8,
          borderRadius: '50%',
          background: AVAIL_COLOR,
          border: '1.5px solid white',
          display: 'block',
        }} />
      )}
      {hasGesuch && (
        <span style={{
          position: 'absolute', top: 0, left: 0,
          width: 8, height: 8,
          borderRadius: '50%',
          background: GESUCH_COLOR,
          border: '1.5px solid white',
          display: 'block',
        }} />
      )}
    </span>
  );
}

function MapLegend() {
  return (
    <div className="map-legend-box">
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
        <LegendDot color={COLOR_MATERIAL} />
        <span>Material</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
        <LegendDot color={COLOR_PROJECT} />
        <span>Projekt</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
        <LegendDot color={COLOR_ACTOR} />
        <span>Akteur</span>
      </div>
      <div style={{ width: '100%', height: 1, background: 'rgba(0,0,0,0.07)', margin: '4px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
        <LegendDot color={COLOR_MATERIAL} available />
        <span>+ Angebot</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <LegendDot color={COLOR_MATERIAL} hasGesuch />
        <span>+ Gesuch</span>
      </div>
    </div>
  );
}

const MATCH_LINE_STYLE = { color: '#7C3AED', weight: 2, dashArray: '6 5', opacity: 0.7 };

function createMatchIcon() {
  // Lightning bolt path, centered in a 22x22 circle
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
    <circle cx="11" cy="11" r="10" fill="#7C3AED" stroke="white" stroke-width="2"/>
    <polygon points="13,3 7,12 11,12 9,19 15,10 11,10" fill="white"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

function MapClickHandler({ onSetRadiusCenter }) {
  useMapEvents({
    click(e) {
      onSetRadiusCenter({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

export default function ExploreMap({
  entities = [],
  selected = null,
  onSelect,
  connections = [],
  matchConnections = [],
  onOpenDetails,
  invalidateKey,
  search = '',
  radiusCenter = null,
  radiusKm = 10,
  onSetRadiusCenter = null,
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
    <div className="relative h-full w-full">
    <MapLegend />
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      zoomControl={false}
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
        search={search}
      />

      {/* Map-click handler for radius center selection */}
      {onSetRadiusCenter && <MapClickHandler onSetRadiusCenter={onSetRadiusCenter} />}

      {/* Radius circle */}
      {radiusCenter && (
        <Circle
          center={[radiusCenter.lat, radiusCenter.lon]}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 2, dashArray: '6 4' }}
        />
      )}

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

      {/* Match connections: angebot ↔ gesuch for same material */}
      {matchConnections.map((mc) => (
        <React.Fragment key={mc.id}>
          <Polyline positions={[mc.from, mc.to]} pathOptions={MATCH_LINE_STYLE} />
          <Marker position={mc.mid} icon={createMatchIcon()}>
            <Popup>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginBottom: 2 }}>Match</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{mc.materialName}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Angebot ↔ Gesuch</div>
              </div>
            </Popup>
          </Marker>
        </React.Fragment>
      ))}


      {/* Entity markers */}
      {points.map(({ e, pos }) => {
        const active = selected?.id === e.id;
        return (
          <Marker
            key={e.id}
            position={pos}
            icon={createGradientMarker(e.type, active, e.available, e.hasGesuch)}
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
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 2 }}>
                    {e.available ? `Verfügbar: ${e.quantityLabel}` : e.quantityLabel}
                  </div>
                ) : null}
                {e.hasGesuch && e.type !== 'gesuch' ? (
                  <div style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600, marginBottom: 4 }}>
                    ⬤ Materialgesuch vorhanden
                  </div>
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
          </Marker>
        );
      })}
    </MapContainer>
    </div>
  );
}
