import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Trash2, Globe, Lock, Users, Building2, Loader2, Check } from 'lucide-react';
import api from '../../services/api';

const ENTITY_LABEL = { material: 'dieses Material', project: 'dieses Projekt' };

function visibilityOptions(entityType) {
  const noun = ENTITY_LABEL[entityType] || 'diesen Eintrag';
  return [
    { value: 'private',       label: 'Privat',      desc: `Nur du kannst ${noun} sehen.`,                       Icon: Lock      },
    { value: 'actor',         label: 'Akteur-Teams', desc: 'Mitglieder ausgewählter Akteure können es sehen.',  Icon: Building2 },
    { value: 'selectedUsers', label: 'Ausgewählte', desc: 'Nur Personen, die du direkt einlädst.',              Icon: Users     },
    { value: 'public',        label: 'Öffentlich',  desc: 'Für alle sichtbar (auch ohne Anmeldung).',           Icon: Globe     },
  ];
}

// Dropdown with fixed positioning to escape overflow:hidden parents
function UserSearch({ onSelect }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const inputRef = useRef(null);
  const debounce = useRef(null);

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    if (q.length < 2) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      updatePosition();
      try {
        const { data } = await api.get(`/shares/users/search?q=${encodeURIComponent(q)}`);
        setResults(data);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 280);
    return () => clearTimeout(debounce.current);
  }, [q]);

  const close = () => { setQ(''); setResults([]); };

  return (
    <div className="relative flex-1">
      <div className="relative">
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={updatePosition}
          placeholder="Name oder E-Mail suchen…"
          className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-stone-300"
        />
        {searching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-stone-400" />
        )}
      </div>

      {dropdownStyle && (results.length > 0 || (q.length >= 2 && !searching)) && (
        <div style={dropdownStyle} className="bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden">
          {results.length > 0 ? (
            <ul>
              {results.map(u => (
                <li key={u.id}>
                  <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); onSelect(u); close(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-stone-50 text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-xs font-semibold text-stone-600 flex-shrink-0">
                      {(u.first_name?.[0] || u.email[0]).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-stone-800 truncate">
                        {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
                      </p>
                      <p className="text-xs text-stone-400 truncate">{u.email}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-stone-400 px-3 py-2">Keine Nutzer gefunden.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Multi-select actor picker
function ActorMultiSelect({ selected, onChange }) {
  const [actors, setActors] = useState([]);
  useEffect(() => {
    api.get('/actors').then(r => setActors(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  if (!actors.length) return <p className="text-xs text-stone-400">Keine Akteure vorhanden.</p>;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {actors.map(a => (
        <button
          key={a.id}
          type="button"
          onClick={() => toggle(a.id)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            selected.includes(a.id)
              ? 'bg-stone-800 text-white border-stone-800'
              : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
          }`}
        >
          {a.name}
        </button>
      ))}
    </div>
  );
}

export default function ShareDialog({ entityType = 'material', entityId, currentVisibility = 'private', isOwner, onClose, onVisibilityChange }) {
  const [visibility, setVisibility] = useState(currentVisibility);
  const [shares, setShares] = useState([]);
  const [sharedActors, setSharedActors] = useState([]);
  const [accessLevel, setAccessLevel] = useState('view');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Multi-actor sharing (material_shared_actors) only exists for materials —
  // projects configure their single share_actor_id via the main project form.
  const supportsActorMultiShare = entityType === 'material';

  useEffect(() => {
    if (!isOwner) return;
    setLoading(true);
    Promise.all([
      api.get(`/shares/${entityType}/${entityId}`).then(r => r.data).catch(() => []),
      supportsActorMultiShare
        ? api.get(`/shares/${entityType}/${entityId}/actors`).then(r => r.data.map(a => a.id)).catch(() => [])
        : Promise.resolve([]),
    ]).then(([s, a]) => { setShares(s); setSharedActors(a); }).finally(() => setLoading(false));
  }, [entityType, entityId, isOwner, supportsActorMultiShare]);

  const handleVisibilityChange = async (v) => {
    setVisibility(v);
    setSaving(true);
    try {
      await api.put(`/${entityType}s/${entityId}`, { visibility: v });
      onVisibilityChange?.(v);
    } catch {
      setError('Sichtbarkeit konnte nicht gespeichert werden.');
    } finally { setSaving(false); }
  };

  const handleActorsChange = async (actorIds) => {
    setSharedActors(actorIds);
    try {
      await api.put(`/shares/${entityType}/${entityId}/actors`, { actor_ids: actorIds });
    } catch { setError('Akteur-Freigaben konnten nicht gespeichert werden.'); }
  };

  const addShare = async (user) => {
    setError(null);
    try {
      const { data } = await api.post(`/shares/${entityType}/${entityId}`, { email: user.email, access_level: accessLevel });
      setShares(prev => [...prev.filter(s => s.shared_with_user_id !== data.shared_with_user_id), data]);
    } catch (e) { setError(e.response?.data?.message || 'Freigabe fehlgeschlagen.'); }
  };

  const removeShare = async (userId) => {
    try {
      await api.delete(`/shares/${entityType}/${entityId}/${userId}`);
      setShares(prev => prev.filter(s => s.shared_with_user_id !== userId));
    } catch { setError('Freigabe konnte nicht entfernt werden.'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-base font-semibold text-stone-800">Sichtbarkeit & Freigabe</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 rounded-lg p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-5 overflow-y-auto">
          {/* Visibility picker */}
          {isOwner && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Sichtbarkeit</p>
              {visibilityOptions(entityType).map(({ value, label, desc, Icon }) => (
                <button key={value} onClick={() => handleVisibilityChange(value)}
                  className={`flex items-start gap-3 text-left rounded-xl px-3 py-2.5 border transition-colors ${
                    visibility === value ? 'bg-stone-50 border-stone-300' : 'border-transparent hover:bg-stone-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${visibility === value ? 'text-stone-700' : 'text-stone-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${visibility === value ? 'text-stone-800' : 'text-stone-600'}`}>{label}</p>
                    <p className="text-xs text-stone-400">{desc}</p>
                  </div>
                  {visibility === value && !saving && <Check className="w-4 h-4 text-stone-500 mt-0.5 flex-shrink-0" />}
                  {saving && visibility === value && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400 flex-shrink-0 mt-0.5" />}
                </button>
              ))}

              {/* Actor multi-select (when visibility = actor) — materials only;
                  projects pick their single Akteur in the main project form. */}
              {visibility === 'actor' && supportsActorMultiShare && (
                <div className="mt-1 px-1">
                  <p className="text-xs text-stone-500 mb-1">Akteure mit Zugriff:</p>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                  ) : (
                    <ActorMultiSelect selected={sharedActors} onChange={handleActorsChange} />
                  )}
                </div>
              )}
              {visibility === 'actor' && !supportsActorMultiShare && (
                <p className="mt-1 px-1 text-xs text-stone-400">
                  Welcher Akteur Zugriff hat, legst du im Projekt-Formular unter „Sichtbarkeit" fest.
                </p>
              )}
            </div>
          )}

          {/* Direct user shares */}
          {isOwner && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Direkte Freigaben</p>

              {loading ? (
                <div className="flex items-center gap-2 text-xs text-stone-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Lädt…</div>
              ) : shares.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {shares.map(s => (
                    <li key={s.shared_with_user_id} className="flex items-center gap-2 py-1">
                      <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-xs font-semibold text-stone-600 flex-shrink-0">
                        {(s.first_name?.[0] || s.email?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-700 truncate">
                          {[s.first_name, s.last_name].filter(Boolean).join(' ') || s.email}
                        </p>
                        <p className="text-xs text-stone-400 truncate">{s.email}</p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        s.access_level === 'edit' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {s.access_level === 'edit' ? 'Bearbeiten' : 'Lesen'}
                      </span>
                      <button onClick={() => removeShare(s.shared_with_user_id)} className="text-stone-300 hover:text-red-400 flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-stone-400">Noch keine direkten Freigaben.</p>
              )}

              <div className="flex gap-2 items-center">
                <select value={accessLevel} onChange={e => setAccessLevel(e.target.value)}
                  className="text-sm border border-stone-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-stone-300 bg-white flex-shrink-0">
                  <option value="view">Lesen</option>
                  <option value="edit">Bearbeiten</option>
                </select>
                <UserSearch onSelect={addShare} />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}
