import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';

/**
 * /callback — landing page after Zitadel redirects back with the auth code.
 *
 * The AuthProvider in main.jsx processes the OIDC redirect automatically.
 * This component just waits for the auth state to settle and then
 * navigates to the original destination (or home).
 */
export default function Callback() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.isLoading && !auth.error) {
      // Retrieve the destination saved before the redirect, fall back to home
      const returnTo = sessionStorage.getItem('oidc_return_to') || '/';
      sessionStorage.removeItem('oidc_return_to');
      navigate(returnTo, { replace: true });
    }
  }, [auth.isLoading, auth.error, navigate]);

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Completing login…</p>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 font-mono text-sm">
        <p className="text-red-600 font-semibold text-base">Login error: {auth.error.message}</p>
        <pre className="bg-gray-100 border rounded p-4 text-xs text-gray-700 max-w-xl w-full whitespace-pre-wrap">
          {JSON.stringify(
            {
              error: auth.error.message,
              name: auth.error.name,
              redirect_uri: `${window.location.origin}/callback`,
              authority: import.meta.env.VITE_ZITADEL_AUTHORITY || '(not set)',
              current_url: window.location.href,
            },
            null,
            2
          )}
        </pre>
        <a href="/auth-debug" className="text-blue-600 underline text-xs">
          Open full diagnostics →
        </a>
      </div>
    );
  }

  return null;
}
