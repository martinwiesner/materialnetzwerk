import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Plus, Search, X, Building2, Wrench, FlaskConical,
  Leaf, Store, Recycle, MapPin, Edit2, Trash2, User,
} from 'lucide-react';
import { actorService } from '../../services/actorService';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import ActorForm from '../../components/actors/ActorForm';
import ActorDetailOverlay from './ActorDetailOverlay';
import { imgUrl, TYPE_ICONS, TYPE_COLORS } from './ActorDetailOverlay';
import RzzDecoration from '../../components/ui/RzzDecoration';
import { useToast } from '../../store/toastStore';
import ContactButton from '../../components/shared/ContactButton';
import { OwnerLine } from '../../components/shared/ContactButton';
import api from '../../services/api';
import { useT } from '../../i18n/useT';

function actorCompleteness(a) {
  let score = 0;
  if (a.images?.length > 0) score += 3;
  if (a.description) score += 2;
  if (a.latitude && a.longitude) score += 2;
  if (a.type) score += 1;
  if (a.email || a.website || a.phone) score += 2;
  return score;
}

// ── Actor Card ────────────────────────────────────────────────────────────────

function ActorCard({ actor, onOpenDetail, onEdit, onDelete, isOwner }) {
  const t = useT();
  const coverSrc = imgUrl(actor.images?.[0]);
  const TypeIcon = TYPE_ICONS[actor.type] || Building2;
  const typeColor = TYPE_COLORS[actor.type] || TYPE_COLORS['Sonstiges'];

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onOpenDetail(actor)}
    >
      {coverSrc ? (
        <img src={coverSrc} alt={actor.name} className="w-full h-44 object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <TypeIcon className="w-12 h-12 text-gray-300" />
        </div>
      )}

      <div className="p-5">
        {actor.type && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border mb-3 ${typeColor}`}>
            <TypeIcon className="w-3 h-3" />
            {actor.type}
          </span>
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-900 leading-tight">{actor.name}</h3>
            {actor.tagline && (
              <p className="text-sm text-gray-500 mt-1 italic line-clamp-2">{actor.tagline}</p>
            )}
          </div>
          {isOwner && (
            <div className="flex gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(actor); }}
                className="p-2 text-gray-400 hover:text-actor-600 hover:bg-actor-50 rounded-lg transition-colors"
                title="Bearbeiten"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(actor.id); }}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {actor.location_name && (
          <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            {actor.location_name}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-actor-600">{t('actors.viewDetails')}</span>
          {!isOwner && actor.owner_id && (
            <OwnerLine
              ownerId={actor.owner_id}
              ownerFirstName={actor.owner_first_name}
              ownerLastName={actor.owner_last_name}
              ownerEmail={actor.owner_email}
              contextLabel={actor.name}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function PersonCard({ person: u, currentUserId }) {
  const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
  const initials = (u.first_name?.[0] || u.email[0]).toUpperCase();
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-gray-800 truncate">{displayName}</p>
          <p className="text-xs text-gray-400 truncate">{u.email}</p>
          {u.actor_name && (
            <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-actor-50 text-actor-600 border border-actor-100">
              <Building2 className="w-2.5 h-2.5" />{u.actor_name}
            </span>
          )}
        </div>
      </div>
      {currentUserId !== u.id && (
        <ContactButton ownerId={u.id} ownerName={displayName} className="w-full justify-center text-xs" />
      )}
    </div>
  );
}

export default function Actors() {
  const t = useT();
  const { isAuthenticated, token, user } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState('actors'); // 'actors' | 'users' | 'all'
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailActor, setDetailActor] = useState(null);

  const requireAuth = () => {
    if (isAuthenticated && token) return true;
    openAuth({ tab: 'login', reason: 'Bitte logge dich ein, um einen Akteur anzulegen.' });
    return false;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['actors', search, typeFilter],
    queryFn: () => actorService.getAll({ search: search || undefined, type: typeFilter || undefined }),
  });

  const { data: directoryData, isLoading: dirLoading } = useQuery({
    queryKey: ['actor-directory', search, viewMode],
    queryFn: () => api.get(`/actors/directory/all?q=${encodeURIComponent(search)}&type=${viewMode}`).then(r => r.data),
    enabled: viewMode !== 'actors',
  });

  const toast = useToast();

  const deleteMutation = useMutation({
    mutationFn: actorService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors'] });
      toast.success('Akteur gelöscht.');
    },
    onError: () => toast.error('Löschen fehlgeschlagen.'),
  });

  const rawActors = Array.isArray(data) ? data : [];
  const actors = [...rawActors].sort((a, b) => actorCompleteness(b) - actorCompleteness(a));
  const allTypes = [...new Set(actors.map(a => a.type).filter(Boolean))].sort();

  const isOwnerOf = (actor) => isAuthenticated && (actor.owner_id === user?.id || user?.is_admin);

  const handleDelete = (id) => {
    if (window.confirm('Akteur wirklich löschen?')) deleteMutation.mutate(id);
  };

  const handleEdit = (actor) => {
    setEditing(actor);
    setDetailActor(null);
    setShowForm(true);
  };

  const handleOpenDetail = (actor) => {
    setDetailActor(actor);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ['actors'] });
  };

  return (
    <div className="space-y-0">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-actor-700 via-actor-500 to-actor-400 mb-8">
        <RzzDecoration className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-8 w-56 sm:w-72 md:w-96 lg:w-[30rem] text-white opacity-[0.13]" />
        <div className="relative px-8 py-12 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 text-white text-sm font-medium mb-4">
            <Users className="w-4 h-4" />
            {t('actors.label')}
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white mb-4 leading-tight">
            {t('actors.heroHeading')}
          </h1>
          <p className="text-lg text-white/80 mb-8 max-w-xl">
            {t('actors.heroBody')}
          </p>
          <button
            onClick={() => { if (!requireAuth()) return; setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 bg-white text-actor-700 hover:bg-actor-50 px-6 py-3 rounded-xl font-semibold text-base transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            {t('actors.ctaAdd')}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('actors.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTypeFilter('')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              !typeFilter ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t('common.all')}
          </button>
          {allTypes.map(typeName => (
            <button
              key={typeName}
              onClick={() => setTypeFilter(typeName === typeFilter ? '' : typeName)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                typeFilter === typeName ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {typeName}
            </button>
          ))}
        </div>

        {/* View mode switcher */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm ml-auto flex-shrink-0">
          {[
            { key: 'actors', label: 'Akteure',  Icon: Building2 },
            { key: 'users',  label: 'Personen', Icon: User       },
            { key: 'all',    label: 'Alle',      Icon: Users      },
          ].map(({ key, label, Icon }, i, arr) => (
            <button key={key} onClick={() => setViewMode(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${i < arr.length - 1 ? 'border-r border-gray-200' : ''} ${
                viewMode === key ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {viewMode !== 'actors' ? (
        /* Directory: users [+ actors] */
        (dirLoading) ? (
          <div className="text-center py-16"><div className="animate-spin w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full mx-auto" /></div>
        ) : (
          <div className="space-y-6">
            {/* Actor cards in directory mode */}
            {(directoryData?.actors || []).length > 0 && viewMode === 'all' && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Akteure</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {(directoryData?.actors || []).map(actor => (
                    <ActorCard key={actor.id} actor={actor} onOpenDetail={handleOpenDetail}
                      onEdit={handleEdit} onDelete={handleDelete} isOwner={isOwnerOf(actor)} />
                  ))}
                </div>
              </div>
            )}
            {/* User cards */}
            {(directoryData?.users || []).length > 0 && (
              <div>
                {viewMode === 'all' && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Personen</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {(directoryData?.users || []).map(u => (
                    <PersonCard key={u.id} person={u} currentUserId={user?.id} />
                  ))}
                </div>
              </div>
            )}
            {!(directoryData?.actors?.length) && !(directoryData?.users?.length) && (
              <div className="text-center py-16 text-gray-400 text-sm">Keine Ergebnisse.</div>
            )}
          </div>
        )
      ) : isLoading ? (
        <div className="text-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : (actors.length === 0) ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('actors.empty')}</h3>
          <p className="text-gray-500 mb-6">{t('actors.emptyHint')}</p>
          <button
            onClick={() => { if (!requireAuth()) return; setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('actors.ctaAdd')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {actors.map(actor => (
            <ActorCard
              key={actor.id}
              actor={actor}
              onOpenDetail={handleOpenDetail}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isOwner={isOwnerOf(actor)}
            />
          ))}
        </div>
      )}

      {/* Detail overlay */}
      {detailActor && (
        <ActorDetailOverlay
          actor={detailActor}
          isOwner={isOwnerOf(detailActor)}
          onClose={() => setDetailActor(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Create/edit form */}
      {showForm && (
        <ActorForm
          actor={editing}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
