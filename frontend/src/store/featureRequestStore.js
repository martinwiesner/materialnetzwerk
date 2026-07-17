import { create } from 'zustand';

export const useFeatureRequestStore = create((set) => ({
  isOpen: false,
  open:  () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
