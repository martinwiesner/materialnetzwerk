import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = (env.BACKEND_URL || env.VITE_API_URL || 'http://localhost:8081')
    .replace(/\/api\/?$/, '');

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      proxy: {
        '/api':     { target: backendUrl, changeOrigin: true },
        '/uploads': { target: backendUrl, changeOrigin: true },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
    },
  };
});
