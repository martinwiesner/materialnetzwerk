import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icons in Vite
// (Leaflet expects these assets to be available at runtime)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DEFAULT_CENTER = [51.10, 12.20]; // Central Germany-ish
const DEFAULT_ZOOM = 7;

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

/**
 * A small reusable map for showing points.
 *
 * points: Array of {
 *   id: string
 *   type: 'material'|'project'
 *   title: string
 *   subtitle?: string
 *   latitude: number
 *   longitude: number
 *   address?: string
 * }
 */
export default function GeoMap({ points = [], className = '' }) {
  useEffect(() => {
    // Ensure Leaflet uses our bundled icon assets
    L.Marker.prototype.options.icon = createDefaultIcon();
  }, []);

  const validPoints = useMemo(
    () =>
      (points || []).filter(
        (p) =>
          typeof p?.latitude === 'number' &&
          typeof p?.longitude === 'number' &&
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude)
      ),
    [points]
  );

  const center = useMemo(() => {
    if (validPoints.length === 0) return DEFAULT_CENTER;
    const avgLat = validPoints.reduce((s, p) => s + p.latitude, 0) / validPoints.length;
    const avgLon = validPoints.reduce((s, p) => s + p.longitude, 0) / validPoints.length;
    return [avgLat, avgLon];
  }, [validPoints]);

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={validPoints.length ? 10 : DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full rounded-xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        {validPoints.map((p) => (
          <Marker key={p.id} position={[p.latitude, p.longitude]}>
            <Popup>
              <div className="min-w-[220px]">
                <div className="font-semibold">{p.title}</div>
                {p.subtitle ? <div className="text-sm opacity-80">{p.subtitle}</div> : null}
                {p.address ? <div className="text-xs opacity-70 mt-1">{p.address}</div> : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
