import { useState, useEffect } from 'react';
import { FileDown, X, ChevronDown, ChevronUp } from 'lucide-react';
import { exportProjectLcaPdf } from '../../utils/exportProjectLcaPdf';

const STORAGE_KEY = 'lca-export-prefs';

const SCOPES = [
  {
    key: 'compact',
    label: 'Kompakt',
    desc: 'Stammdaten · Materialien & Prozesse · Kennzahlen · GWP · Methodenhinweise',
  },
  {
    key: 'detailed',
    label: 'Detailliert',
    desc: 'Alles aus Kompakt + Lebenszyklusphase-Aufschlüsselung · EF 3.1-Kategorien · Detailtabellen · Datenquellen · Versionsnachweis',
  },
  {
    key: 'full',
    label: 'Vollständiger Berechnungsnachweis',
    desc: 'Alles aus Detailliert + jeder einzelne Berechnungsschritt mit Formel, Eingangsgrößen, Faktoren, Zwischen- und Endergebnis',
  },
];

const SECTIONS = [
  { key: 'summary',     label: 'Gesamtbilanz (Kennzahlen)',        scopes: ['compact','detailed','full'] },
  { key: 'materials',   label: 'Materialbilanz',                    scopes: ['compact','detailed','full'] },
  { key: 'processes',   label: 'Prozessbilanz (IDEMAT)',            scopes: ['compact','detailed','full'] },
  { key: 'gwp',         label: 'GWP – Treibhausgaspotenzial',       scopes: ['compact','detailed','full'] },
  { key: 'ef31',        label: 'EF 3.1 nach Lebenszyklusphasen',    scopes: ['compact','detailed','full'] },
  { key: 'methodology', label: 'Methodenhinweise',                  scopes: ['compact','detailed','full'] },
  { key: 'dataSources', label: 'Datenquellen & Faktoren',           scopes: ['detailed','full'] },
  { key: 'versionInfo', label: 'Versions- und Reproduzierbarkeitsnachweis', scopes: ['detailed','full'] },
  { key: 'calcTrace',   label: 'Vollständiger Rechenweg (alle Schritte)', scopes: ['full'] },
];

function defaultSections(scope) {
  const result = {};
  for (const s of SECTIONS) {
    result[s.key] = s.scopes.includes(scope);
  }
  return result;
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

export default function LcaExportDialog({ project, epdMats, idematItems, onClose }) {
  const saved = loadPrefs();

  const [scope, setScope] = useState(saved?.scope || 'detailed');
  const [sections, setSections] = useState(saved?.sections || defaultSections(saved?.scope || 'detailed'));
  const [showSections, setShowSections] = useState(false);
  const [exporting, setExporting] = useState(false);

  // When scope changes, reset sections to defaults for new scope
  function handleScopeChange(newScope) {
    setScope(newScope);
    setSections(defaultSections(newScope));
  }

  function toggleSection(key) {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleExport() {
    setExporting(true);
    const prefs = { scope, sections };
    savePrefs(prefs);
    try {
      exportProjectLcaPdf(project, epdMats || [], idematItems || [], { scope, sections });
    } finally {
      setExporting(false);
      onClose();
    }
  }

  const availSections = SECTIONS.filter(s => s.scopes.includes(scope));
  const hasLcaData = (epdMats?.length || 0) + (idematItems?.length || 0) > 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-gray-900">Umweltkennwerte exportieren (LightLCA)</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!hasLcaData && (
          <div className="px-6 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              Keine Umweltbilanzdaten vorhanden. Bitte erst Materialien mit EPD-Daten oder IDEMAT-Prozesse hinzufügen.
            </div>
          </div>
        )}

        {/* Scope selection */}
        <div className="px-6 py-4 space-y-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Umfang des Exports</p>
          {SCOPES.map(s => (
            <label
              key={s.key}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                scope === s.key
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <input
                type="radio"
                name="scope"
                value={s.key}
                checked={scope === s.key}
                onChange={() => handleScopeChange(s.key)}
                className="mt-0.5 accent-emerald-600"
              />
              <div>
                <div className="text-sm font-semibold text-gray-900">{s.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Section checkboxes */}
        <div className="px-6 pb-4">
          <button
            type="button"
            onClick={() => setShowSections(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
          >
            {showSections ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Abschnitte anpassen
          </button>

          {showSections && (
            <div className="mt-3 space-y-2">
              {availSections.map(s => (
                <label key={s.key} className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!sections[s.key]}
                    onChange={() => toggleSection(s.key)}
                    className="accent-emerald-600 w-4 h-4"
                  />
                  <span className={`${sections[s.key] ? 'text-gray-900' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                  {s.key === 'calcTrace' && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded">
                      sehr umfangreich
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Scope warning for full proof */}
        {scope === 'full' && (
          <div className="mx-6 mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
            <b>Hinweis:</b> Der vollständige Berechnungsnachweis kann je nach Datenmenge sehr viele Seiten umfassen.
            Jeder Berechnungsschritt wird mit Formel, Eingangsgrößen, Faktoren und Ergebnis dokumentiert.
          </div>
        )}

        {/* Info */}
        <div className="mx-6 mb-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-600">
          {epdMats?.length || 0} Material(ien) mit EPD-Daten ·{' '}
          {idematItems?.length || 0} IDEMAT-Prozess(e) ·{' '}
          Die zuletzt gewählten Einstellungen werden lokal gespeichert.
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!hasLcaData || exporting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-4 h-4" />
            {exporting ? 'Wird erstellt…' : 'PDF erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}
