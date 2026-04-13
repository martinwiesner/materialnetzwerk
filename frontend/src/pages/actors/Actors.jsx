import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Plus, Search, X, Building2, Wrench, FlaskConical,
  Leaf, Store, Recycle, MapPin, Edit2, Trash2,
} from 'lucide-react';
import { actorService } from '../../services/actorService';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import ActorForm from '../../components/actors/ActorForm';
import ActorDetailOverlay from './ActorDetailOverlay';
import { imgUrl, TYPE_ICONS, TYPE_COLORS } from './ActorDetailOverlay';
import { useToast } from '../../store/toastStore';
import { OwnerLine } from '../../components/shared/ContactButton';

// ── Actor Card ────────────────────────────────────────────────────────────────

function ActorCard({ actor, onOpenDetail, onEdit, onDelete, isOwner }) {
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
          <span className="text-sm font-medium text-actor-600">Details anzeigen →</span>
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

export default function Actors() {
  const { isAuthenticated, token, user } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
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

  const toast = useToast();

  const deleteMutation = useMutation({
    mutationFn: actorService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors'] });
      toast.success('Akteur gelöscht.');
    },
    onError: () => toast.error('Löschen fehlgeschlagen.'),
  });

  const actors = Array.isArray(data) ? data : [];
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
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white translate-x-32 -translate-y-16" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white -translate-x-16 translate-y-16" />
        </div>
        <div className="relative px-8 py-12 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 text-white text-sm font-medium mb-4">
            <Users className="w-4 h-4" />
            Akteure
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white mb-4 leading-tight">
            Wer macht mit?<br />
            Menschen & Organisationen der Kreislaufwirtschaft.
          </h1>
          <p className="text-lg text-white/80 mb-8 max-w-xl">
            Makerspaces, Repair Cafés, verarbeitende Betriebe, Urban Miner und Kreativwerkstätten –
            hier präsentieren sich alle, die Materialien ein zweites Leben geben.
            Lege deine eigene Visitenkarte an.
          </p>
          <button
            onClick={() => { if (!requireAuth()) return; setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 bg-white text-actor-700 hover:bg-actor-50 px-6 py-3 rounded-xl font-semibold text-base transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Akteur eintragen
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
            placeholder="Name, Ort oder Typ…"
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
            Alle
          </button>
          {allTypes.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t === typeFilter ? '' : t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                typeFilter === t ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <span className="text-sm text-gray-500 ml-auto">
          {!isLoading && `${actors.length} Akteure`}
        </span>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : actors.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Noch keine Akteure eingetragen</h3>
          <p className="text-gray-500 mb-6">Sei der Erste!</p>
          <button
            onClick={() => { if (!requireAuth()) return; setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Akteur eintragen
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
