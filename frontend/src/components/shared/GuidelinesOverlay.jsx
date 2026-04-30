import { useEffect, useState } from 'react';
import { X, Package, FolderOpen, Users, Eye, FlaskConical, ChevronDown, ChevronUp, BookOpen, LogIn, ExternalLink } from 'lucide-react';
import { useGuidelinesStore } from '../../store/guidelinesStore';
import { useAuthStore } from '../../store/authStore';

// ── Collapsible section ───────────────────────────────────────────────────────

function Section({ icon: Icon, title, color, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden border border-gray-100">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}1a` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-50">
          {children}
        </div>
      )}
    </div>
  );
}

function YesList({ items }) {
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
          <span className="mt-0.5 text-emerald-500 flex-shrink-0">✓</span>
          <span dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
    </ul>
  );
}

function NoList({ items }) {
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-gray-500 leading-relaxed">
          <span className="mt-0.5 text-gray-300 flex-shrink-0">✗</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SubHeading({ children }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mt-3 mb-1.5">{children}</p>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GuidelinesOverlay({ onClose }) {
  const { isAuthenticated } = useAuthStore();
  const openCreate = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('rzz:openCreateMenu'));
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <BookOpen className="w-4 h-4 text-primary-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-gray-900">Info &amp; Spielregeln</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                  Beta
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Was ist diese Plattform — und was kann ich eintragen?
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors flex-shrink-0 ml-2"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

          {/* ── Was ist die Plattform? ── */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600 leading-relaxed space-y-2">
            <p>
              Ein digitales Werkzeug des{' '}
              <a
                href="https://www.reallabor-zekiwa-zeitz.de"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-800 inline-flex items-center gap-0.5"
              >
                Reallabors ZEKIWA Zeitz
                <ExternalLink className="w-3 h-3" />
              </a>.{' '}
              Die Plattform vernetzt Materialien, Projekte und Akteure der Region und macht
              Stoffkreisläufe sichtbar — für eine funktionierende Kreislaufwirtschaft auf
              dem Gelände der ehemaligen Kinderwagenfabrik in Zeitz.
            </p>
            <p>
              Plattform befindet sich in der <strong className="text-gray-800">Beta-Phase</strong> — Funktionen
              können sich ändern, und wir freuen uns über jedes Feedback!
            </p>
          </div>

          {/* ── Drei Entity-Typen als Mini-Cards ── */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-start gap-1.5 bg-blue-50 rounded-xl p-3 border border-blue-100">
              <Package className="w-4 h-4 text-blue-600" />
              <p className="font-semibold text-blue-900 text-[12px]">Materialien</p>
              <p className="text-blue-700 text-[11px] leading-snug">Baustoffe, Rezyklate, nachwachsende Rohstoffe</p>
            </div>
            <div className="flex flex-col items-start gap-1.5 bg-green-50 rounded-xl p-3 border border-green-100">
              <FolderOpen className="w-4 h-4 text-green-700" />
              <p className="font-semibold text-green-900 text-[12px]">Projekte</p>
              <p className="text-green-700 text-[11px] leading-snug">Bau-, Gestaltungs- und Forschungs&shy;vorhaben</p>
            </div>
            <div className="flex flex-col items-start gap-1.5 bg-red-50 rounded-xl p-3 border border-red-100">
              <Users className="w-4 h-4 text-red-600" />
              <p className="font-semibold text-red-900 text-[12px]">Akteure</p>
              <p className="text-red-700 text-[11px] leading-snug">Hersteller, Werkstätten, Initiativen</p>
            </div>
          </div>

          {/* ── Login-Hinweis ── */}
          <div className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <LogIn className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-700">Kein Account nötig</strong> um alles anzusehen.
              Zum Eintragen, Anfragen und Nachrichten senden ist ein kostenloser Account erforderlich —
              Registrierung dauert nur wenige Sekunden.
            </p>
          </div>

          {/* ── Spielregeln: einklappbare Abschnitte ── */}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 pt-1">Spielregeln — Was gehört wohin?</p>

          <Section icon={Package} title="Materialien" color="#0033FF" defaultOpen>
            <SubHeading>Was gehört hierher</SubHeading>
            <YesList items={[
              '<strong>Bau- und Werkstoffe</strong> im Kontext von nachhaltigem, zirkulärem Bauen',
              '<strong>Nachwachsende Rohstoffe</strong>: Holz, Hanf, Stroh, Lehm, Flachs, Wolle, Schilf, Kork u.&nbsp;v.&nbsp;m.',
              '<strong>Recycling- und Sekundärrohstoffe</strong>: Rezyklate, rückgebaute Baustoffe, aufbereitete Materialien',
              '<strong>Innovative Materialien</strong>: z.&nbsp;B. Myzel-Werkstoffe, Textilbeton, Materialien aus invasiven Pflanzen',
              '<strong>Konventionelle Baustoffe</strong>, die im Kreislauf geführt werden können (z.&nbsp;B. Ziegel aus Rückbau)',
              'Materialien mit <strong>regionalem Bezug</strong> — besonders willkommen, aber keine Pflicht',
              '<strong>Restmaterialien und Überschüsse</strong>, die weiterverwendet werden könnten',
            ]} />
            <SubHeading>Was gehört NICHT hierher</SubHeading>
            <NoList items={[
              'Fertige Konsumprodukte (Möbel, Elektrogeräte, Kleidung)',
              'Materialien ohne Bezug zu Bau, Gestaltung oder Kreislaufwirtschaft',
              'Reine Verkaufsanzeigen / kommerzielle Werbung',
              'Gefahrstoffe oder Materialien, deren Weitergabe rechtlich unzulässig ist',
            ]} />
            <SubHeading>Hinweise zur Qualität</SubHeading>
            <YesList items={[
              'Möglichst aussagekräftiger Name und Beschreibung',
              'Fotos sind sehr hilfreich (aber nicht zwingend)',
              'Technische Daten (Dichte, Akustik, Brandverhalten …) wenn vorhanden willkommen',
              'Nachhaltigkeitsprinzipien angeben wenn zutreffend',
              'Standort / Geo-Daten helfen bei der Verortung auf der Karte',
            ]} />
          </Section>

          <Section icon={FolderOpen} title="Projekte" color="#639530">
            <SubHeading>Was gehört hierher</SubHeading>
            <YesList items={[
              '<strong>Bau- und Gestaltungsprojekte</strong>, die Materialien aus der Datenbank nutzen',
              '<strong>Forschungsprojekte</strong> zu Materialien, Kreislaufwirtschaft oder nachhaltigem Bauen',
              '<strong>Prototypen und Experimente</strong>: z.&nbsp;B. Akustikabsorber aus Weizenspreu',
              '<strong>Laufende und geplante Vorhaben</strong> — Projekte müssen nicht abgeschlossen sein',
              'Projekte können als <strong>Entwurf</strong> gespeichert werden (nur für dich sichtbar)',
            ]} />
            <SubHeading>Was gehört NICHT hierher</SubHeading>
            <NoList items={[
              'Reine Stellenanzeigen oder Jobangebote',
              'Projekte ohne Materialbezug (reine Software-Projekte, Events ohne Baubezug)',
            ]} />
            <SubHeading>Besonders wertvoll</SubHeading>
            <YesList items={[
              'Verknüpfung mit Materialien aus der Datenbank',
              'Verknüpfung mit beteiligten Akteuren',
              'Dokumentation von Arbeitsschritten mit Fotos',
              'Angabe von zirkulären Prinzipien (Design für Demontage, Modulares Design …)',
            ]} />
          </Section>

          <Section icon={Users} title="Akteure" color="#FF3B36">
            <SubHeading>Was gehört hierher</SubHeading>
            <YesList items={[
              '<strong>Hersteller</strong> von nachhaltigen Bau- oder Werkstoffen',
              '<strong>Lieferanten / Händler</strong> von Recycling- oder Bio-Baustoffen',
              '<strong>Forschung / Labore</strong>, die an Materialinnovationen arbeiten',
              '<strong>Recycling- / Verwertungsbetriebe</strong> und Urban-Mining-Initiativen',
              '<strong>Makerspaces, Repair Cafés, Upcycling-Werkstätten</strong>',
              '<strong>Vereine und Initiativen</strong> für Kreislaufwirtschaft oder nachhaltiges Bauen',
              '<strong>Unternehmen</strong> aus Bau / Gestaltung mit zirkulärem Ansatz',
              'Fokus liegt auf der Region — überregionale Akteure mit Bezug willkommen',
            ]} />
            <SubHeading>Was gehört NICHT hierher</SubHeading>
            <NoList items={[
              'Privatpersonen als Einzelpersonen (es geht um Organisationen und Initiativen)',
              'Unternehmen ohne erkennbaren Bezug zu Materialien, Bau oder Kreislaufwirtschaft',
              'Reine Werbeeinträge',
            ]} />
          </Section>

          <Section icon={Eye} title="Was kann ich ohne Login sehen?" color="#6366f1">
            <div className="grid sm:grid-cols-2 gap-3 mt-1">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Ohne Login (Gast)</p>
                <YesList items={[
                  'Alle Materialien, Projekte und Akteure durchstöbern',
                  'Netzwerk-Karte mit Verbindungslinien nutzen',
                  'Filtern, Suchen, Detailseiten ansehen',
                ]} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Mit kostenlosem Account</p>
                <YesList items={[
                  'Eigene Materialien, Projekte &amp; Akteure eintragen',
                  'Materialien anfragen und Angebote verwalten',
                  'Nachrichten senden und empfangen',
                  'Push-Benachrichtigungen aktivieren',
                ]} />
              </div>
            </div>
          </Section>

          <Section icon={FlaskConical} title="Beta-Version — Work in Progress" color="#d97706">
            <div className="text-xs text-gray-600 leading-relaxed space-y-2">
              <p>Diese Plattform befindet sich in aktiver Entwicklung im Rahmen des Reallabors ZEKIWA Zeitz.</p>
              <YesList items={[
                '<strong>Neue Funktionen</strong> werden laufend ergänzt',
                '<strong>Bugs und Fehler</strong> können auftreten — bitte hab Verständnis',
                '<strong>Dein Feedback ist Gold wert</strong> — schreib uns gerne direkt',
              ]} />
              <p className="mt-2 text-gray-500">
                Kontakt / Feedback:{' '}
                <a href="mailto:martin.wiesner@hs-anhalt.de" className="underline hover:text-gray-700 transition-colors">
                  martin.wiesner@hs-anhalt.de
                </a>
              </p>
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          <p className="text-[11px] text-gray-400 hidden sm:block">
            Jederzeit über den Link im Footer erneut aufrufen.
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isAuthenticated && (
              <button
                onClick={openCreate}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary-700 hover:text-primary-800 border border-primary-200 hover:border-primary-300 rounded-lg px-3 py-2 transition-colors hover:bg-primary-50"
              >
                Jetzt eintragen →
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg px-4 py-2 hover:bg-gray-700 transition-colors"
            >
              Verstanden
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
