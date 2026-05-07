import { create } from 'zustand';

/**
 * Lightweight store for the local user profile (fetched from /api/auth/me
 * after Zitadel login).  The OIDC token itself is managed by oidc-client-ts;
 * we never store it here.
 */
export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: true }),

  updateUser: (user) => set({ user }),

  logout: () => set({ user: null, isAuthenticated: false }),
}));
