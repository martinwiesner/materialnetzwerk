import { useEffect, useState } from 'react';
import { X, Package, FolderOpen, Users, Eye, FlaskConical, ChevronDown, ChevronUp, BookOpen, LogIn, ExternalLink } from 'lucide-react';
import { useGuidelinesStore } from '../../store/guidelinesStore';
import { useAgbStore } from '../../store/agbStore';
import { useAuthStore } from '../../store/authStore';
import { useSettings } from '../../hooks/useSettings';
import { useT } from '../../i18n/useT';

function parseList(jsonStr, fallback) {
  if (!jsonStr) return fallback;
  try { return JSON.parse(jsonStr); } catch { return fallback; }
}

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
          <span dangerouslySetInnerHTML={{ __html: item }} />
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
  const t = useT();
  const { isAuthenticated } = useAuthStore();
  const openAgb = useAgbStore((s) => s.open);
  const { data: settings } = useSettings();

  const introText = settings?.platform_intro ?? t('guidelines.defaults.intro');
  const introParagraphs = introText.split('\n').filter(Boolean);

  const materialsYes = parseList(settings?.guidelines_materials_yes, t('guidelines.defaults.materialsYes'));
  const materialsNo  = parseList(settings?.guidelines_materials_no,  t('guidelines.defaults.materialsNo'));
  const projectsYes  = parseList(settings?.guidelines_projects_yes,  t('guidelines.defaults.projectsYes'));
  const projectsNo   = parseList(settings?.guidelines_projects_no,   t('guidelines.defaults.projectsNo'));
  const actorsYes    = parseList(settings?.guidelines_actors_yes,    t('guidelines.defaults.actorsYes'));
  const actorsNo     = parseList(settings?.guidelines_actors_no,     t('guidelines.defaults.actorsNo'));

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
                <h2 className="text-base font-bold text-gray-900">{t('guidelines.title')}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                  Beta
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('guidelines.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors flex-shrink-0 ml-2"
            aria-label={t('guidelines.closeLabel')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

          {/* Platform intro text */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600 leading-relaxed space-y-2">
            {introParagraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {/* Three entity type mini-cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-start gap-1.5 bg-blue-50 rounded-xl p-3 border border-blue-100">
              <Package className="w-4 h-4 text-blue-600" />
              <p className="font-semibold text-blue-900 text-[12px]">{t('guidelines.entities.materials.name')}</p>
              <p className="text-blue-700 text-[11px] leading-snug">{t('guidelines.entities.materials.desc')}</p>
            </div>
            <div className="flex flex-col items-start gap-1.5 bg-green-50 rounded-xl p-3 border border-green-100">
              <FolderOpen className="w-4 h-4 text-green-700" />
              <p className="font-semibold text-green-900 text-[12px]">{t('guidelines.entities.projects.name')}</p>
              <p className="text-green-700 text-[11px] leading-snug">{t('guidelines.entities.projects.desc')}</p>
            </div>
            <div className="flex flex-col items-start gap-1.5 bg-red-50 rounded-xl p-3 border border-red-100">
              <Users className="w-4 h-4 text-red-600" />
              <p className="font-semibold text-red-900 text-[12px]">{t('guidelines.entities.actors.name')}</p>
              <p className="text-red-700 text-[11px] leading-snug">{t('guidelines.entities.actors.desc')}</p>
            </div>
          </div>

          {/* Login hint */}
          <div className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <LogIn className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-700">{t('guidelines.loginHintStrong')}</strong>
              {t('guidelines.loginHintSuffix')}
            </p>
          </div>

          {/* Rules heading */}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 pt-1">{t('guidelines.rulesHeading')}</p>

          <Section icon={Package} title={t('guidelines.sections.materials')} color="#0033FF" defaultOpen>
            <SubHeading>{t('guidelines.subHeadings.yes')}</SubHeading>
            <YesList items={materialsYes} />
            <SubHeading>{t('guidelines.subHeadings.no')}</SubHeading>
            <NoList items={materialsNo} />
            <SubHeading>{t('guidelines.subHeadings.quality')}</SubHeading>
            <YesList items={t('guidelines.qualityHints')} />
          </Section>

          <Section icon={FolderOpen} title={t('guidelines.sections.projects')} color="#639530">
            <SubHeading>{t('guidelines.subHeadings.yes')}</SubHeading>
            <YesList items={projectsYes} />
            <SubHeading>{t('guidelines.subHeadings.no')}</SubHeading>
            <NoList items={projectsNo} />
            <SubHeading>{t('guidelines.subHeadings.valuable')}</SubHeading>
            <YesList items={t('guidelines.valuableItems')} />
          </Section>

          <Section icon={Users} title={t('guidelines.sections.actors')} color="#FF3B36">
            <SubHeading>{t('guidelines.subHeadings.yes')}</SubHeading>
            <YesList items={actorsYes} />
            <SubHeading>{t('guidelines.subHeadings.no')}</SubHeading>
            <NoList items={actorsNo} />
          </Section>

          <Section icon={Eye} title={t('guidelines.sections.noLoginTitle')} color="#6366f1">
            <div className="grid sm:grid-cols-2 gap-3 mt-1">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{t('guidelines.subHeadings.noLogin')}</p>
                <YesList items={t('guidelines.noLoginItems')} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{t('guidelines.subHeadings.withAccount')}</p>
                <YesList items={t('guidelines.withAccountItems')} />
              </div>
            </div>
          </Section>

          <Section icon={FlaskConical} title={t('guidelines.sections.betaTitle')} color="#d97706">
            <div className="text-xs text-gray-600 leading-relaxed space-y-2">
              <p>{t('guidelines.betaIntro')}</p>
              <YesList items={t('guidelines.betaItems')} />
              <p className="mt-2 text-gray-500">
                {t('guidelines.betaFeedback')}{' '}
                <a href="mailto:martin.wiesner@hs-anhalt.de" className="underline hover:text-gray-700 transition-colors">
                  martin.wiesner@hs-anhalt.de
                </a>
              </p>
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button
            onClick={() => { onClose(); openAgb(); }}
            className="text-[11px] text-gray-400 hover:text-gray-600 underline transition-colors hidden sm:block"
          >
            {t('guidelines.footer.agb')}
          </button>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isAuthenticated && (
              <button
                onClick={openCreate}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary-700 hover:text-primary-800 border border-primary-200 hover:border-primary-300 rounded-lg px-3 py-2 transition-colors hover:bg-primary-50"
              >
                {t('guidelines.footer.submit')}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg px-4 py-2 hover:bg-gray-700 transition-colors"
            >
              {t('guidelines.footer.confirm')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
