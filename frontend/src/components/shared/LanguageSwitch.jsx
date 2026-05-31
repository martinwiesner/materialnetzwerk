import { useLangStore } from '../../store/i18nStore';

const LANGS = [
  { code: 'de', label: 'DE' },
  { code: 'en', label: 'EN' },
];

export default function LanguageSwitch() {
  const { lang, setLang } = useLangStore();

  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden select-none">
      {LANGS.map(({ code, label }, i) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className={[
            'px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors',
            i > 0 ? 'border-l border-gray-200' : '',
            lang === code
              ? 'bg-gray-900 text-white'
              : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50',
          ].join(' ')}
          aria-pressed={lang === code}
          aria-label={`Switch to ${label}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
