import { create } from 'zustand';

export const useGuidelinesStore = create((set) => ({
  isOpen: false,
  open:  () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
