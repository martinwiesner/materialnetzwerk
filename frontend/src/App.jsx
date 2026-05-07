import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { useAuthStore } from './store/authStore';
import { authService } from './services/authService';

// Layout
import Layout from './components/Layout';

// Auth pages
import Callback from './pages/auth/Callback';

// Main pages
import Materials from './pages/materials/Materials';
import MaterialDetail from './pages/materials/MaterialDetail';
import Projects from './pages/projects/Projects';
import ProjectDetail from './pages/projects/ProjectDetail';
import Messages from './pages/messages/Messages';
import Marketplace from './pages/marketplace/Marketplace';
import Explore from './pages/explore/Explore';
import Actors from './pages/actors/Actors';

// Redirect unauthenticated users to Zitadel login
function ProtectedRoute({ children }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) return null;

  if (!auth.isAuthenticated) {
    // Save intended destination so Callback can redirect there after login
    sessionStorage.setItem('oidc_return_to', `${location.pathname}${location.search}`);
    auth.signinRedirect();
    return null;
  }

  return children;
}

/**
 * Syncs the OIDC library state → local Zustand store.
 * After Zitadel login succeeds, fetches the local user profile from /api/auth/me
 * (which also creates the user row on first login).
 */
function OidcSync() {
  const auth = useAuth();
  const { setUser, logout } = useAuthStore();

  useEffect(() => {
    const loader = document.getElementById('app-loader');

    if (auth.isLoading) return;

    if (auth.isAuthenticated) {
      authService
        .getMe()
        .then(setUser)
        .catch(() => {
          auth.removeUser();
          logout();
        })
        .finally(() => {
          if (loader) loader.classList.add('hidden');
        });
    } else {
      logout();
      if (loader) loader.classList.add('hidden');
    }
  }, [auth.isAuthenticated, auth.isLoading]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <OidcSync />
      <Routes>
        {/* OIDC callback — Zitadel redirects here after login */}
        <Route path="/callback" element={<Callback />} />

        {/* Main app routes (public by default) */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Explore />} />
          <Route path="explore" element={<Explore />} />
          <Route path="materials" element={<Materials />} />
          <Route path="materials/:id" element={<MaterialDetail />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="messages" element={<Messages />} />
          <Route path="actors" element={<Actors />} />
          {/* Legacy routes */}
          <Route path="offers" element={<Navigate to="/" replace />} />
          <Route path="marketplace" element={<Navigate to="/" replace />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
