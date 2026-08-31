import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Leaf, Trash2, Plus, Zap } from 'lucide-react';
import { idematService } from '../../services/idematService';
import { formatPt } from '../../utils/lcaFormat';

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

// All 16 EF 3.1 sub-categories (used to scale energy entries)
const EF31_KEYS = [
  'acidification', 'climate_change', 'ecotox_freshwater', 'particulate_matter',
  'eutroph_marine', 'eutroph_freshwater', 'eutroph_terrestrial',
  'human_tox_cancer', 'human_tox_noncancer', 'ionising_radiation',
  'land_use', 'ozone_depletion', 'photochem_ozone',
  'resource_fossils', 'resource_minerals', 'water_use',
];

// 95th-percentile caps (excl. whole-installation outliers like offshore substations)
const MAX_PT_DB  = 0.00541;  // Pt
const MAX_GWP_DB = 0.000831; // climate_change in Pt  (≈ 34.3 kg CO₂)

// EF 3.1: climate_change stored in Pt → back-convert to kg CO₂ eq
// Normalization: 8700 kg CO₂/(p·y), weighting: 21.06%
const GWP_FACTOR = 8700 / 0.2106;

// 1 kWh = 3.6 MJ  (IDEMAT energy entries are all per MJ)
const MJ_PER_KWH = 3.6;

function ptBarPct(v)  { return v ? Math.min(100, (v / MAX_PT_DB)  * 100) : 0; }
function gwpBarPct(v) { return v ? Math.min(100, (v / MAX_GWP_DB) * 100) : 0; }

function fmtGwp(ptClimate) {
  if (ptClimate == null) return null;
  const v = ptClimate * GWP_FACTOR;
  if (v === 0) return '0 kg CO₂';
  const abs = Math.abs(v);
  if (abs >= 0.001) return `${v.toLocaleString('de-DE', { maximumFractionDigits: 3 })} kg CO₂`;
  return `${v.toFixed(Math.min(Math.ceil(-Math.log10(abs)) + 3, 10))} kg CO₂`;
}

// ── Energy source presets (IDEMAT IDs, all in MJ — converted to kWh on add) ──
const ENERGY_SOURCES = [
  {
    group: 'Strom – Netz',
    options: [
      { key: 'DE_grid',   label: 'Strom Deutschland (Netz-Mix 2024)',  idematId: 'B.042.01.112.251007' },
      { key: 'EU27_grid', label: 'Strom EU-27 (Netz-Mix)',             idematId: 'B.042.01.101.251007' },
    ],
  },
  {
    group: 'Strom – Erneuerbar / Autark',
    options: [
      { key: 'pv',           label: 'Solarstrom PV (eigene Anlage, Mono-Si)',    idematId: 'B.030.01.107.240825' },
      { key: 'wind_offshore',label: 'Windstrom Offshore (Nordsee-Durchschnitt)', idematId: 'B.030.01.109.260519' },
      { key: 'wind_onshore', label: 'Windstrom Onshore (DE / DK / NL)',          idematId: 'B.030.01.110.260519' },
      { key: 'hydro',        label: 'Wasserkraft (Norwegen)',                     idematId: 'B.030.01.106.230701' },
    ],
  },
  {
    group: 'Strom – Fossil',
    options: [
      { key: 'gas_elec',  label: 'Strom aus Erdgas (60 % Wirkungsgrad)', idematId: 'B.030.01.103.230701' },
      { key: 'coal_elec', label: 'Kohlestrom (EU, 38 % Wirkungsgrad)',   idematId: 'B.030.01.101.250107' },
    ],
  },
  {
    group: 'Wärme / Prozesswärme',
    options: [
      { key: 'heat_gas',      label: 'Wärme aus Erdgas (Heizkessel)',       idematId: 'B.050.01.103.230701' },
      { key: 'heat_pump',     label: 'Wärme Wärmepumpe (Netzstrom)',        idematId: 'B.050.01.102.230701' },
      { key: 'heat_industry', label: 'Prozesswärme (allg. Industrie-Mix)',  idematId: 'B.050.01.101.230701' },
    ],
  },
];

const ENERGY_SOURCE_MAP = Object.fromEntries(
  ENERGY_SOURCES.flatMap((g) => g.options).map((o) => [o.key, o])
);

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

// ── Process search dropdown ──────────────────────────────────────────────────
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
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400">
                  <span>{r.category}</span>
                  <span>·</span>
                  <span>/{r.unit}</span>
                </div>
                <div className="mt-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${ptBarPct(r.ef31_total)}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700">{formatPt(r.ef31_total)}</span>
                  </div>
                  {r.climate_change != null && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-full bg-sky-400 rounded-full" style={{ width: `${gwpBarPct(r.climate_change)}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-sky-700">{fmtGwp(r.climate_change)}</span>
                    </div>
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

// ── Energy consumption input ─────────────────────────────────────────────────
function EnergyInputBox({ onAdd }) {
  const [sourceKey, setSourceKey] = useState('DE_grid');
  const [kwh, setKwh] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleAdd() {
    const n = parseFloat(kwh.replace(',', '.'));
    if (!n || n <= 0) return;
    const src = ENERGY_SOURCE_MAP[sourceKey];
    setLoading(true);
    setError(null);
    try {
      const entry = await idematService.getById(src.idematId);
      const scale = MJ_PER_KWH; // Pt/MJ → Pt/kWh
      onAdd({
        id: crypto.randomUUID(),
        type: 'energy',
        name: src.label,
        name_de: '',
        category: 'Energie',
        unit: 'kWh',
        quantity: n,
        ef31_total: (entry.ef31_total ?? 0) * scale,
        ef31: Object.fromEntries(EF31_KEYS.map((k) => [k, entry[k] != null ? entry[k] * scale : null])),
        energy_source_key: sourceKey,
        energy_source_id: src.idematId,
      });
      setKwh('');
    } catch {
      setError('Datenabruf fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={sourceKey}
        onChange={(e) => setSourceKey(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
      >
        {ENERGY_SOURCES.map((group) => (
          <optgroup key={group.group} label={group.group}>
            {group.options.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={kwh}
          onChange={(e) => setKwh(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          placeholder="Menge in kWh"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 font-mono"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={loading || !kwh || parseFloat(kwh.replace(',', '.')) <= 0}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors flex-shrink-0"
        >
          {loading
            ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Plus className="w-3.5 h-3.5" />
          }
          <span>Hinzufügen</span>
        </button>
      </div>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <p className="text-[10px] text-gray-400">
        Quelle: IDEMAT 2026 (TU Delft). Werte per MJ → kWh (×3,6). Alle 16 EF 3.1-Kategorien enthalten.
      </p>
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
          {formatPt(total)}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {catTotals.map(({ key, label, value }) => {
          const pct = Math.max(2, Math.round((value / maxCat) * 100));
          return (
            <div key={key} className="bg-white rounded-lg border border-emerald-100 p-2">
              <div className="flex justify-between items-center gap-1 mb-1">
                <span className="text-[10px] text-gray-600">{label}</span>
                <span className="text-[10px] font-mono text-gray-800">{formatPt(value)}</span>
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
  const [inputMode, setInputMode] = useState('process'); // 'process' | 'energy'

  function handleAdd(entry) {
    const newItem = {
      id: crypto.randomUUID(),
      type: 'process',
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

  function handleAddEnergy(item) {
    onChange([...items, item]);
  }

  function handleQty(id, qty) {
    onChange(items.map((it) => it.id === id ? { ...it, quantity: qty } : it));
  }

  function handleRemove(id) {
    onChange(items.filter((it) => it.id !== id));
  }

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setInputMode('process')}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${
            inputMode === 'process'
              ? 'bg-emerald-600 text-white'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Prozess suchen
        </button>
        <button
          type="button"
          onClick={() => setInputMode('energy')}
          className={`flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors ${
            inputMode === 'energy'
              ? 'bg-amber-500 text-white'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Zap className="w-3 h-3" />
          Energieverbrauch
        </button>
      </div>

      {inputMode === 'process'
        ? <IdematSearchBox onAdd={handleAdd} />
        : <EnergyInputBox onAdd={handleAddEnergy} />
      }

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((it) => {
            const subtotal = (it.ef31_total ?? 0) * it.quantity;
            const isEnergy = it.type === 'energy';
            return (
              <div key={it.id}
                className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isEnergy && <Zap className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                    <div className="text-xs font-medium text-gray-900 truncate">{it.name}</div>
                  </div>
                  {it.name_de && (
                    <div className="text-[10px] text-gray-400 truncate">{it.name_de}</div>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400">
                    <span>{it.category}</span>
                    <span>·</span>
                    <span className="font-mono text-emerald-700">{formatPt(subtotal)} gesamt</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${ptBarPct(it.ef31_total)}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600">
                        {formatPt(it.ef31_total)}/{it.unit}
                      </span>
                    </div>
                    {it.ef31?.climate_change != null && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                          <div className="h-full bg-sky-400 rounded-full" style={{ width: `${gwpBarPct(it.ef31.climate_change)}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-sky-700">
                          {fmtGwp(it.ef31.climate_change * it.quantity)}
                        </span>
                      </div>
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
