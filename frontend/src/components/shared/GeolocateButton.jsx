import { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

/**
 * Button that requests the browser's current location and calls onLocate(lat, lon).
 */
export default function GeolocateButton({ onLocate, className = '' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = () => {
    if (!navigator.geolocation) {
      setError('Geolocation wird von diesem Browser nicht unterstützt.');
      return;
    }
    setError('');
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        onLocate(
          parseFloat(pos.coords.latitude.toFixed(6)),
          parseFloat(pos.coords.longitude.toFixed(6))
        );
      },
      (err) => {
        setLoading(false);
        if (err.code === 1) {
          setError('Berechtigung verweigert – bitte Koordinaten manuell eingeben oder Browsereinstellungen prüfen.');
        } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
          setError('Geolocation benötigt HTTPS. Koordinaten bitte manuell eingeben.');
        } else {
          setError('Standort konnte nicht ermittelt werden. Koordinaten bitte manuell eingeben.');
        }
      },
      { timeout: 8000 }
    );
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50"
      >
        {loading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <MapPin className="w-3.5 h-3.5" />
        }
        {loading ? 'Ermittle Standort…' : 'Aktuellen Standort verwenden'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
