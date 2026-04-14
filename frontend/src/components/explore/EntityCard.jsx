import { MapPin, Package, Store, FolderOpen, Leaf, Tag, Users, Send } from 'lucide-react';
import clsx from 'clsx';

function badgeForType(type) {
  if (type === 'material') return { label: 'Material', className: 'bg-primary-50 text-primary-800 border-primary-200', icon: Leaf };
  if (type === 'offer') return { label: 'Materialangebot', className: 'bg-primary-50 text-primary-800 border-primary-200', icon: Store };
  if (type === 'actor') return { label: 'Akteur', className: 'bg-actor-50 text-actor-700 border-actor-200', icon: Users };
  return { label: 'Projekt', className: 'bg-project-50 text-project-800 border-project-200', icon: FolderOpen };
}

export default function EntityCard({ entity, active = false, onSelect, onOpenDetails, onRequest }) {
  const badge = badgeForType(entity.type);
  const Icon = badge.icon;

  const metaLeft = entity.location?.address ? entity.location.address : entity.subtitle;
  const metaRight = entity.quantityLabel || (typeof entity.gwpTotal === 'number' ? `${entity.gwpTotal.toFixed(2)} ${entity.gwpUnit || ''}` : null);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect?.(); }}
      className={clsx(
        'w-full text-left bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer',
        active ? 'border-primary-300 ring-2 ring-primary-100' : 'border-gray-200'
      )}
    >
      <div className="relative">
        {entity.imageUrl ? (
          <img
            src={entity.imageUrl}
            alt={entity.title}
            className="w-full h-44 object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-44 bg-gray-100" />
        )}

        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <div className={clsx('inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border text-xs shadow-sm', badge.className)}>
            <Icon className="w-3.5 h-3.5" />
            {badge.label}
          </div>

          <div className="flex items-center gap-1.5">
            {entity.available && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/90 text-white text-xs font-medium shadow-sm">
                <Tag className="w-3.5 h-3.5" />
                verfügbar
              </div>
            )}
            {metaRight ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-gray-200 text-xs text-gray-700 shadow-sm">
                <Package className="w-3.5 h-3.5" />
                <span className="truncate">{metaRight}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="text-xl font-bold text-gray-900 leading-tight">{entity.title}</div>
        {entity.subtitle ? <div className="text-gray-600 text-sm mt-1">{entity.subtitle}</div> : null}

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-sm text-gray-600 min-w-0">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{metaLeft || '—'}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onRequest && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRequest(); }}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 bg-white px-2.5 py-1 rounded-lg transition-colors"
              >
                <Send className="w-3 h-3" />
                Anfragen
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenDetails?.(); }}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
