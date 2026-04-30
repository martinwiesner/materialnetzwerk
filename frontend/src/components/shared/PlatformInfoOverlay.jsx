import { useEffect } from 'react';
import { X, Package, FolderOpen, Users, LogIn, FlaskConical, ExternalLink } from 'lucide-react';
import { usePlatformInfoStore } from '../../store/platformInfoStore';

export default function PlatformInfoOverlay() {
  const { isOpen, close } = usePlatformInfoStore();

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">Über die Plattform</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
              Beta
            </span>
          </div>
          <button onClick={close} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors flex-shrink-0 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-5 space-y-5 text-sm text-gray-600 leading-relaxed">

          <div>
            <p className="text-gray-800 font-medium mb-2">Was ist die RZZ Materialdatenbank?</p>
            <p>
              Ein digitales Werkzeug des{' '}
              <a
                href="https://www.reallabor-zekiwa-zeitz.de"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                Reallabors ZEKIWA Zeitz
                <ExternalLink className="w-3 h-3" />
              </a>.
              {' '}Die Plattform vernetzt Materialien, Projekte und Akteure der Region
              und macht Stoffkreisläufe sichtbar — für eine funktionierende
              Kreislaufwirtschaft auf dem Gelände der ehemaligen Kinderwagenfabrik in Zeitz.
            </p>
          </div>

          <div className="space-y-2.5">
            <p className="text-gray-800 font-medium">Was findet man hier?</p>
            <div className="flex items-start gap-3 bg-blue-50 rounded-xl p-3 border border-blue-100">
              <Package className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900 text-[13px]">Materialien</p>
                <p className="text-blue-700 text-xs">
                  Bau- und Werkstoffe im Kontext nachhaltiger Kreislaufwirtschaft —
                  nachwachsende Rohstoffe, Rezyklate, experimentelle Materialien.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-green-50 rounded-xl p-3 border border-green-100">
              <FolderOpen className="w-4 h-4 text-green-700 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-900 text-[13px]">Projekte</p>
                <p className="text-green-700 text-xs">
                  Bau-, Gestaltungs- und Forschungsprojekte, die diese Materialien
                  einsetzen oder erproben.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-red-50 rounded-xl p-3 border border-red-100">
              <Users className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-900 text-[13px]">Akteure</p>
                <p className="text-red-700 text-xs">
                  Hersteller, Werkstätten, Forschungslabore, Initiativen und Vereine,
                  die im Netzwerk aktiv sind.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
            <LogIn className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-800 text-[13px]">Brauche ich einen Account?</p>
              <p className="text-gray-500 text-xs">
                Alle Inhalte sind ohne Login sichtbar. Um selbst Materialien, Projekte
                oder Akteure einzutragen, Materialien anzufragen oder Nachrichten zu
                senden, ist ein kostenloser Account nötig.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-amber-50 rounded-xl p-3 border border-amber-200">
            <FlaskConical className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800 text-[13px]">Beta-Version</p>
              <p className="text-amber-700 text-xs">
                Die Plattform befindet sich in aktiver Entwicklung. Funktionen können
                sich ändern und es kann zu kleineren Fehlern kommen.
                Feedback ist jederzeit willkommen!
              </p>
            </div>
          </div>

          <div>
            <p className="text-gray-800 font-medium mb-1">Wer steht dahinter?</p>
            <p className="text-xs text-gray-500">
              Ein Verbund aus Hochschule Anhalt, Stiftung Bauhaus Dessau,
              Burg Giebichenstein Kunsthochschule Halle, MLU Halle-Wittenberg,
              Forum Rathenau e.V. und der Stadt Zeitz. Gefördert durch die
              EU und das Land Sachsen-Anhalt (Just Transition Fund) im Rahmen
              des Neuen Europäischen Bauhaus.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={close}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
