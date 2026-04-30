import { create } from 'zustand';

export const useAgbStore = create((set) => ({
  isOpen: false,
  open:  () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
