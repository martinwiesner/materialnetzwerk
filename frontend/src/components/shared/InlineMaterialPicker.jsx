import { useState, useEffect, useRef } from 'react';
import { X, Package2, Loader2 } from 'lucide-react';
import { materialService } from '../../services/materialService';

// Floating dropdown, escapes overflow:hidden parents via fixed positioning
function MaterialDropdown({ q, inputRef, results, searching, onSelect }) {
  const [style, setStyle] = useState(null);

  useEffect(() => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setStyle({ top: r.bottom + 4, left: r.left, width: r.width, position: 'fixed', zIndex: 9999 });
  }, [q]);

  if (!style || q.length < 2) return null;
  if (!searching && results.length === 0) return (
    <div style={style} className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs text-gray-400">
      Keine eigenen Materialien gefunden.
    </div>
  );
  if (!results.length) return null;

  return (
    <div style={style} className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
      {results.map(m => (
        <button key={m.id} type="button"
          onMouseDown={e => { e.preventDefault(); onSelect(m); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 text-left"
        >
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
            <Package2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-800 truncate">{m.name}</p>
            {m.category && <p className="text-xs text-gray-400 truncate">{m.category}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}

/**
 * Single-select "search my own materials and link one" input.
 * Props: value ({id, name} | null), onSelect(material), onClear()
 */
export default function InlineMaterialPicker({ value, onSelect, onClear }) {
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
        const { data } = await materialService.getAll({ search: q, my_materials: true });
        setResults(data || []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [q]);

  const select = (m) => {
    onSelect({ id: m.id, name: m.name });
    setQ('');
    setResults([]);
  };

  if (value) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-xs border border-stone-200">
        <Package2 className="w-3.5 h-3.5" />
        {value.name}
        <button type="button" onClick={onClear} className="ml-0.5 text-stone-400 hover:text-red-500">
          <X className="w-3 h-3" />
        </button>
      </span>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Eigenes Material suchen…"
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-stone-300"
      />
      {searching && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />
      )}
      <MaterialDropdown q={q} inputRef={inputRef} results={results} searching={searching} onSelect={select} />
    </div>
  );
}
