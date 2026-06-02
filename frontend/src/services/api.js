import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Both in Docker (nginx proxy) and dev (Vite proxy):
// /api → backend, /uploads → backend — all relative, no absolute URL needed.
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

export const MEDIA_BASE = ''; // images via /uploads/... → proxied by nginx or Vite

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Decode JWT payload without verifying signature (client-side expiry check only)
function jwtExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp && payload.exp * 1000 < Date.now();
  } catch { return false; }
}

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const { token, logout } = useAuthStore.getState();
    if (token) {
      if (jwtExpired(token)) {
        logout();
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const { _hydrated, isAuthenticated, logout } = useAuthStore.getState();
      // Only logout if the store has been fully hydrated from localStorage.
      // On iOS PWA relaunch, requests can fire before hydration completes —
      // those 401s must not wipe the stored credentials.
      if (_hydrated && isAuthenticated) {
        logout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
