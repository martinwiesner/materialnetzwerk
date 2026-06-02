import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Search, X, Crosshair, Loader } from 'lucide-react';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const pinIcon = new L.Icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER = [51.0532575, 12.1287658];
const DEFAULT_ZOOM = 12;

// ── Internal: map click + drag handler ────────────────────────────────────────

function MapInteraction({ position, onMove }) {
  const markerRef = useRef(null);

  useMapEvents({
    click(e) { onMove(e.latlng.lat, e.latlng.lng); },
  });

  if (!position) return null;

  return (
    <Marker
      position={position}
      icon={pinIcon}
      draggable
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const m = markerRef.current;
          if (m) {
            const { lat, lng } = m.getLatLng();
            onMove(lat, lng);
          }
        },
      }}
    />
  );
}

// ── Internal: fly-to helper ────────────────────────────────────────────────────

function FlyTo({ target }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (target) map.flyTo(target, DEFAULT_ZOOM, { duration: 0.8 });
  }, [target, map]);
  return null;
}

// ── Nominatim helpers ─────────────────────────────────────────────────────────

async function searchNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=de,at,ch`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'de' } });
  return res.json();
}

async function reverseNominatim(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'de' } });
  return res.json();
}

function formatAddress(data) {
  const a = data.address || {};
  const parts = [
    a.road && a.house_number ? `${a.road} ${a.house_number}` : a.road,
    a.postcode && (a.city || a.town || a.village)
      ? `${a.postcode} ${a.city || a.town || a.village}`
      : a.city || a.town || a.village,
  ].filter(Boolean);
  return parts.join(', ') || data.display_name?.split(',').slice(0, 3).join(',') || '';
}

function formatLocationName(data) {
  const a = data.address || {};
  return a.city || a.town || a.village || a.municipality || a.county || '';
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * LocationPicker — reusable for Material, Project, Actor forms
 *
 * value:    { location_name, address, latitude, longitude }
 * onChange: (value) => void
 */
export default function LocationPicker({ value = {}, onChange, label }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [flyTarget, setFlyTarget] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  const lat = value.latitude ? Number(value.latitude) : null;
  const lng = value.longitude ? Number(value.longitude) : null;
  const position = lat && lng ? [lat, lng] : null;
  const center = position || DEFAULT_CENTER;

  // Close suggestions on outside click
  useEffect(() => {
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced Nominatim search
  const handleQueryChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    setSuggestions([]);
    clearTimeout(debounceRef.current);
    if (q.trim().length < 3) { setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchNominatim(q);
        setSuggestions(results);
        setShowSuggestions(true);
      } catch { /* network error — ignore */ }
      finally { setSearching(false); }
    }, 350);
  };

  const pickSuggestion = (item) => {
    const newLat = parseFloat(item.lat);
    const newLng = parseFloat(item.lon);
    const address = formatAddress(item);
    const location_name = formatLocationName(item);
    setQuery(item.display_name.split(',').slice(0, 2).join(','));
    setShowSuggestions(false);
    setSuggestions([]);
    setFlyTarget([newLat, newLng]);
    onChange({ location_name, address, latitude: newLat, longitude: newLng });
  };

  const clearLocation = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setFlyTarget(null);
    onChange({ location_name: '', address: '', latitude: null, longitude: null });
  };

  // Reverse geocode after map interaction
  const handleMapMove = useCallback(async (newLat, newLng) => {
    onChange({ ...value, latitude: newLat, longitude: newLng });
    setFlyTarget(null);
    try {
      const data = await reverseNominatim(newLat, newLng);
      const address = formatAddress(data);
      const location_name = formatLocationName(data);
      setQuery(data.display_name?.split(',').slice(0, 2).join(',') || '');
      onChange({ location_name, address, latitude: newLat, longitude: newLng });
    } catch { /* ignore */ }
  }, [value, onChange]);

  // GPS
  const handleGps = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: newLat, longitude: newLng } = pos.coords;
        setFlyTarget([newLat, newLng]);
        try {
          const data = await reverseNominatim(newLat, newLng);
          const address = formatAddress(data);
          const location_name = formatLocationName(data);
          setQuery(data.display_name?.split(',').slice(0, 2).join(',') || '');
          onChange({ location_name, address, latitude: newLat, longitude: newLng });
        } catch {
          onChange({ ...value, latitude: newLat, longitude: newLng });
        }
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          <MapPin className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
          {label}
        </label>
      )}

      {/* Search row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Adresse oder Ort eingeben…"
            className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
          {searching && (
            <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
          )}
          {!searching && (query || position) && (
            <button
              type="button"
              onClick={clearLocation}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto text-sm">
              {suggestions.map((item) => (
                <li key={item.place_id}>
                  <button
                    type="button"
                    onClick={() => pickSuggestion(item)}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <span className="text-gray-800 line-clamp-1">{item.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* GPS button */}
        <button
          type="button"
          onClick={handleGps}
          disabled={gpsLoading}
          title="Aktuellen Standort verwenden"
          className="flex-shrink-0 flex items-center justify-center w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {gpsLoading
            ? <Loader className="w-4 h-4 text-gray-500 animate-spin" />
            : <Crosshair className="w-4 h-4 text-gray-500" />
          }
        </button>
      </div>

      {/* Confirmed address chip */}
      {value.address && (
        <p className="text-xs text-gray-500 flex items-center gap-1 pl-1">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {value.address}
        </p>
      )}

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-gray-200 h-44 sm:h-52">
        <MapContainer
          center={center}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap"
          />
          <MapInteraction position={position} onMove={handleMapMove} />
          {flyTarget && <FlyTo target={flyTarget} />}
        </MapContainer>
      </div>

      <p className="text-[11px] text-gray-400">
        Auf die Karte klicken oder Pin ziehen um den Standort feinanzupassen.
      </p>
    </div>
  );
}
