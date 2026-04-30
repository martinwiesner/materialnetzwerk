import { useEffect, useState } from 'react';
import { X, Package, FolderOpen, Users, Eye, FlaskConical, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
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

// ── Yes/No lists ──────────────────────────────────────────────────────────────

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
    // Trigger create menu on Explore page via a custom event so Layout doesn't need to know
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
                <h2 className="text-base font-bold text-gray-900">Spielregeln &amp; Mitmachen</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                  Beta
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Was kann eingetragen werden — und was nicht?
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

          {/* Einleitung */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600 leading-relaxed space-y-2">
            <p>
              Die RZZ Materialdatenbank ist Teil des Reallabors ZEKIWA Zeitz und dient dem Aufbau einer regionalen Kreislaufwirtschaft. Ziel ist es, Materialkreisläufe in der Region Zeitz sichtbar zu machen und Akteure miteinander zu vernetzen.
            </p>
            <p>
              Die Plattform befindet sich aktuell in der <strong className="text-gray-800">Beta-Phase</strong>. Funktionen können sich ändern, es kann zu kleineren Fehlern kommen — und wir freuen uns über jedes Feedback. Gemeinsam machen wir die Datenbank besser!
            </p>
          </div>

          {/* Materialien */}
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

          {/* Projekte */}
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

          {/* Akteure */}
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

          {/* Sichtbarkeit */}
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
            <p className="text-[11px] text-gray-400 mt-3">
              Registrierung: E-Mail und Passwort genügen — dauert nur wenige Sekunden.
            </p>
          </Section>

          {/* Beta */}
          <Section icon={FlaskConical} title="Beta-Version — Work in Progress" color="#d97706">
            <div className="text-xs text-gray-600 leading-relaxed space-y-2">
              <p>Diese Plattform befindet sich in aktiver Entwicklung im Rahmen des Reallabors ZEKIWA Zeitz.</p>
              <YesList items={[
                '<strong>Neue Funktionen</strong> werden laufend ergänzt',
                '<strong>Bugs und Fehler</strong> können auftreten — bitte hab Verständnis',
                '<strong>Dein Feedback ist Gold wert</strong> — schreib uns gerne direkt',
              ]} />
              <p className="mt-2">
                Die Materialdatenbank ist ein Gemeinschaftsprojekt. Je mehr Menschen mitmachen, desto wertvoller wird das Netzwerk für alle.
              </p>
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
            Spielregeln jederzeit über den Link im Footer erneut aufrufen.
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
