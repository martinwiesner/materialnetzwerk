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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">Login error: {auth.error.message}</p>
      </div>
    );
  }

  return null;
}
