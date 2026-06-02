import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      // Becomes true once localStorage has been read. Used by the 401
      // interceptor to distinguish "genuinely logged out" from "not yet hydrated".
      _hydrated: false,

      setAuth: (user, token) =>
        set({ user, token, isAuthenticated: true }),

      updateUser: (user) =>
        set((state) => ({ ...state, user })),

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),

      _setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: 'auth-storage',
      // Persist token, user AND isAuthenticated so the app is ready immediately
      // on relaunch without needing a re-check.
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // localStorage is synchronous on web, so this fires before any React
        // render. Mark the store as hydrated so the 401 interceptor can trust
        // the isAuthenticated flag.
        if (state) state._setHydrated();
      },
    }
  )
);
