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

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
