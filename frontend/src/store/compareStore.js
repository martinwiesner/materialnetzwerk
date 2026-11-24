import { create } from 'zustand';

export const MAX_ITEMS = 4;

export const useCompareStore = create((set, get) => ({
  type: null,       // 'materials' | 'projects' | null
  ids: [],
  names: {},        // { [id]: display name } — set on toggle so the bar never shows UUIDs
  items: [],        // full objects cached after fetch
  refEpds: [],      // ÖKOBAUDAT reference products in the material comparison
  adhocVariants: [],// single-material variants in the project comparison

  toggle: (type, id, name) => {
    const { type: curType, ids, names } = get();
    const nextNames = name ? { ...names, [id]: name } : names;
    // type mismatch → reset first
    if (curType && curType !== type) {
      set({ type, ids: [id], names: nextNames, items: [], refEpds: [], adhocVariants: [] });
      return;
    }
    if (ids.includes(id)) {
      const next = ids.filter((i) => i !== id);
      const extras = type === 'materials' ? get().refEpds.length : get().adhocVariants.length;
      set({ ids: next, type: next.length || extras ? type : null, names: nextNames });
    } else {
      if (ids.length >= MAX_ITEMS) return;
      set({ type, ids: [...ids, id], names: nextNames });
    }
  },

  setItems: (items) => set((s) => ({
    items,
    names: { ...s.names, ...Object.fromEntries(items.filter((i) => i?.id).map((i) => [i.id, i.name])) },
  })),

  setRefEpds: (refEpds) => set({ refEpds, type: get().type || (refEpds.length ? 'materials' : null) }),

  // ÖKOBAUDAT datasets always go into the material comparison
  addRefEpd: (entry) => {
    const { type, refEpds } = get();
    if (refEpds.some((e) => e.uuid === entry.uuid)) return;
    if (refEpds.length >= MAX_ITEMS) return;
    if (type === 'projects') set({ ids: [], items: [], adhocVariants: [] });
    set({ type: 'materials', refEpds: [...get().refEpds, entry] });
  },

  removeRefEpd: (uuid) => {
    const { ids, refEpds } = get();
    const next = refEpds.filter((e) => e.uuid !== uuid);
    set({ refEpds: next, type: ids.length || next.length ? 'materials' : null });
  },
  setAdhocVariants: (adhocVariants) => set({ adhocVariants }),

  // material comparison → project comparison with the given variants (recipes are added there)
  startRecipeCompare: (adhocVariants) =>
    set({ type: 'projects', ids: [], items: [], refEpds: [], adhocVariants }),

  clear: () => set({ type: null, ids: [], items: [], refEpds: [], adhocVariants: [] }),

  isSelected: (id) => get().ids.includes(id),

  canAdd: (type) => {
    const { type: curType, ids } = get();
    if (ids.length >= MAX_ITEMS) return false;
    if (curType && curType !== type) return false;
    return true;
  },
}));
