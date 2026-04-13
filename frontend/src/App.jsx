import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { authService } from './services/authService';

// Layout
import Layout from './components/Layout';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Main pages
import Materials from './pages/materials/Materials';
import MaterialDetail from './pages/materials/MaterialDetail';
import Projects from './pages/projects/Projects';
import ProjectDetail from './pages/projects/ProjectDetail';
import Messages from './pages/messages/Messages';
import Marketplace from './pages/marketplace/Marketplace';
import Explore from './pages/explore/Explore';
import Actors from './pages/actors/Actors';

// Protected route wrapper
function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const location = useLocation();
  
  if (!isAuthenticated || !token) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  
  return children;
}

// Public route wrapper (redirect if already authenticated)
function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  
  if (isAuthenticated && token) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

function AuthRefresh() {
  const { token, updateUser, logout } = useAuthStore();
  useEffect(() => {
    if (!token) return;
    authService.getMe()
      .then(updateUser)
      .catch(() => logout());
  }, [token, updateUser, logout]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthRefresh />
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

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

        {/* Catch all - redirect to marketplace */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
