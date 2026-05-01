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
        const isLocalIp = /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+/.test(window.location.hostname);
        if (err.code === 1) {
          if (isLocalIp) {
            setError('Lokal nur über http://localhost erreichbar (nicht über IP-Adresse), da Browser Geolocation sonst blockieren.');
          } else {
            setError('Standortzugriff blockiert. Schloss-Symbol in der Adressleiste → Standort → Zulassen → Seite neu laden.');
          }
        } else if (err.code === 3) {
          setError('Zeitüberschreitung – Standort konnte nicht ermittelt werden. Bitte manuell eingeben.');
        } else {
          setError('Standort konnte nicht ermittelt werden. Bitte Koordinaten manuell eingeben.');
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
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
