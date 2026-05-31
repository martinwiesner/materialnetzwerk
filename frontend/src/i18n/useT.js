import { useLangStore } from '../store/i18nStore';
import de from './de';
import en from './en';

const dicts = { de, en };

function resolve(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

export function useT() {
  const lang = useLangStore((s) => s.lang);
  const dict = dicts[lang] ?? de;
  return (key, vars) => {
    let str = resolve(dict, key) ?? resolve(de, key) ?? key;
    if (vars && typeof str === 'string') {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return str;
  };
}

export function useLang() {
  return useLangStore((s) => s.lang);
}
