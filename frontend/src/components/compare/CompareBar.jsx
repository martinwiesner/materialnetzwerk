import { useNavigate } from 'react-router-dom';
import { Scale, X, ArrowRight } from 'lucide-react';
import { useCompareStore } from '../../store/compareStore';

const TYPE_LABEL = { materials: 'Materialien', projects: 'Projekte' };
const TYPE_COLOR = {
  materials: 'bg-primary-600 hover:bg-primary-700',
  projects:  'bg-project-600 hover:bg-project-700',
};

export default function CompareBar() {
  const navigate = useNavigate();
  const { type, ids, items, clear, toggle } = useCompareStore();

  if (!ids.length) return null;

  const label = TYPE_LABEL[type] || type;
  const canCompare = ids.length >= 2;

  // Use cached item names when available, fall back to short id
  function nameFor(id) {
    const item = items.find((i) => i.id === id);
    if (item) return item.name || id.slice(0, 8);
    return id.slice(0, 8) + '…';
  }

  function handleOpen() {
    navigate(`/compare?type=${type}&ids=${ids.join(',')}`);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="mx-auto max-w-5xl px-4 pb-4 pointer-events-auto">
        <div className="flex items-center gap-3 bg-gray-900 text-white rounded-2xl shadow-2xl px-4 py-3 border border-gray-700">
          {/* Icon + label */}
          <div className="flex items-center gap-2 shrink-0">
            <Scale className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {label} vergleichen
            </span>
          </div>

          <div className="w-px h-5 bg-gray-700 shrink-0" />

          {/* Selected items */}
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            {ids.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-700 text-xs text-gray-100 max-w-[140px]"
              >
                <span className="truncate">{nameFor(id)}</span>
                <button
                  type="button"
                  onClick={() => toggle(type, id)}
                  className="text-gray-400 hover:text-white shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {ids.length < 4 && (
              <span className="text-xs text-gray-500 italic">
                + bis zu {4 - ids.length} weitere
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={clear}
              className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded-lg transition-colors"
            >
              Löschen
            </button>
            <button
              type="button"
              onClick={handleOpen}
              disabled={!canCompare}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-white ${type ? TYPE_COLOR[type] : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              Vergleich starten
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
