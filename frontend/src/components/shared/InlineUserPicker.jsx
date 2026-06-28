import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import api from '../../services/api';

// Floating dropdown, escapes overflow:hidden parents via fixed positioning
function UserDropdown({ q, inputRef, results, searching, onSelect }) {
  const [style, setStyle] = useState(null);

  useEffect(() => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setStyle({ top: r.bottom + 4, left: r.left, width: r.width, position: 'fixed', zIndex: 9999 });
  }, [q]);

  if (!style || q.length < 2) return null;
  if (!searching && results.length === 0) return (
    <div style={style} className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs text-gray-400">
      Keine Nutzer gefunden.
    </div>
  );
  if (!results.length) return null;

  return (
    <div style={style} className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
      {results.map(u => (
        <button key={u.id} type="button"
          onMouseDown={e => { e.preventDefault(); onSelect(u); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 text-left"
        >
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
            {(u.first_name?.[0] || u.email[0]).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-800 truncate">{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}</p>
            <p className="text-xs text-gray-400 truncate">{u.email}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function InlineUserPicker({ selected = [], onChange }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const debounce = useRef(null);

  useEffect(() => {
    clearTimeout(debounce.current);
    if (q.length < 2) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/shares/users/search?q=${encodeURIComponent(q)}`);
        setResults(data.filter(u => !selected.some(s => s.id === u.id)));
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [q, selected]);

  const add = (u) => {
    onChange([...selected, { id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name }]);
    setQ('');
    setResults([]);
  };

  const remove = (id) => onChange(selected.filter(u => u.id !== id));

  return (
    <div className="space-y-2">
      {/* Selected user chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(u => (
            <span key={u.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-xs border border-stone-200">
              <span className="w-4 h-4 rounded-full bg-stone-300 flex items-center justify-center text-[9px] font-bold text-stone-700 flex-shrink-0">
                {(u.first_name?.[0] || u.email[0]).toUpperCase()}
              </span>
              {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
              <button type="button" onClick={() => remove(u.id)}
                className="ml-0.5 text-stone-400 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search row */}
      <div className="flex gap-2 relative">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Person suchen (Name oder E-Mail)…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-stone-300"
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />
          )}
          <UserDropdown
            q={q} inputRef={inputRef}
            results={results} searching={searching}
            onSelect={add}
          />
        </div>
      </div>
      <p className="text-xs text-gray-400">Tippe mindestens 2 Zeichen um Nutzer zu suchen.</p>
    </div>
  );
}
