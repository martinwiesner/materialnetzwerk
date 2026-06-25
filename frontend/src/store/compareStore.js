import { create } from 'zustand';

const MAX_ITEMS = 4;

export const useCompareStore = create((set, get) => ({
  type: null,       // 'materials' | 'projects' | null
  ids: [],
  items: [],        // full objects cached after fetch

  toggle: (type, id) => {
    const { type: curType, ids } = get();
    // type mismatch → reset first
    if (curType && curType !== type) {
      set({ type, ids: [id], items: [] });
      return;
    }
    if (ids.includes(id)) {
      const next = ids.filter((i) => i !== id);
      set({ ids: next, type: next.length ? type : null, items: [] });
    } else {
      if (ids.length >= MAX_ITEMS) return;
      set({ type, ids: [...ids, id], items: [] });
    }
  },

  setItems: (items) => set({ items }),

  clear: () => set({ type: null, ids: [], items: [] }),

  isSelected: (id) => get().ids.includes(id),

  canAdd: (type) => {
    const { type: curType, ids } = get();
    if (ids.length >= MAX_ITEMS) return false;
    if (curType && curType !== type) return false;
    return true;
  },
}));
