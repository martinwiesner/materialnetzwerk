import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { oidcConfig } from '../../auth/oidcConfig';

/**
 * /auth-debug — production diagnostics page for Zitadel login issues.
 * Shows baked-in OIDC config, current auth state, and backend /api/auth/me result.
 * No secrets are exposed (access token is not rendered).
 */
export default function AuthDebug() {
  const auth = useAuth();
  const [apiResult, setApiResult] = useState(null);

  useEffect(() => {
    const headers = {};
    if (auth.user?.access_token) {
      headers.Authorization = `Bearer ${auth.user.access_token}`;
    }
    fetch('/api/auth/me', { headers })
      .then((r) => r.json().then((d) => ({ status: r.status, body: d })))
      .catch((e) => ({ error: e.message }))
      .then(setApiResult);
  }, [auth.user]);

  const config = {
    authority: oidcConfig.authority || '(not set — VITE_ZITADEL_AUTHORITY missing)',
    client_id: oidcConfig.client_id || '(not set — VITE_ZITADEL_CLIENT_ID missing)',
    redirect_uri: oidcConfig.redirect_uri,
    silent_redirect_uri: oidcConfig.silent_redirect_uri,
    scope: oidcConfig.scope,
    window_origin: window.location.origin,
  };

  const authState = {
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    error: auth.error
      ? { message: auth.error.message, name: auth.error.name }
      : null,
  };

  const userInfo = auth.isAuthenticated
    ? {
        sub: auth.user?.profile?.sub,
        email: auth.user?.profile?.email,
        name: auth.user?.profile?.name,
        expires_at: auth.user?.expires_at
          ? new Date(auth.user.expires_at * 1000).toISOString()
          : null,
        expired: auth.user?.expired,
        scopes: auth.user?.scope,
        token_type: auth.user?.token_type,
      }
    : null;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-mono text-sm">
      <h1 className="text-xl font-bold mb-2 text-gray-800">Auth Diagnostics</h1>
      <p className="text-xs text-gray-500 mb-8">
        No secrets are exposed on this page. The access token is never rendered.
      </p>

      <Section title="OIDC Configuration (baked at build time)">
        <Pre data={config} />
      </Section>

      <Section title="Auth State">
        <Pre data={authState} />
      </Section>

      {userInfo && (
        <Section title="OIDC User">
          <Pre data={userInfo} />
        </Section>
      )}

      <Section title="Backend /api/auth/me">
        <Pre data={apiResult ?? 'loading…'} />
      </Section>

      <div className="flex flex-wrap gap-3 mt-6">
        <button
          onClick={() => auth.signinRedirect()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Trigger Login (redirect)
        </button>
        {auth.isAuthenticated && (
          <>
            <button
              onClick={() => auth.signinSilent().catch(() => {})}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Test Silent Renew
            </button>
            <button
              onClick={() => auth.removeUser()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Clear Session
            </button>
          </>
        )}
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="font-semibold text-gray-500 uppercase text-xs tracking-wider mb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Pre({ data }) {
  return (
    <pre className="bg-white border border-gray-200 rounded p-4 overflow-x-auto text-xs text-gray-800 whitespace-pre-wrap">
      {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}
