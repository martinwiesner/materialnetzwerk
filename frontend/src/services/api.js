import axios from 'axios';
import { userManager } from '../auth/oidcConfig';

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

// Request interceptor: attach the Zitadel access token from the OIDC library
api.interceptors.request.use(
  async (config) => {
    const user = await userManager.getUser();
    if (user?.access_token) {
      config.headers.Authorization = `Bearer ${user.access_token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401, trigger a fresh Zitadel login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await userManager.signinRedirect();
    }
    return Promise.reject(error);
  }
);

export default api;
