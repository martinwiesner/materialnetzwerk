import { useEffect } from 'react';
import { X, Scale } from 'lucide-react';
import { useAgbStore } from '../../store/agbStore';
import { useSettings } from '../../hooks/useSettings';

function Para({ title, children }) {
  return (
    <div>
      <p className="font-semibold text-gray-800 text-xs mb-1.5">{title}</p>
      <div className="text-xs text-gray-600 leading-relaxed space-y-1.5">{children}</div>
    </div>
  );
}

export default function AGBOverlay() {
  const { isOpen, close } = useAgbStore();
  const { data: settings } = useSettings();
  const customHtml = settings?.agb_html;

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
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Scale className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-800">
              Nutzungsbedingungen &amp; Haftungsausschluss
            </span>
          </div>
          <button onClick={close} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-5 space-y-5">

          {customHtml ? (
            <div
              className="text-xs text-gray-600 leading-relaxed space-y-4 [&_strong]:text-gray-800 [&_a]:underline [&_a]:hover:text-gray-800 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1"
              dangerouslySetInnerHTML={{ __html: customHtml }}
            />
          ) : (
          <>
          {/* Präambel */}
          <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-100 text-xs text-amber-800 leading-relaxed">
            Diese Plattform ist ein unentgeltliches Forschungswerkzeug, das im Rahmen des öffentlich
            geförderten Projekts <strong>Reallabor ZEKIWA Zeitz</strong> betrieben wird.
            Die Nutzung ist kostenlos und erfolgt freiwillig. Mit der Nutzung der Plattform
            (auch ohne Registrierung) werden diese Nutzungsbedingungen anerkannt.
          </div>

          <Para title="§ 1 Geltungsbereich und Betreiber">
            <p>
              Diese Nutzungsbedingungen gelten für alle Nutzer:innen der RZZ Materialdatenbank
              (<a href="https://materialien.reallabor-zekiwa-zeitz.de" className="underline hover:text-gray-800">materialien.reallabor-zekiwa-zeitz.de</a>),
              im Folgenden „Plattform" genannt. Betreiberin ist die <strong>Hochschule Anhalt</strong>,
              Körperschaft des öffentlichen Rechts, Bernburger Straße 55, 06366 Köthen
              (Saale), vertreten durch den Rektor, im Folgenden „Betreiberin" genannt.
              Die Plattform wird im Rahmen des Forschungsprojekts Reallabor ZEKIWA Zeitz
              entwickelt und betrieben, das vom Land Sachsen-Anhalt und der Europäischen
              Union (Just Transition Fund) gefördert wird.
            </p>
          </Para>

          <Para title="§ 2 Gegenstand und Zweck der Plattform">
            <p>
              Die Plattform dient der Vernetzung von Materialien, Projekten und Akteuren
              im Kontext nachhaltiger Kreislaufwirtschaft in der Region Zeitz und Umgebung.
              Sie ist ein Forschungs- und Kommunikationswerkzeug ohne kommerziellen Zweck.
            </p>
            <p>
              Die Plattform befindet sich im <strong>Beta-Betrieb</strong>. Es handelt
              sich um eine Forschungsinfrastruktur in aktiver Entwicklung. Funktionen
              können sich ohne Vorankündigung ändern oder entfernt werden. Die Plattform
              erhebt keinen Anspruch auf vollständige Funktionsfähigkeit, Verfügbarkeit
              oder Dauerhaftigkeit.
            </p>
          </Para>

          <Para title="§ 3 Nutzungsvoraussetzungen und Registrierung">
            <p>
              Die lesende Nutzung der Plattform ist ohne Registrierung möglich. Für das
              Einstellen von Inhalten (Materialien, Projekte, Akteure), das Versenden
              von Nachrichten sowie das Anfragen von Materialien ist eine kostenlose
              Registrierung erforderlich.
            </p>
            <p>
              Die Registrierung ist nur natürlichen Personen ab 18 Jahren gestattet.
              Jede Person darf nur ein Konto anlegen. Die Zugangsdaten sind
              vertraulich zu behandeln und dürfen nicht an Dritte weitergegeben werden.
              Nutzer:innen sind verpflichtet, bei der Registrierung wahrheitsgemäße
              Angaben zu machen und diese aktuell zu halten.
            </p>
          </Para>

          <Para title="§ 4 Pflichten der Nutzer:innen und zulässige Inhalte">
            <p>
              Nutzer:innen sind allein verantwortlich für die Inhalte, die sie auf der
              Plattform einstellen. Eingestellte Inhalte müssen den geltenden Rechtsvorschriften
              entsprechen. Insbesondere ist es untersagt:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
              <li>Falsche, irreführende oder verleumderische Angaben zu machen</li>
              <li>Rechte Dritter (Urheberrechte, Markenrechte, Persönlichkeitsrechte) zu verletzen</li>
              <li>Gefahrstoffe oder rechtlich unzulässige Materialien einzutragen</li>
              <li>Werbliche oder kommerzielle Inhalte ohne Forschungsbezug einzustellen</li>
              <li>Die Plattform für automatisierte Massenabfragen oder Scraping zu nutzen</li>
              <li>Die Plattform oder ihre Infrastruktur zu beschädigen oder zu stören</li>
            </ul>
            <p>
              Nutzer:innen versichern, dass sie über alle erforderlichen Rechte an den
              hochgeladenen Inhalten (insbesondere Bilder, Dokumente) verfügen und räumen
              der Betreiberin das nicht-exklusive, kostenlose Recht ein, diese Inhalte im
              Rahmen des Plattformbetriebs darzustellen und zu verbreiten.
            </p>
          </Para>

          <Para title="§ 5 Haftung der Betreiberin — Grundsatz">
            <p>
              Die Plattform wird <strong>unentgeltlich</strong> als Forschungsinfrastruktur
              zur Verfügung gestellt. Die Haftung der Betreiberin ist — soweit gesetzlich
              zulässig — in Anlehnung an <strong>§§ 521, 599 BGB</strong> auf Vorsatz und
              grobe Fahrlässigkeit beschränkt. Bei leichter Fahrlässigkeit haftet die
              Betreiberin nur bei Verletzung wesentlicher Vertragspflichten
              (Kardinalpflichten); in diesem Fall ist die Haftung auf den vorhersehbaren,
              vertragstypischen Schaden begrenzt.
            </p>
            <p>
              <em>Kardinalpflichten</em> sind solche Pflichten, deren Erfüllung die
              ordnungsgemäße Nutzung der Plattform erst ermöglicht und auf deren Einhaltung
              Nutzer:innen regelmäßig vertrauen dürfen.
            </p>
            <p className="font-medium text-gray-700">
              Die vorstehenden Haftungsbeschränkungen gelten ausdrücklich nicht für Schäden
              aus der Verletzung des Lebens, des Körpers oder der Gesundheit, für
              vorsätzlich oder grob fahrlässig verursachte Schäden sowie für Ansprüche nach
              dem Produkthaftungsgesetz (§ 309 Nr. 7 BGB).
            </p>
          </Para>

          <Para title="§ 6 Haftungsausschluss für nutzergenerierte Inhalte">
            <p>
              Die Betreiberin ist Hosterin nutzergenerierter Inhalte im Sinne von
              <strong> Art. 6 der Verordnung (EU) 2022/2065 (Digital Services Act, DSA)</strong>
              sowie § 1 Abs. 3 des Digitale-Dienste-Gesetzes (DDG). Die Betreiberin macht
              sich nutzergenerierte Inhalte — insbesondere eingetragene Materialien,
              Projekte und Akteure — nicht zu eigen.
            </p>
            <p>
              Eine Haftung für nutzergenerierte Inhalte entsteht erst, wenn die Betreiberin
              von einer konkreten Rechtsverletzung Kenntnis erlangt und diese nicht
              unverzüglich beseitigt. Die Betreiberin ist nicht verpflichtet, Inhalte
              proaktiv zu überwachen (Art. 8 DSA).
            </p>
            <p>
              Nutzer:innen, die rechtswidrige Inhalte feststellen, werden gebeten, diese
              unverzüglich zu melden: <a href="mailto:martin.wiesner@hs-anhalt.de" className="underline hover:text-gray-800">martin.wiesner@hs-anhalt.de</a>
            </p>
          </Para>

          <Para title="§ 7 Haftungsausschluss für Beta-Betrieb, Verfügbarkeit und Datenverlust">
            <p>
              Die Plattform befindet sich im Beta-Betrieb im Rahmen eines laufenden
              Forschungsprojekts. Die Betreiberin übernimmt keine Gewähr für:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
              <li>Ununterbrochene oder fehlerfreie Verfügbarkeit der Plattform</li>
              <li>Richtigkeit, Vollständigkeit oder Aktualität der angezeigten Inhalte</li>
              <li>Dauerhaften Erhalt hochgeladener Dateien und eingetragener Inhalte</li>
              <li>Kompatibilität mit bestimmten Endgeräten oder Browsern</li>
              <li>Fortbestand einzelner Funktionen oder der Plattform insgesamt</li>
            </ul>
            <p>
              Nutzer:innen werden ausdrücklich darauf hingewiesen, eigene Sicherungskopien
              wichtiger Daten und Inhalte zu erstellen. Bei unvermeidbarem Datenverlust
              ist die Haftung der Betreiberin auf den typischen Wiederherstellungsaufwand
              begrenzt, der bei ordnungsgemäßer Datensicherung durch die Nutzerin/den
              Nutzer entstanden wäre.
            </p>
          </Para>

          <Para title="§ 8 Haftungsausschluss für externe Links">
            <p>
              Die Plattform enthält Links zu externen Websites Dritter. Auf deren
              Inhalte hat die Betreiberin keinen Einfluss. Für die Inhalte verlinkter
              Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.
              Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche
              Rechtsverstöße geprüft; rechtswidrige Inhalte waren nicht erkennbar.
            </p>
            <p>
              Bei Bekanntwerden von Rechtsverletzungen werden derartige Links unverzüglich
              entfernt (Art. 6 DSA). Die Betreiberin macht sich die Inhalte verlinkter
              Seiten nicht zu eigen.
            </p>
          </Para>

          <Para title="§ 9 Urheberrecht und geistiges Eigentum">
            <p>
              Das Layout, das Design und der Quellcode der Plattform sowie die von der
              Betreiberin erstellten Inhalte unterliegen dem Urheberrecht der
              Hochschule Anhalt. Eine Vervielfältigung oder Verwendung außerhalb der
              gesetzlich zulässigen Schranken bedarf der vorherigen schriftlichen
              Zustimmung.
            </p>
            <p>
              Nutzer:innen bleiben Urheber:innen ihrer eingestellten Inhalte und
              räumen der Betreiberin das im Rahmen des Plattformbetriebs erforderliche
              Nutzungsrecht ein (vgl. § 4).
            </p>
          </Para>

          <Para title="§ 10 Kündigung, Sperrung und Plattformeinstellung">
            <p>
              Nutzer:innen können ihr Konto jederzeit und ohne Angabe von Gründen
              löschen lassen (Anfrage an: <a href="mailto:martin.wiesner@hs-anhalt.de" className="underline hover:text-gray-800">martin.wiesner@hs-anhalt.de</a>).
            </p>
            <p>
              Die Betreiberin ist berechtigt, Nutzerkonten bei Verstoß gegen diese
              Nutzungsbedingungen ohne Vorwarnung zu sperren oder zu löschen. Da die
              Plattform unentgeltlich angeboten wird, besteht kein Anspruch auf
              Weiterbetrieb. Die Betreiberin kann den Betrieb der Plattform jederzeit —
              auch ohne Angabe von Gründen — einstellen oder wesentlich verändern.
            </p>
          </Para>

          <Para title="§ 11 Änderungen der Nutzungsbedingungen">
            <p>
              Die Betreiberin behält sich vor, diese Nutzungsbedingungen jederzeit mit
              Wirkung für die Zukunft anzupassen. Über wesentliche Änderungen werden
              registrierte Nutzer:innen per E-Mail oder durch einen Hinweis auf der
              Plattform informiert. Die weitere Nutzung nach Inkrafttreten geänderter
              Bedingungen gilt als Zustimmung.
            </p>
          </Para>

          <Para title="§ 12 Datenschutz">
            <p>
              Die Verarbeitung personenbezogener Daten erfolgt gemäß der
              Datenschutzerklärung der Hochschule Anhalt, abrufbar unter{' '}
              <a href="https://www.hs-anhalt.de/datenschutz.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-800">
                www.hs-anhalt.de/datenschutz.html
              </a>.
              Die Erhebung und Verarbeitung der für den Plattformbetrieb erforderlichen
              Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b) DSGVO
              (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. f) DSGVO (berechtigte
              Interessen des Forschungsprojekts).
            </p>
          </Para>

          <Para title="§ 13 Schlussbestimmungen">
            <p>
              Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
              UN-Kaufrechts (CISG). Gerichtsstand für Klagen der Betreiberin ist der
              Sitz der Hochschule Anhalt (Köthen/Saale), soweit gesetzlich zulässig.
              Für Klagen gegen Verbraucher:innen gelten die gesetzlichen Gerichtsstände.
              Zwingende Bestimmungen des Verbraucherschutzrechts des Staates, in dem
              Nutzer:innen ihren gewöhnlichen Aufenthalt haben, bleiben unberührt.
            </p>
            <p>
              Sollten einzelne Bestimmungen dieser Nutzungsbedingungen unwirksam sein
              oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt
              (Salvatorische Klausel).
            </p>
            <p className="text-gray-400">
              Stand: {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })} —
              Reallabor ZEKIWA Zeitz / Hochschule Anhalt
            </p>
          </Para>
          </>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end flex-shrink-0">
          <button
            onClick={close}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
