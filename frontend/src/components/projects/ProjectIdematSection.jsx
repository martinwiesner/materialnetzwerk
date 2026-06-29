import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Leaf, Trash2, Plus } from 'lucide-react';
import { idematService } from '../../services/idematService';

// ── EF 3.1 categories shown in summary ───────────────────────────────────────
const TOP_CATS = [
  { key: 'climate_change',      label: 'Klimawandel' },
  { key: 'acidification',       label: 'Versauerung' },
  { key: 'particulate_matter',  label: 'Feinstaub' },
  { key: 'resource_fossils',    label: 'Fossile Ressourcen' },
  { key: 'eutroph_freshwater',  label: 'Eutrophierung (SW)' },
  { key: 'human_tox_cancer',    label: 'Tox. Mensch (k.)' },
  { key: 'ecotox_freshwater',   label: 'Ökotox. (SW)' },
  { key: 'photochem_ozone',     label: 'Photosmog' },
];

function fmtPt(v) {
  if (v == null) return '—';
  if (v === 0) return '0';
  if (Math.abs(v) >= 0.001) return v.toLocaleString('de-DE', { maximumFractionDigits: 5 });
  return v.toExponential(3);
}

// EF 3.1: climate_change is stored in Pt. Back-convert to kg CO₂ eq.
// Normalization: 8700 kg CO₂/(p·y), weighting: 21.06%
const GWP_FACTOR = 8700 / 0.2106;

function fmtGwp(ptClimate) {
  if (ptClimate == null) return null;
  const v = ptClimate * GWP_FACTOR;
  if (v === 0) return '0 kg CO₂';
  if (v >= 100) return `${Math.round(v)} kg CO₂`;
  if (v >= 1)   return `${v.toFixed(2)} kg CO₂`;
  if (v >= 0.01) return `${v.toFixed(3)} kg CO₂`;
  return `${v.toExponential(2)} kg CO₂`;
}

// ── Inline quantity input ────────────────────────────────────────────────────
function QtyInput({ value, onChange }) {
  const [local, setLocal] = useState(String(value ?? 1));

  function commit() {
    const n = parseFloat(local.replace(',', '.'));
    if (!isNaN(n) && n > 0) onChange(n);
    else setLocal(String(value ?? 1));
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      className="w-16 text-right text-sm font-mono border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-300"
    />
  );
}

// ── Search dropdown ──────────────────────────────────────────────────────────
function IdematSearchBox({ onAdd }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);
  const blurTimer = useRef(null);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['idemat-search', q],
    queryFn: () => idematService.search(q),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  });

  // Stable refs so native event listener never has stale closures
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const onAddRef = useRef(onAdd);
  onAddRef.current = onAdd;
  const setQRef = useRef(setQ);
  setQRef.current = setQ;
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;

  function openDropdown() {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
    setOpen(true);
  }

  // Native listener — bypasses all React event delegation / portal issues
  const dropdownRef = useCallback((node) => {
    if (!node) return;
    node.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-idx]');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx, 10);
      const entry = resultsRef.current[idx];
      if (!entry) return;
      clearTimeout(blurTimer.current);
      onAddRef.current(entry);
      setQRef.current('');
      setOpenRef.current(false);
    });
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); openDropdown(); }}
          onFocus={openDropdown}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 300); }}
          placeholder="Prozess suchen (z.B. steel, concrete, wood, aluminum)…"
          className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
        />
        {q && (
          <button type="button" tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); clearTimeout(blurTimer.current); setQ(''); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && q.trim().length >= 2 && rect && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 99999,
          }}
          className="bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto"
        >
          {isFetching && <div className="px-3 py-2 text-xs text-gray-400">Suche…</div>}
          {!isFetching && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">Keine Treffer</div>
          )}
          {results.map((r, idx) => (
            <button key={r.id} type="button" tabIndex={-1} data-idx={idx}
              className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-b border-gray-50 last:border-0 flex items-center gap-2">
              <Plus className="w-3 h-3 text-emerald-500 flex-shrink-0" />
              <div className="min-w-0 pointer-events-none">
                <div className="text-xs font-medium text-gray-900 truncate">{r.name}</div>
                {r.name_de && (
                  <div className="text-[10px] text-gray-400 truncate">{r.name_de}</div>
                )}
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-gray-500">{r.category}</span>
                  <span className="text-[10px] text-gray-400">/{r.unit}</span>
                  <span className="text-[10px] font-mono text-emerald-700">{fmtPt(r.ef31_total)} Pt</span>
                  {fmtGwp(r.climate_change) && (
                    <span className="text-[10px] font-mono text-sky-600">{fmtGwp(r.climate_change)}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Summary block ────────────────────────────────────────────────────────────
function Summary({ items }) {
  if (!items.length) return null;

  const total = items.reduce((sum, it) => sum + (it.ef31_total ?? 0) * it.quantity, 0);

  const catTotals = TOP_CATS.map(({ key, label }) => ({
    key,
    label,
    value: items.reduce((s, it) => s + ((it.ef31?.[key] ?? 0) * it.quantity), 0),
  })).sort((a, b) => b.value - a.value);

  const maxCat = Math.max(...catTotals.map((c) => c.value), 1e-99);

  return (
    <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Leaf className="w-4 h-4 text-emerald-600" />
        <span className="text-xs font-semibold text-emerald-800">EF 3.1 Gesamtscore</span>
        <span className="ml-auto text-base font-mono font-bold text-emerald-900">
          {fmtPt(total)}
          <span className="text-xs font-normal text-emerald-700 ml-1">Pt</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {catTotals.map(({ key, label, value }) => {
          const pct = Math.max(2, Math.round((value / maxCat) * 100));
          return (
            <div key={key} className="bg-white rounded-lg border border-emerald-100 p-2">
              <div className="flex justify-between items-center gap-1 mb-1">
                <span className="text-[10px] text-gray-600">{label}</span>
                <span className="text-[10px] font-mono text-gray-800">{fmtPt(value)}</span>
              </div>
              <div className="h-1 rounded-full bg-emerald-100 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-400">IDEMAT 2026 (TU Delft, CC BY-NC) · EF 3.1 · Werte = Prozess-Pt × Menge</p>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function ProjectIdematSection({ items = [], onChange }) {
  function handleAdd(entry) {
    const newItem = {
      id: crypto.randomUUID(),
      process_id: entry.id,
      name: entry.name,
      name_de: entry.name_de || '',
      category: entry.category,
      unit: entry.unit,
      quantity: 1,
      ef31_total: entry.ef31_total,
      ef31: {
        acidification:       entry.acidification,
        climate_change:      entry.climate_change,
        ecotox_freshwater:   entry.ecotox_freshwater,
        particulate_matter:  entry.particulate_matter,
        eutroph_marine:      entry.eutroph_marine,
        eutroph_freshwater:  entry.eutroph_freshwater,
        eutroph_terrestrial: entry.eutroph_terrestrial,
        human_tox_cancer:    entry.human_tox_cancer,
        human_tox_noncancer: entry.human_tox_noncancer,
        ionising_radiation:  entry.ionising_radiation,
        land_use:            entry.land_use,
        ozone_depletion:     entry.ozone_depletion,
        photochem_ozone:     entry.photochem_ozone,
        resource_fossils:    entry.resource_fossils,
        resource_minerals:   entry.resource_minerals,
        water_use:           entry.water_use,
      },
    };
    onChange([...items, newItem]);
  }

  function handleQty(id, qty) {
    onChange(items.map((it) => it.id === id ? { ...it, quantity: qty } : it));
  }

  function handleRemove(id) {
    onChange(items.filter((it) => it.id !== id));
  }

  return (
    <div className="space-y-3">
      <IdematSearchBox onAdd={handleAdd} />

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((it) => {
            const subtotal = (it.ef31_total ?? 0) * it.quantity;
            return (
              <div key={it.id}
                className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-gray-900 truncate">{it.name}</div>
                  {it.name_de && (
                    <div className="text-[10px] text-gray-400 truncate">{it.name_de}</div>
                  )}
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-gray-500">{it.category}</span>
                    <span className="text-[10px] font-mono text-emerald-700">{fmtPt(subtotal)} Pt</span>
                    {fmtGwp(it.ef31?.climate_change) && (
                      <span className="text-[10px] font-mono text-sky-600">
                        {fmtGwp((it.ef31?.climate_change ?? 0) * it.quantity)} CO₂
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <QtyInput value={it.quantity} onChange={(v) => handleQty(it.id, v)} />
                  <span className="text-xs text-gray-500">{it.unit}</span>
                  <button type="button" onClick={() => handleRemove(it.id)}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Summary items={items} />
    </div>
  );
}
