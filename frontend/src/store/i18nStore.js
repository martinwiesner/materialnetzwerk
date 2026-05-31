import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useLangStore = create(
  persist(
    (set) => ({
      lang: 'de',
      setLang: (lang) => set({ lang }),
    }),
    {
      name: 'rzz-lang',
      partialize: (s) => ({ lang: s.lang }),
    }
  )
);
