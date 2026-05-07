import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { Leaf } from 'lucide-react';

/**
 * /login — immediately redirects to Zitadel hosted login page.
 * Registration is also handled by Zitadel, so this covers both flows.
 */
export default function Login() {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      auth.signinRedirect();
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 flex flex-col items-center gap-6">
        <div className="bg-primary-500 p-3 rounded-full">
          <Leaf className="w-8 h-8 text-white" />
        </div>
        <p className="text-gray-500 text-sm">Redirecting to login…</p>
      </div>
    </div>
  );
}
