import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from 'react-oidc-context';
import { oidcConfig } from './auth/oidcConfig';
import App from './App';
import './index.css';
import 'leaflet/dist/leaflet.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

// After Zitadel redirects back, remove the OIDC params from the URL
// so the user sees a clean address bar.
const onSigninCallback = () => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider {...oidcConfig} onSigninCallback={onSigninCallback}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </AuthProvider>
  </React.StrictMode>
);
