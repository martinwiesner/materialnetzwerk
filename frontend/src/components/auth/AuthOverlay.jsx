import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { X, Leaf, LogIn } from 'lucide-react';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';

/**
 * AuthOverlay — shown when an action requires authentication.
 *
 * Uses Zitadel popup sign-in so the user stays on the current page.
 * After the popup closes the local profile is fetched and handleSuccess fires.
 */
export default function AuthOverlay() {
  const { isOpen, reason, close, handleSuccess } = useAuthOverlayStore();
  const auth = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await auth.signinPopup();
      // Fetch local profile (creates row on first login)
      const user = await authService.getMe();
      setUser(user);
      handleSuccess();
    } catch (err) {
      if (err?.message !== 'Popup closed by user') {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/50" onClick={close} />

      <div className="absolute inset-y-0 right-0 w-full max-w-md">
        <div className="h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="bg-primary-500 p-2 rounded-lg">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Material Library</p>
                <p className="text-xs text-gray-500">Anmeldung erforderlich</p>
              </div>
            </div>
            <button onClick={close} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-col items-center justify-center flex-1 px-8 gap-6">
            {reason ? (
              <div className="w-full bg-primary-50 border border-primary-100 text-primary-800 rounded-lg p-3 text-sm text-center">
                {reason}
              </div>
            ) : null}

            <p className="text-gray-600 text-sm text-center">
              Bitte melde dich an, um fortzufahren.
            </p>

            {error ? (
              <p className="text-red-500 text-sm text-center">{error}</p>
            ) : null}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary-500 text-white py-3 px-6 rounded-xl font-medium hover:bg-primary-600 focus:ring-4 focus:ring-primary-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn className="w-5 h-5" />
              {loading ? 'Wird angemeldet…' : 'Mit Zitadel anmelden'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
