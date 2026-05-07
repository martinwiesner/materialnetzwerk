import { create } from 'zustand';

/**
 * A tiny UI store to show login/register as an overlay.
 * This keeps auth *navigation* optional (we still keep /login and /register routes for direct access).
 */
export const useAuthOverlayStore = create((set, get) => ({
  isOpen: false,
  initialTab: 'login', // 'login' | 'register'
  reason: '',
  onSuccess: null,

  open: ({ tab = 'login', reason = '', onSuccess = null } = {}) =>
    set({ isOpen: true, initialTab: tab, reason, onSuccess }),

  close: () => set({ isOpen: false, reason: '', onSuccess: null }),

  handleSuccess: () => {
    const cb = get().onSuccess;
    set({ isOpen: false, reason: '', onSuccess: null });
    if (typeof cb === 'function') cb();
  },
}));
