import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Leaf, Loader2, Scale, FolderPlus, Info, Plus, BookMarked, ExternalLink, X, Search } from 'lucide-react';
import {
  BASE, DATASETS, proxyFetch, getName, extractEpdData, buildEpdEntry,
} from '../projects/OekobaudatPicker';
import { projectService } from '../../services/projectService';
import { useCompareStore, MAX_ITEMS } from '../../store/compareStore';
import { useToast } from '../../store/toastStore';
import { normLabel } from '../../utils/projectLca';
import { expandSearchTerm } from '../../utils/searchSynonyms';

const DS = DATASETS[0]; // 2023-I (aktuell)

const DATASET_TYPES = {
  'generic dataset':        'generisch',
  'specific dataset':       'herstellerspezifisch',
  'average dataset':        'Durchschnitt',
  'representative dataset': 'repräsentativ',
  'template dataset':       'Vorlage',
};

const EXTERNAL_SOURCES = [
  { label: 'EC3 (Building Transparency)', href: 'https://buildingtransparency.org/ec3' },
  { label: 'IBU – veröffentlichte EPDs',  href: 'https://ibu-epd.com/veroeffentlichte-epds/' },
  { label: 'ECO Platform',                href: 'https://www.eco-platform.org/epd-data.html' },
];

function fmtGwp(v) {
  if (v == null) return '–';
  const a = Math.abs(v);
  return v.toLocaleString('de-DE', { maximumFractionDigits: a >= 100 ? 0 : a >= 1 ? 2 : 4 });
}

async function searchProcesses(query) {
  const url = `${BASE}/datastocks/${DS.id}/processes?search=true&name=${encodeURIComponent(query)}&format=JSON&pageSize=30`;
  const data = await proxyFetch(url);
  return Array.isArray(data?.data || data?.processes) ? (data?.data || data?.processes) : [];
}

// Search the original term plus material stems; merge unique datasets (uuid+version)
async function searchExpanded(queries) {
  const lists = await Promise.all(queries.map(q => searchProcesses(q).catch(() => [])));
  const seen = new Map();
  for (const r of lists.flat()) {
    const key = `${r.uuid || r['@uuid']}@${r.version || r['@version'] || ''}`;
    if (!seen.has(key)) seen.set(key, r);
  }
  return [...seen.values()];
}

function ProjectPickerModal({ entry, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'mine-for-epd'],
    queryFn: () => projectService.getAll({ my_projects: 'true' }),
  });
  const projects = Array.isArray(data) ? data : (data?.data || []);

  async function addTo(project) {
    setSaving(project.id);
    try {
      const full = await projectService.getById(project.id);
      let current = full.oekodat_materials;
      try { current = typeof current === 'string' ? JSON.parse(current) : current; } catch { current = []; }
      current = Array.isArray(current) ? current : [];
      if (current.some(e => e.uuid === entry.uuid && (e.version || '') === (entry.version || ''))) {
        toast.info?.(`„${entry.name}“ ist bereits in „${project.name}“.`);
        onClose();
        return;
      }
      await projectService.update(project.id, { oekodat_materials: [...current, entry] });
      qc.invalidateQueries({ queryKey: ['project', project.id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`In „${project.name}“ übernommen (1 ${entry.declaredUnit || 'Einheit'} – Menge im Projekt anpassen).`);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Übernehmen fehlgeschlagen.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">In Projekt übernehmen</h3>
            <p className="text-[11px] text-gray-500 truncate">{entry.name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {isLoading && <p className="text-xs text-gray-400 p-2">Lade Projekte…</p>}
          {!isLoading && !projects.length && <p className="text-xs text-gray-500 p-2">Du hast noch keine eigenen Projekte.</p>}
          {projects.map(p => (
            <button key={p.id} type="button" disabled={!!saving} onClick={() => addTo(p)}
              className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-lg border border-gray-100 hover:border-emerald-300 hover:bg-emerald-50/40 text-sm disabled:opacity-50">
              <span className="truncate">{p.name}</span>
              {saving === p.id && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}
            </button>
          ))}
        </div>
        <p className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
          Wird als verknüpfter ÖKOBAUDAT-Datensatz (UUID + Version) gespeichert, nicht als Bibliotheksmaterial.
        </p>
      </div>
    </div>
  );
}

/**
 * Fallback below the material library: search ÖKOBAUDAT with the same term.
 * Props: term, libraryCount, requireAuth(), onCreateMaterial(), onCreateGesuch()
 */
export default function OekobaudatFallback({ term, libraryCount, requireAuth, onCreateMaterial, onCreateGesuch }) {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState(term);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchedFor, setSearchedFor] = useState([]);
  const [error, setError] = useState('');
  const [details, setDetails] = useState({}); // { key: 'loading' | extracted | null }
  const [projectEntry, setProjectEntry] = useState(null);
  const genRef = useRef(0);
  const { refEpds, addRefEpd } = useCompareStore();
  const toast = useToast();

  // a new library search term resets the fallback to its prompt
  useEffect(() => { genRef.current++; setActive(false); setQuery(term); }, [term]);

  const { suggestions } = expandSearchTerm(query);

  async function run(q = query) {
    const trimmed = String(q || '').trim();
    if (!trimmed) return;
    const gen = ++genRef.current;
    setActive(true); setQuery(trimmed); setSearching(true); setError(''); setResults([]); setDetails({});
    const { queries } = expandSearchTerm(trimmed);
    setSearchedFor(queries);
    try {
      const arr = await searchExpanded(queries);
      if (genRef.current !== gen) return;
      setResults(arr);
      loadDetails(arr.slice(0, 20), gen);
    } catch (e) {
      if (genRef.current === gen) setError('ÖKOBAUDAT-Suche fehlgeschlagen: ' + e.message);
    } finally {
      if (genRef.current === gen) setSearching(false);
    }
  }

  // GWP + declared unit need the full dataset — 3 concurrent workers like the project search
  function loadDetails(list, gen) {
    let i = 0;
    const worker = async () => {
      while (genRef.current === gen && i < list.length) {
        const r = list[i++];
        const uuid = r.uuid || r['@uuid'];
        const version = r.version || r['@version'] || '';
        const key = `${uuid}@${version}`;
        setDetails(prev => ({ ...prev, [key]: 'loading' }));
        try {
          const vq = version ? `version=${encodeURIComponent(version)}&` : '';
          const raw = await proxyFetch(`${BASE}/datastocks/${DS.id}/processes/${uuid}?${vq}format=JSON&view=extended`);
          if (genRef.current !== gen) return;
          setDetails(prev => ({ ...prev, [key]: extractEpdData(raw) }));
        } catch {
          if (genRef.current === gen) setDetails(prev => ({ ...prev, [key]: null }));
        }
      }
    };
    worker(); worker(); worker();
  }

  function entryFor(r) {
    const uuid = r.uuid || r['@uuid'];
    const version = r.version || r['@version'] || '';
    const d = details[`${uuid}@${version}`];
    if (!d || d === 'loading') return null;
    const e = buildEpdEntry(uuid, version, DS.label, d);
    return {
      ...e,
      datasetType: e.datasetType || r.subType || '',
      validUntil:  e.validUntil ?? r.validUntil ?? null,
      norm:        e.norm || (r.compliance || []).map(c => c.name).find(n => /15804/.test(n)) || '',
    };
  }

  function addToCompare(entry) {
    if (refEpds.length >= MAX_ITEMS) { toast.error(`Maximal ${MAX_ITEMS} ÖKOBAUDAT-Referenzen im Vergleich.`); return; }
    addRefEpd(entry);
    toast.success(`„${entry.name}“ zum Materialvergleich hinzugefügt.`);
  }

  const currentYear = new Date().getFullYear();
  const gwpOf = (r) => {
    const d = details[`${r.uuid || r['@uuid']}@${r.version || r['@version'] || ''}`];
    return d && typeof d === 'object' ? d.gwpA1A3 : undefined;
  };
  // ascending GWP like the project search; unknown last
  const sorted = [...results].sort((a, b) => {
    const ag = gwpOf(a), bg = gwpOf(b);
    if (ag == null && bg == null) return 0;
    if (ag == null) return 1;
    if (bg == null) return -1;
    return ag - bg;
  });
  const loadingCount = Object.values(details).filter(d => d === 'loading').length;

  if (!active) {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3 bg-emerald-50/60 border border-dashed border-emerald-300 rounded-xl px-4 py-3">
        <Leaf className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-sm text-gray-700">
          {libraryCount === 0 ? 'Nicht in der Bibliothek gefunden?' : 'Nicht das Richtige dabei?'}
        </span>
        <button type="button" onClick={() => run(term)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
          <Search className="w-4 h-4" /> „{term}“ in ÖKOBAUDAT suchen
        </button>
      </div>
    );
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold text-emerald-800 flex items-center gap-2">
          <Leaf className="w-4 h-4" /> ÖKOBAUDAT-Datensätze
          {!searching && <span className="text-gray-400 font-normal">({results.length})</span>}
        </h3>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none" />
          <button type="submit" disabled={searching}
            className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">Suchen</button>
        </form>
      </div>

      <p className="flex gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" />
        ÖKOBAUDAT-Einträge sind reine Umweltdaten (EPD-Datensätze) – kein verfügbares Material, das sich anfragen oder abholen lässt.
      </p>

      {searchedFor.length > 1 && (
        <p className="text-[11px] text-gray-500 mb-2">Gesucht nach: {searchedFor.map(q => `„${q}“`).join(', ')}</p>
      )}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="text-[11px] text-gray-500">Verwandte Begriffe:</span>
          {suggestions.map(s => (
            <button key={s} type="button" onClick={() => run(s)}
              className="px-2 py-0.5 text-[11px] rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50">{s}</button>
          ))}
        </div>
      )}

      {searching && (
        <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" /> ÖKOBAUDAT wird durchsucht…
        </div>
      )}
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {!searching && results.length > 0 && (
        <>
          {loadingCount > 0 && (
            <p className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
              <Loader2 className="w-3 h-3 animate-spin" /> GWP wird geladen – Sortierung nach Klimawirkung
            </p>
          )}
          <div className="space-y-1.5">
            {sorted.map(r => {
              const uuid = r.uuid || r['@uuid'];
              const version = r.version || r['@version'] || '';
              const key = `${uuid}@${version}`;
              const d = details[key];
              const entry = entryFor(r);
              const gwp = d && typeof d === 'object' ? d.gwpA1A3 : null;
              const type = DATASET_TYPES[entry?.datasetType || r.subType] || entry?.datasetType || r.subType;
              const normText = normLabel(entry?.norm || (r.compliance || []).map(c => c.name).join(' '));
              const validYear = parseInt(entry?.validUntil ?? r.validUntil, 10);
              const expired = validYear && validYear < currentYear;
              const inCompare = refEpds.some(e => e.uuid === uuid);
              return (
                <div key={key} className="flex flex-wrap items-center gap-3 px-3 py-2.5 bg-white border border-gray-100 rounded-lg hover:border-emerald-200">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wide">EPD</span>
                      <p className="text-sm font-semibold text-gray-900">{getName(r.name || r) || uuid}</p>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-500">
                      {type && <span>Typ: <strong className="font-medium text-gray-700">{type}</strong></span>}
                      <span>Norm: <strong className="font-medium text-gray-700">{normText || 'k. A.'}</strong></span>
                      <span>Bezug: <strong className="font-medium text-gray-700">{d === 'loading' || d === undefined ? '…' : (d?.declaredUnit || 'k. A.')}</strong></span>
                      {validYear ? (
                        <span className={expired ? 'text-red-600' : ''}>gültig bis {validYear}{expired ? ' (abgelaufen)' : ''}</span>
                      ) : null}
                      {r.classific && <span className="truncate max-w-[260px]">{r.classific}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 w-32">
                    <p className="text-[10px] text-gray-400 uppercase">GWP A1–A3</p>
                    <p className={`text-sm font-mono font-semibold ${gwp != null && gwp < 0 ? 'text-teal-700' : 'text-gray-800'}`}>
                      {d === 'loading' || d === undefined ? <Loader2 className="w-3.5 h-3.5 animate-spin inline text-gray-300" /> : fmtGwp(gwp)}
                    </p>
                    {gwp != null && <p className="text-[10px] text-gray-400">kg CO₂e / {d.declaredUnit || 'Einheit'}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" disabled={!entry || inCompare} onClick={() => addToCompare(entry)}
                      title={inCompare ? 'Bereits im Vergleich' : 'Zum Vergleich hinzufügen'}
                      className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${inCompare ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}>
                      <Scale className="w-4 h-4" />
                    </button>
                    <button type="button" disabled={!entry} onClick={() => { if (requireAuth()) setProjectEntry(entry); }}
                      title="In Projekt übernehmen"
                      className="p-2 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-40">
                      <FolderPlus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!searching && !error && results.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-800 mb-1">Auch in ÖKOBAUDAT nichts gefunden.</p>
          <p className="text-xs text-gray-500 mb-4">Versuche einen allgemeineren Begriff oder einen der verwandten Begriffe oben.</p>
          <div className="flex flex-wrap gap-2 mb-4">
            <button type="button" onClick={onCreateMaterial}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-600">
              <Plus className="w-4 h-4" /> Material mit EPD anlegen
            </button>
            <button type="button" onClick={onCreateGesuch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50">
              <BookMarked className="w-4 h-4" /> Gesuch eintragen
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mb-1">Beim Anlegen kann ein EPD-Dokument (PDF/XML) hochgeladen und per KI-Import ausgelesen werden. Weitere EPD-Quellen:</p>
          <div className="flex flex-wrap gap-3">
            {EXTERNAL_SOURCES.map(s => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline">
                {s.label} <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>
      )}

      {projectEntry && <ProjectPickerModal entry={projectEntry} onClose={() => setProjectEntry(null)} />}
    </section>
  );
}
