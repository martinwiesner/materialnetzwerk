import { Link } from 'react-router-dom';
import { MapPin, Package, Store, FolderOpen, Leaf, Tag, Users, Send, BookMarked, Printer, Pencil } from 'lucide-react';
import clsx from 'clsx';

function badgeForType(type) {
  if (type === 'material') return { label: 'Material', className: 'bg-primary-50 text-primary-700 border-primary-200', icon: Leaf };
  if (type === 'offer') return { label: 'Angebot', className: 'bg-primary-50 text-primary-700 border-primary-200', icon: Store };
  if (type === 'actor') return { label: 'Akteur', className: 'bg-actor-50 text-actor-700 border-actor-200', icon: Users };
  if (type === 'gesuch') return { label: 'Gesuch', className: 'bg-purple-50 text-purple-700 border-purple-200', icon: BookMarked };
  return { label: 'Projekt', className: 'bg-project-50 text-project-700 border-project-200', icon: FolderOpen };
}

export default function EntityCard({ entity, active = false, onSelect, href, onOpenDetails, onRequest, onPrint, onPrintOffer, onEdit }) {
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
      {/* Image */}
      <div className="relative">
        {entity.imageUrl ? (
          <img
            src={entity.imageUrl}
            alt={entity.title}
            className="w-full h-32 object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
            <Icon className="w-8 h-8 text-gray-300" />
          </div>
        )}

        {/* Overlay badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1.5">
          <div className={clsx('inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/90 border text-xs shadow-sm', badge.className)}>
            <Icon className="w-3 h-3" />
            {badge.label}
          </div>

          <div className="flex items-center gap-1">
            {entity.available && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/90 text-white text-xs font-medium shadow-sm">
                <Tag className="w-3 h-3" />
                verfügbar
              </div>
            )}
            {entity.type === 'material' && entity.hasGesuch && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-600/90 text-white text-xs font-medium shadow-sm">
                <BookMarked className="w-3 h-3" />
                gesucht
              </div>
            )}
            {metaRight && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 border border-gray-200 text-xs text-gray-700 shadow-sm">
                <Package className="w-3 h-3" />
                <span className="truncate max-w-[6rem]">{metaRight}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">{entity.title}</div>
        {entity.subtitle && (
          <div className="text-gray-500 text-xs mt-0.5 truncate">{entity.subtitle}</div>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 text-xs text-gray-500 min-w-0">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{metaLeft || '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onRequest && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRequest(); }}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 bg-white px-2 py-0.5 rounded-lg transition-colors"
              >
                <Send className="w-3 h-3" />
                Anfragen
              </button>
            )}
            {onPrintOffer && entity.type === 'material' && entity.available && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPrintOffer(); }}
                className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-900 border border-green-200 bg-white px-2 py-0.5 rounded-lg transition-colors"
                title="Angebots-Aushang drucken"
              >
                <Printer className="w-3 h-3" />
                Aushang
              </button>
            )}
            {onPrint && entity.type === 'gesuch' && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPrint(); }}
                className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 border border-purple-200 bg-white px-2 py-0.5 rounded-lg transition-colors"
                title="Als Aushang drucken"
              >
                <Printer className="w-3 h-3" />
                Aushang
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
                title="Bearbeiten"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {href ? (
              <Link
                to={href}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-semibold text-primary-600 hover:text-primary-800 underline-offset-2 hover:underline"
              >
                {entity.title} ansehen
              </Link>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenDetails?.(); }}
                className="text-xs font-semibold text-primary-600 hover:text-primary-800"
              >
                Details
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
