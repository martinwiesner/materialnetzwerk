import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, Leaf, Link2, Link2Off } from 'lucide-react';
import { idematService } from '../../services/idematService';
import { materialService } from '../../services/materialService';

// ── EF 3.1 category display config ───────────────────────────────────────────
const CATEGORIES = [
  { key: 'climate_change',      label: 'Klimawandel',               unit: 'Pt' },
  { key: 'acidification',       label: 'Versauerung',               unit: 'Pt' },
  { key: 'particulate_matter',  label: 'Feinstaub',                 unit: 'Pt' },
  { key: 'eutroph_freshwater',  label: 'Eutrophierung (Süßwasser)', unit: 'Pt' },
  { key: 'eutroph_marine',      label: 'Eutrophierung (Meer)',      unit: 'Pt' },
  { key: 'eutroph_terrestrial', label: 'Eutrophierung (terrestr.)', unit: 'Pt' },
  { key: 'ecotox_freshwater',   label: 'Ökotoxizität (Süßwasser)', unit: 'Pt' },
  { key: 'human_tox_cancer',    label: 'Tox. Mensch (krebserr.)',   unit: 'Pt' },
  { key: 'human_tox_noncancer', label: 'Tox. Mensch (nicht-k.)',   unit: 'Pt' },
  { key: 'ionising_radiation',  label: 'Ionisierende Strahlung',    unit: 'Pt' },
  { key: 'land_use',            label: 'Landnutzung',               unit: 'Pt' },
  { key: 'ozone_depletion',     label: 'Ozonabbau',                 unit: 'Pt' },
  { key: 'photochem_ozone',     label: 'Photosmog',                 unit: 'Pt' },
  { key: 'resource_fossils',    label: 'Ressourcen (fossil)',        unit: 'Pt' },
  { key: 'resource_minerals',   label: 'Ressourcen (mineralisch)',  unit: 'Pt' },
  { key: 'water_use',           label: 'Wassernutzung',             unit: 'Pt' },
];

const GWP_FACTOR  = 8700 / 0.2106;
const MAX_PT_DB   = 0.00541;
const MAX_GWP_DB  = 0.000831;

function ptBarPct(v)  { return v ? Math.min(100, (v / MAX_PT_DB)  * 100) : 0; }
function gwpBarPct(v) { return v ? Math.min(100, (v / MAX_GWP_DB) * 100) : 0; }

function fmtPt(v) {
  if (v == null) return '—';
  if (v === 0) return '0 Pt';
  const abs = Math.abs(v);
  if (abs >= 0.001) return `${v.toLocaleString('de-DE', { maximumFractionDigits: 5 })} Pt`;
  return `${v.toFixed(Math.min(Math.ceil(-Math.log10(abs)) + 3, 10))} Pt`;
}

function fmtGwp(ptClimate) {
  if (ptClimate == null) return null;
  const v = ptClimate * GWP_FACTOR;
  if (v === 0) return '0 kg CO₂';
  const abs = Math.abs(v);
  if (abs >= 0.001) return `${v.toLocaleString('de-DE', { maximumFractionDigits: 3 })} kg CO₂`;
  return `${v.toFixed(Math.min(Math.ceil(-Math.log10(abs)) + 3, 10))} kg CO₂`;
}

// ── Result card once a process is linked ─────────────────────────────────────
function ProcessCard({ process, canEdit, onUnlink }) {
  const total = process.ef31_total;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{process.name}</div>
          {process.name_de && (
            <div className="text-xs text-gray-400 mt-0.5">{process.name_de}</div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] border border-gray-200 bg-gray-50 text-gray-600">
              {process.category}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] border border-blue-100 bg-blue-50 text-blue-700">
              pro {process.unit || 'kg'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] border border-gray-200 bg-gray-50 text-gray-500">
              IDEMAT 2026
            </span>
          </div>
        </div>
        {canEdit && onUnlink && (
          <button
            type="button"
            onClick={onUnlink}
            title="Verknüpfung entfernen"
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Link2Off className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* EF 3.1 Total + GWP */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-4">
        <Leaf className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <div className="flex gap-6 flex-wrap">
          <div>
            <div className="text-[10px] text-emerald-700 font-medium uppercase tracking-wide">
              EF 3.1 Gesamt
            </div>
            <div className="text-lg font-mono font-bold text-emerald-900">
              {fmtPt(total)}
            </div>
          </div>
          {fmtGwp(process.climate_change) && (
            <div>
              <div className="text-[10px] text-sky-700 font-medium uppercase tracking-wide">GWP</div>
              <div className="text-lg font-mono font-bold text-sky-900">
                {fmtGwp(process.climate_change)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {CATEGORIES.map(({ key, label }) => {
          const val = process[key];
          const share = (val != null && total > 0) ? (val / total) : 0;
          const pct = Math.max(2, Math.round(share * 100));
          return (
            <div key={key} className="bg-white border border-gray-100 rounded-lg p-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] text-gray-600 leading-tight">{label}</span>
                <span className="text-[10px] font-mono text-gray-800 whitespace-nowrap">{fmtPt(val)}</span>
              </div>
              <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400 leading-snug">
        Quelle: IDEMAT 2026 (TU Delft, CC BY-NC). EF 3.1-Methode: normalisierte und gewichtete Wirkungskategorien in Pt pro {process.unit || 'kg'}.
      </p>
    </div>
  );
}

// ── IDEMAT search box ─────────────────────────────────────────────────────────
function IdematSearch({ onSelect }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['idemat-search', q],
    queryFn: () => idematService.search(q),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  });

  function openDropdown() {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
    setOpen(true);
  }

  function handleResultMouseDown(e, entry) {
    e.preventDefault();
    onSelect(entry);
    setQ('');
    setOpen(false);
  }

  const dropdown = open && q.trim().length >= 2 && rect ? createPortal(
    <div
      style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 99999 }}
      className="bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto"
    >
      {isFetching && <div className="px-3 py-2 text-xs text-gray-400">Suche…</div>}
      {!isFetching && results.length === 0 && (
        <div className="px-3 py-2 text-xs text-gray-400">Keine Treffer</div>
      )}
      {results.map((r) => (
        <button key={r.id} type="button"
          onMouseDown={(e) => handleResultMouseDown(e, r)}
          className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors border-b border-gray-50 last:border-0">
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
              <span className="text-[10px] font-mono text-emerald-700">{fmtPt(r.ef31_total)}</span>
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
        </button>
      ))}
    </div>,
    document.getElementById('root')
  ) : null;

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); openDropdown(); }}
          onFocus={openDropdown}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="IDEMAT-Prozess suchen (z.B. aluminum, steel, wood)…"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
        />
        {q && (
          <button type="button" onMouseDown={(e) => { e.preventDefault(); setQ(''); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {dropdown}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LcaSection({ material, canEdit }) {
  const qc = useQueryClient();

  const { data: process, isLoading } = useQuery({
    queryKey: ['idemat-process', material.idemat_process_id],
    queryFn: () => idematService.getById(material.idemat_process_id),
    enabled: Boolean(material.idemat_process_id),
    staleTime: 5 * 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: (id) => materialService.update(material.id, { idemat_process_id: id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials', { id: material.id }] }),
  });

  function handleSelect(entry) {
    saveMutation.mutate(entry.id);
  }

  function handleUnlink() {
    saveMutation.mutate(null);
  }

  const linked = Boolean(material.idemat_process_id);

  return (
    <div className="space-y-3">
      {/* Search — only for editors */}
      {canEdit && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-semibold text-gray-600">
              {linked ? 'Verknüpften Prozess ändern' : 'IDEMAT-Prozess verknüpfen'}
            </span>
            {saveMutation.isPending && (
              <span className="text-[10px] text-gray-400">Speichern…</span>
            )}
          </div>
          <IdematSearch onSelect={handleSelect} />
        </div>
      )}

      {/* Display */}
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
          <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
          Lade Prozessdaten…
        </div>
      )}

      {process && !isLoading && (
        <ProcessCard
          process={process}
          canEdit={canEdit}
          onUnlink={handleUnlink}
        />
      )}

      {!linked && !isLoading && !canEdit && (
        <p className="text-sm text-gray-400 italic">
          Noch kein IDEMAT-Prozess verknüpft.
        </p>
      )}

      {!linked && !isLoading && canEdit && !process && (
        <p className="text-xs text-gray-400">
          Suche einen passenden Prozess aus der IDEMAT 2026-Datenbank (2 472 Prozesse).
        </p>
      )}
    </div>
  );
}
