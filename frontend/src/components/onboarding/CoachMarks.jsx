import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useOnboarding } from './useOnboarding';

// ── Constants ────────────────────────────────────────────────────────────────
const SPOT_PAD   = 10;   // px padding around spotlight target
const TIP_OFFSET = 14;   // px gap between spotlight edge and tooltip
const WAIT_MS    = 3000; // max wait for DOM element to appear

// ── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 'logo',
    selector: '[data-onboarding="logo"]',
    tag: 'WILLKOMMEN', tagColor: '#0033FF',
    title: 'Die RZZ Materialdatenbank',
    text: 'Diese Plattform verbindet Materialien, Projekte und Akteure der Region — für eine funktionierende Kreislaufwirtschaft rund um das Reallabor ZEKIWA Zeitz. Hier kannst du nachhaltige Baumaterialien entdecken, Angebote anfragen und eigene Projekte teilen.',
    detail: 'Das Reallabor ZEKIWA Zeitz revitalisiert die ehemalige Kinderwagenfabrik in Zeitz als Modellprojekt für zirkuläres Bauen. Im Verbund aus Hochschule Anhalt, Stiftung Bauhaus Dessau, Burg Giebichenstein, MLU Halle-Wittenberg, Forum Rathenau e.V. und der Stadt Zeitz werden nachhaltige Materialien erforscht und direkt vor Ort erprobt. Die Materialdatenbank ist das digitale Werkzeug, das diese Kreisläufe sichtbar und nutzbar macht.',
    requiresPage: null,
    skipOnMobile: false,
  },
  {
    id: 'guidelines',
    selector: '[data-onboarding="guidelines-button"]',
    tag: 'SPIELREGELN', tagColor: '#d97706',
    title: 'Was kann eingetragen werden?',
    text: 'Hier findest du die Spielregeln: Welche Materialien, Projekte und Akteure in die Datenbank gehören — und was nicht. Die Plattform ist aktuell eine Beta-Version und lebt von deiner Beteiligung!',
    detail: 'Die Materialdatenbank sammelt vor allem Bau- und Werkstoffe im Kontext von Kreislaufwirtschaft, dazu passende Projekte und beteiligte Akteure. Ohne Login kannst du alles ansehen — zum Eintragen oder Anfragen brauchst du einen kostenlosen Account.',
    requiresPage: '/',
    skipOnMobile: false,
  },
  {
    id: 'explore-map',
    selector: '[data-onboarding="explore-map"]',
    tag: 'NETZWERK', tagColor: '#0033FF',
    title: 'Die Karte zeigt das Netzwerk',
    text: 'Auf der Karte siehst du alle Materialien, Projekte und Akteure mit ihrem Standort. Wähle einen Eintrag aus, um die Verbindungen zu sehen — welche Projekte welche Materialien nutzen und mit welchen Akteuren sie verbunden sind.',
    detail: 'Die farbigen Linien zwischen den Einträgen zeigen die Verbindungen: Welches Projekt nutzt welches Material? Welcher Akteur ist an welchem Projekt beteiligt? So wird die regionale Kreislaufwirtschaft sichtbar. Du kannst zwischen Karten- und Listenansicht umschalten.',
    requiresPage: '/',
    skipOnMobile: false,
  },
  {
    id: 'explore-filters',
    selector: '[data-onboarding="explore-filters"]',
    tag: 'FILTER', tagColor: '#639530',
    title: 'Filtere nach Typ',
    text: 'Blende gezielt Materialien, Projekte oder Akteure ein und aus. Mit „Nur verfügbare" siehst du nur Einträge, die aktuell angefragt werden können.',
    detail: 'Jeder Typ hat eine eigene Farbe: Materialien sind blau, Projekte grün, Akteure rot. Diese Farbcodierung findest du überall in der App wieder — auf der Karte, in den Karten und in der Navigation.',
    requiresPage: '/',
    skipOnMobile: false,
  },
  {
    id: 'entity-list',
    selector: '[data-onboarding="entity-list"]',
    tag: 'EINTRÄGE', tagColor: '#0033FF',
    title: 'Materialien, Projekte & Akteure',
    text: 'Jeder Eintrag erscheint als Karte mit Bild, Standort und den wichtigsten Infos. Klicke eine Karte an, um sie auf der Karte hervorzuheben. Klicke auf „Details", um die vollständige Beschreibung zu öffnen.',
    detail: 'Materialien zeigen Kategorie, verfügbare Menge und GWP-Wert (CO₂-Fußabdruck). Projekte zeigen die verwendeten Materialien und beteiligten Akteure. Bei verfügbaren Materialien siehst du den orangefarbenen „verfügbar"-Badge.',
    requiresPage: '/',
    skipOnMobile: false,
  },
  {
    id: 'nav-materials',
    selector: '[data-onboarding="nav-materials"]',
    tag: 'MATERIALIEN', tagColor: '#0033FF',
    title: 'Alle Materialien im Überblick',
    text: 'Hier findest du die vollständige Liste aller eingetragenen Materialien mit Suchfunktion und Kategorie-Filter. Du kannst zwischen Listen- und Kartenansicht wechseln.',
    detail: 'Materialien enthalten technische Daten wie Druckfestigkeit, Zugfestigkeit, VOC-Werte und Zertifizierungen (EPD, Cradle to Cradle, FSC/PEFC). Außerdem ist dokumentiert, ob ein Material wiederverwendbar, übertragbar oder verschenkbar ist und ob es für Innen- oder Außeneinsatz geeignet ist.',
    requiresPage: null,
    skipOnMobile: true, // desktop-only nav, skip on mobile to avoid 3s timeout
  },
  {
    id: 'account-button',
    selector: '[data-onboarding="account-button"]',
    tag: 'MITMACHEN', tagColor: '#FF3B36',
    title: 'Ansehen frei — Mitmachen mit Login',
    text: 'Du kannst alle Materialien, Projekte und Akteure frei durchstöbern — ganz ohne Account. Um selbst Materialien einzutragen, Angebote anzufragen oder Nachrichten zu senden, brauchst du einen kostenlosen Login.',
    detail: 'Mit einem Account kannst du: eigene Materialien und Projekte anlegen, Materialangebote erstellen und anfragen, Nachrichten an andere Nutzer:innen senden, eingehende Anfragen verwalten und Push-Benachrichtigungen aktivieren. Die Registrierung ist kostenlos und dauert nur wenige Sekunden.',
    requiresPage: null,
    skipOnMobile: false,
  },
  {
    id: 'nav-messages',
    selector: '[data-onboarding="nav-messages"]',
    tag: 'KOMMUNIKATION', tagColor: '#0033FF',
    title: 'Nachrichten & Materialanfragen',
    text: 'Im Nachrichtenbereich empfängst und sendest du Nachrichten an andere Nutzer:innen. Materialanfragen laufen ebenfalls hier zusammen — du siehst den Status jeder Anfrage (ausstehend, angenommen, reserviert, abgeschlossen).',
    detail: 'Wenn jemand ein Material von dir anfragen möchte, erhältst du eine Benachrichtigung. Im Account-Bereich findest du deine eingehenden Anfragen, kannst sie annehmen, ablehnen oder als abgeholt markieren. Eine Mengenleiste zeigt dir, wie viel deines Materials noch verfügbar, reserviert oder bereits abgeholt ist.',
    requiresPage: null,
    skipOnMobile: true,
  },
  {
    id: 'create-button',
    selector: '[data-onboarding="create-button"]',
    tag: 'BEITRAGEN', tagColor: '#639530',
    title: 'Trage selbst etwas ein',
    text: 'Über diesen Button kannst du neue Materialien, Projekte oder Akteure anlegen. So trägst du aktiv zur regionalen Kreislaufwirtschaft bei.',
    detail: 'Beim Erstellen eines Materials kannst du direkt ein Materialangebot mit Menge und Standort anlegen. Projekte können mit vorhandenen Materialien und Akteuren verknüpft werden, wodurch automatisch Netzwerk-Verbindungen auf der Karte entstehen. Für alle Einträge kannst du Bilder und Dateien hochladen.',
    requiresPage: '/',
    skipOnMobile: false,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSpot(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left - SPOT_PAD, y: r.top - SPOT_PAD, w: r.width + SPOT_PAD * 2, h: r.height + SPOT_PAD * 2 };
}

function getTipPos(spot) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 768) return null; // mobile → bottom sheet

  const tw = vw >= 1024 ? 380 : 340;
  const spaceBelow = vh - spot.y - spot.h - TIP_OFFSET;
  const spaceAbove = spot.y - TIP_OFFSET;
  const placeBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;

  let top = placeBelow
    ? spot.y + spot.h + TIP_OFFSET
    : Math.max(12, spot.y - TIP_OFFSET - 290);
  top = Math.max(12, Math.min(vh - 160, top));

  const left = Math.max(12, Math.min(vw - tw - 12, spot.x + spot.w / 2 - tw / 2));
  return { top, left, width: tw };
}

function isExplore(pathname) {
  return pathname === '/' || pathname === '/explore';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoachMarks() {
  const { isActive, step, setStep, complete, restart, hasOnboarded } = useOnboarding();
  const location = useLocation();

  const [spot, setSpot]           = useState(null);
  const [tipPos, setTipPos]       = useState(null);
  const [searching, setSearching] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [infoBtnVisible, setInfoBtnVisible] = useState(false);
  const [infoBtnAnimate, setInfoBtnAnimate] = useState(false);

  const waitRef = useRef(null);
  const currentStep = STEPS[step];

  // Show animated info button whenever tour is done
  useEffect(() => {
    if (!isActive && hasOnboarded) {
      const t = setTimeout(() => {
        setInfoBtnVisible(true);
        setInfoBtnAnimate(true);
        setTimeout(() => setInfoBtnAnimate(false), 2200);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isActive, hasOnboarded]);

  // ── Core: find target element for current step ────────────────────────────
  useEffect(() => {
    if (!isActive || !currentStep) return;

    if (waitRef.current) clearTimeout(waitRef.current);
    setShowDetail(false);

    const isMobile = window.innerWidth < 768;

    // Immediately skip steps that can't show on this device/page
    const skipNow =
      (currentStep.skipOnMobile && isMobile) ||
      (currentStep.requiresPage === '/' && !isExplore(location.pathname));

    if (skipNow) {
      const next = step + 1;
      if (next >= STEPS.length) complete();
      else setStep(next);
      return;
    }

    setSearching(true);
    let attempts = 0;
    const maxAttempts = Math.ceil(WAIT_MS / 100);

    const tryFind = () => {
      const el = document.querySelector(currentStep.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) {
          const s = getSpot(el);
          setSpot(s);
          setTipPos(getTipPos(s));
          setSearching(false);
          return;
        }
      }
      attempts++;
      if (attempts >= maxAttempts) {
        // Element not found — skip step
        setSearching(false);
        const next = step + 1;
        if (next >= STEPS.length) complete();
        else setStep(next);
        return;
      }
      waitRef.current = setTimeout(tryFind, 100);
    };

    tryFind();
    return () => { if (waitRef.current) clearTimeout(waitRef.current); };
  }, [step, isActive, location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep spotlight in sync with resize / scroll ───────────────────────────
  useEffect(() => {
    if (!isActive || !currentStep || searching) return;
    const update = () => {
      const el = document.querySelector(currentStep.selector);
      if (!el) return;
      const s = getSpot(el);
      setSpot(s);
      setTipPos(getTipPos(s));
    };
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('scroll', update, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isActive, currentStep, searching]);

  // ── External restart trigger (from footer button) ─────────────────────────
  useEffect(() => {
    const handler = () => restart();
    window.addEventListener('rzz:restartOnboarding', handler);
    return () => window.removeEventListener('rzz:restartOnboarding', handler);
  }, [restart]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const handler = (e) => {
      if (e.key === 'Escape')      complete();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft')  handlePrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }); // no deps → always latest closures

  const handleNext = useCallback(() => {
    if (step >= STEPS.length - 1) complete();
    else setStep((s) => s + 1);
  }, [step, complete, setStep]);

  const handlePrev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step, setStep]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isActive && !infoBtnVisible) return null;

  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
  const lastStep = step >= STEPS.length - 1;

  const tooltipStyle = isMobileView
    ? { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9995 }
    : tipPos
      ? { position: 'fixed', top: tipPos.top, left: tipPos.left, width: tipPos.width, zIndex: 9995 }
      : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 380, zIndex: 9995 };

  return createPortal(
    <>
      {/* ── Active tour ── */}
      {isActive && (
        <>
          {/* Click-to-skip backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9990, cursor: 'default' }}
            onClick={complete}
            aria-hidden="true"
          />

          {/* Spotlight / dark overlay */}
          {spot ? (
            <>
              {/* Hole-punch spotlight using box-shadow */}
              <div
                style={{
                  position: 'fixed',
                  left: spot.x, top: spot.y,
                  width: spot.w, height: spot.h,
                  borderRadius: 12,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
                  transition: 'left .35s ease-out, top .35s ease-out, width .35s ease-out, height .35s ease-out',
                  zIndex: 9991,
                  pointerEvents: 'none',
                }}
              />
              {/* Animated pulse ring */}
              <div
                style={{
                  position: 'fixed',
                  left: spot.x - 5, top: spot.y - 5,
                  width: spot.w + 10, height: spot.h + 10,
                  borderRadius: 17,
                  border: '2px solid rgba(255,255,255,0.55)',
                  animation: 'coachPulse 1.8s ease-in-out infinite',
                  transition: 'left .35s ease-out, top .35s ease-out, width .35s ease-out, height .35s ease-out',
                  zIndex: 9992,
                  pointerEvents: 'none',
                }}
              />
            </>
          ) : (
            /* Full dark overlay while loading */
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9991, pointerEvents: 'none' }}
            />
          )}

          {/* Tooltip */}
          {currentStep && (
            <div
              style={tooltipStyle}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={currentStep.title}
            >
              <div className={
                isMobileView
                  ? 'bg-white rounded-t-2xl shadow-2xl px-5 pt-5 pb-7 max-h-[72vh] overflow-y-auto'
                  : 'bg-white rounded-2xl shadow-2xl p-5'
              }>
                {/* Mobile drag handle */}
                {isMobileView && (
                  <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
                )}

                {/* Tag + close button */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full"
                    style={{ background: `${currentStep.tagColor}1a`, color: currentStep.tagColor }}
                  >
                    {currentStep.tag}
                  </span>
                  <button
                    onClick={complete}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                    aria-label="Tour überspringen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Loading state */}
                {searching ? (
                  <div className="flex items-center gap-3 py-4">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin flex-shrink-0" />
                    <span className="text-sm text-gray-500">Element wird gesucht …</span>
                  </div>
                ) : (
                  <>
                    {/* Title */}
                    <h3 className="text-[15px] font-bold text-gray-900 mb-2 leading-snug">
                      {currentStep.title}
                    </h3>

                    {/* Main text */}
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">
                      {currentStep.text}
                    </p>

                    {/* Expandable detail */}
                    {currentStep.detail && (
                      <div className="mb-4">
                        <button
                          onClick={() => setShowDetail((v) => !v)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showDetail
                            ? <><ChevronUp className="w-3.5 h-3.5" /> Details ausblenden</>
                            : <><ChevronDown className="w-3.5 h-3.5" /> + Details anzeigen</>
                          }
                        </button>
                        {showDetail && (
                          <p
                            className="mt-2.5 text-xs text-gray-500 leading-relaxed pl-3 border-l-2"
                            style={{ borderColor: currentStep.tagColor }}
                          >
                            {currentStep.detail}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Dot progress indicators */}
                <div className="flex items-center justify-center gap-1.5 mb-4">
                  {STEPS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      aria-label={`Schritt ${i + 1} von ${STEPS.length}`}
                      style={{
                        width: i === step ? 20 : 8,
                        height: 8,
                        borderRadius: 9999,
                        background: i === step ? currentStep.tagColor : '#d1d5db',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        transition: 'width .25s ease, background .25s ease',
                      }}
                    />
                  ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={complete}
                    className="text-xs text-gray-400 hover:text-gray-500 transition-colors mr-auto"
                  >
                    Überspringen
                  </button>

                  {step > 0 && (
                    <button
                      onClick={handlePrev}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Zurück
                    </button>
                  )}

                  <button
                    onClick={handleNext}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: currentStep.tagColor }}
                  >
                    {lastStep ? 'Loslegen ✦' : <> Nächster <ChevronRight className="w-4 h-4" /> </>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Info button (repeat tour) ── */}
      {!isActive && infoBtnVisible && (
        <button
          onClick={restart}
          title="Einführungstour wiederholen"
          aria-label="Einführungstour wiederholen"
          className="fixed bottom-5 right-5 w-12 h-12 bg-white rounded-2xl shadow-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-primary-700 hover:border-primary-300 hover:shadow-lg transition-all"
          style={{
            zIndex: 9989,
            animation: infoBtnAnimate
              ? 'coachBounceIn 0.65s cubic-bezier(.34,1.56,.64,1) forwards, coachGlow 0.8s ease-in-out 0.7s 3'
              : 'none',
          }}
        >
          <Info className="w-5 h-5" />
        </button>
      )}
    </>,
    document.body
  );
}
