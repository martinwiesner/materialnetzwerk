import { useRef, useState } from 'react';
import api from '../../services/api';

export default function AiAnalyzeButton({ mode = 'material', onResult, onImages, label, hint, multiple = true }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setLoading(true);
    setError('');
    if (onImages) onImages(files);
    try {
      const form = new FormData();
      form.append('mode', mode);
      for (const f of files) form.append('images', f);
      const { data: resp } = await api.post('/ai/analyze', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onResult(resp.data);
    } catch (e) {
      setError(e.response?.data?.message ?? 'Analyse fehlgeschlagen');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              KI analysiert…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4"/>
                <path d="M12 10v4M8 14h8M6 18h12M4 22h16"/>
              </svg>
              {label ?? 'Mit KI ausfüllen'}
            </>
          )}
        </button>
        {hint !== false && (
          <span className="text-xs text-gray-400">{hint ?? 'Bild(er) hochladen → Felder werden vorausgefüllt'}</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(Array.from(e.target.files || []))}
      />

      {error && (
        <p className="text-xs text-red-500 mt-0.5">⚠ {error}</p>
      )}
    </div>
  );
}
