import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, Copy, Check, ExternalLink } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const PASSPORT_META = {
  construction: {
    badge: 'Baumaterial · EU CPR 2024/3110',
    color: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-400',
    description:
      'Dieser Eintrag ist als Baumaterial klassifiziert und folgt dem Schema der EU Construction Products Regulation (2024/3110). Der QR-Code verknüpft das physische Material mit seinem digitalen Materialpass — als Aufkleber direkt am Bauteil oder Lagerort angebracht.',
  },
  product: {
    badge: 'Produktmaterial · EU ESPR 2024/1781',
    color: 'bg-blue-50 text-blue-800 border-blue-200',
    dot: 'bg-blue-400',
    description:
      'Dieser Eintrag folgt dem Schema der EU Ecodesign for Sustainable Products Regulation (2024/1781). Der QR-Code verknüpft das Material mit seinem digitalen Produktpass.',
  },
  project: {
    badge: 'Bauprojekt · EU CPR 2024/3110',
    color: 'bg-green-50 text-green-700 border-green-200',
    dot: 'bg-green-500',
    description:
      'Dieser QR-Code verknüpft das Projekt mit seinem digitalen Datensatz — als Aushang am Bauort oder auf Projektdokumenten.',
  },
};

/**
 * Material-ID + QR-Code section shown at the bottom of detail views.
 *
 * @param {string}  materialId   - e.g. "RZZ-MAT-202605-0001"
 * @param {string}  passportType - "construction" | "product" | "project"
 * @param {string}  entityType   - "materials" | "projects"  (for label PDF download)
 * @param {string}  entityId     - UUID of the entity (for label PDF download)
 */
export default function MaterialIdSection({ materialId, passportType = 'construction', entityType, entityId }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const resolverUrl = `${window.location.origin}/id/${materialId}`;
  const meta = PASSPORT_META[passportType] || PASSPORT_META.construction;

  useEffect(() => {
    if (!canvasRef.current || !materialId) return;
    QRCode.toCanvas(canvasRef.current, resolverUrl, {
      width: 80,
      margin: 1,
      color: { dark: '#111111', light: '#ffffff' },
    }).catch(() => {});
  }, [resolverUrl, materialId]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(resolverUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  }

  async function handleDownloadPdf() {
    if (!entityType || !entityId) return;
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/labels/${entityType}/${entityId}`);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aufkleber-${materialId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  if (!materialId) return null;

  return (
    <div className="border-t border-gray-100 mt-6 pt-6">
      <div className="flex items-start gap-5">
        {/* QR code preview */}
        <div className="flex-shrink-0 rounded-xl overflow-hidden border border-gray-200 bg-white p-1.5 shadow-sm">
          <canvas ref={canvasRef} style={{ display: 'block', width: 80, height: 80 }} />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Label + badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Material-ID
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.badge}
            </span>
          </div>

          {/* ID */}
          <div className="font-mono font-bold text-gray-900 text-base tracking-wide">
            {materialId}
          </div>

          {/* Description */}
          <p className="text-xs text-gray-500 leading-relaxed max-w-lg">
            {meta.description}
          </p>

          {/* Resolver URL + copy */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-400 truncate max-w-[260px]">
              {resolverUrl}
            </span>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors"
            >
              {copied
                ? <><Check className="w-3 h-3 text-green-600" /> Kopiert</>
                : <><Copy className="w-3 h-3" /> Kopieren</>}
            </button>
          </div>

          {/* PDF button */}
          {entityType && entityId && (
            <div className="space-y-1">
              <button
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Printer className="w-4 h-4" />
                {downloading ? 'Wird erstellt…' : 'QR-Code Aufkleber als PDF herunterladen'}
              </button>
              <p className="text-[11px] text-gray-400">
                24 Aufkleber pro A4-Seite · 70 × 36 mm · kompatibel mit Avery Zweckform 3484, Herma 4336
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
