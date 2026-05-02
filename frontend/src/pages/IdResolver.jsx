import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * Resolves a RZZ-ID (e.g. RZZ-MAT-202605-0025) to the correct detail page.
 * Called by the route /id/:materialId — works in both dev and production
 * because it uses the /api proxy instead of relying on a backend redirect.
 */
export default function IdResolver() {
  const { materialId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!materialId) return;

    fetch(`/api/id/${materialId}`, {
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('not found');
        return res.json();
      })
      .then(({ redirect }) => {
        if (redirect) {
          navigate(redirect, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      })
      .catch(() => navigate('/', { replace: true }));
  }, [materialId, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center space-y-3">
        <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-mono">{materialId}</p>
        <p className="text-xs text-gray-400">Weiterleitung…</p>
      </div>
    </div>
  );
}
