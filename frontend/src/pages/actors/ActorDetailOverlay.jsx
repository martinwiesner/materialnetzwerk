import { useEffect, useState } from 'react';
import { useT } from '../../i18n/useT';
import {
  X, MapPin, Globe, Mail, Phone, Edit2, Trash2,
  Building2, Wrench, FlaskConical, Leaf, Store, Recycle, Users,
  ChevronLeft, ChevronRight, UserPlus, UserMinus,
} from 'lucide-react';
import api, { MEDIA_BASE } from '../../services/api';
import { OwnerLine } from '../../components/shared/ContactButton';
import { useAuthStore } from '../../store/authStore';

const API_BASE = MEDIA_BASE;

export const TYPE_ICONS = {
  'Hersteller': Building2,
  'Lieferant / Händler': Store,
  'Forschung / Labor': FlaskConical,
  'Recycling / Verwertung': Recycle,
  'Urban Mining': FlaskConical,
  'Makerspace': Wrench,
  'Repair Café / Upcycling': Recycle,
  'Verarbeitender Betrieb': Building2,
  'Urban Mining / Forschung': FlaskConical,
  'Kreativwerkstatt': Leaf,
  'Verein': Users,
  'Unternehmen': Store,
  'Sonstiges': Building2,
};

export const TYPE_COLORS = {
  'Hersteller': 'bg-actor-50 text-actor-700 border-actor-200',
  'Lieferant / Händler': 'bg-actor-50 text-actor-700 border-actor-200',
  'Forschung / Labor': 'bg-actor-50 text-actor-700 border-actor-200',
  'Recycling / Verwertung': 'bg-actor-50 text-actor-700 border-actor-200',
  'Urban Mining': 'bg-actor-50 text-actor-700 border-actor-200',
  'Makerspace': 'bg-actor-100 text-actor-800 border-actor-200',
  'Repair Café / Upcycling': 'bg-actor-50 text-actor-700 border-actor-200',
  'Verarbeitender Betrieb': 'bg-actor-100 text-actor-800 border-actor-200',
  'Urban Mining / Forschung': 'bg-actor-50 text-actor-700 border-actor-200',
  'Kreativwerkstatt': 'bg-actor-100 text-actor-800 border-actor-200',
  'Verein': 'bg-actor-50 text-actor-700 border-actor-200',
  'Unternehmen': 'bg-actor-100 text-actor-800 border-actor-200',
  'Sonstiges': 'bg-gray-100 text-gray-700 border-gray-200',
};

export function imgUrl(img) {
  return img?.file_path ? `${API_BASE}${img.file_path.replace(/^\./, '')}` : null;
}

export default function ActorDetailOverlay({ actor, isOwner, onClose, onEdit, onDelete }) {
  const t = useT();
  const { user, updateUser } = useAuthStore();
  const [imgIdx, setImgIdx] = useState(0);
  const [members, setMembers] = useState([]);
  const [joining, setJoining] = useState(false);
  const [myRequestStatus, setMyRequestStatus] = useState(null); // null | 'pending' | 'approved' | 'rejected'
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showRequests, setShowRequests] = useState(false);

  const isInThisActor = myRequestStatus === 'member' || user?.actor_id === actor?.id;
  const membershipMode = actor?.membership_mode || 'open';

  const refreshMembers = () =>
    api.get(`/actors/${actor.id}/members`).then(r => setMembers(r.data || [])).catch(() => {});

  const handleJoin = async () => {
    setJoining(true);
    try {
      const { data } = await api.post(`/actors/${actor.id}/join`);
      if (data.status === 'joined') {
        updateUser({ ...user, actor_id: actor.id });
        setMyRequestStatus(null);
        await refreshMembers();
      } else if (data.status === 'pending') {
        setMyRequestStatus('pending');
      }
    } catch (e) { console.error(e); }
    finally { setJoining(false); }
  };

  const handleLeave = async () => {
    setJoining(true);
    try {
      await api.delete(`/actors/${actor.id}/leave`);
      updateUser({ ...user, actor_id: null });
      setMyRequestStatus(null);
      await refreshMembers();
    } catch (e) { console.error(e); }
    finally { setJoining(false); }
  };

  const handleRequest = async (requestId, status) => {
    try {
      await api.patch(`/actors/${actor.id}/membership-requests/${requestId}`, { status });
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      if (status === 'approved') await refreshMembers();
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!actor?.id) return;
    refreshMembers();
    if (user && !isOwner) {
      api.get(`/actors/${actor.id}/my-request`).then(r => setMyRequestStatus(r.data?.status || null)).catch(() => {});
    }
    if (isOwner) {
      api.get(`/actors/${actor.id}/membership-requests`).then(r => setPendingRequests(r.data || [])).catch(() => {});
    }
  }, [actor?.id]);
  const images = actor.images || [];
  const cover = images[imgIdx];
  const coverSrc = imgUrl(cover);
  const TypeIcon = TYPE_ICONS[actor.type] || Building2;
  const typeColor = TYPE_COLORS[actor.type] || TYPE_COLORS['Sonstiges'];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Image header */}
        <div className="relative w-full h-56 bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0">
          {coverSrc ? (
            <>
              <img src={coverSrc} alt={actor.name} className="w-full h-full object-cover" />
              {cover?.credit && (
                <span className="absolute bottom-2 right-2 text-[10px] font-light text-white/70 tracking-wide leading-none [writing-mode:vertical-rl] rotate-180 select-none pointer-events-none">
                  {cover.credit}
                </span>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <TypeIcon className="w-16 h-16 text-gray-300" />
            </div>
          )}

          {images.length > 1 && (
            <>
              <button
                onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setImgIdx(i => (i + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_, i) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIdx ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}

          <button onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-black/40 text-white rounded-full hover:bg-black/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {actor.type && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border mb-3 ${typeColor}`}>
              <TypeIcon className="w-3 h-3" />
              {actor.type}
            </span>
          )}

          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">{actor.name}</h2>
            {!isOwner && actor.owner_id && (
              <div className="flex-shrink-0">
                <OwnerLine
                  ownerId={actor.owner_id}
                  ownerFirstName={actor.owner_first_name}
                  ownerLastName={actor.owner_last_name}
                  ownerEmail={actor.owner_email}
                  contextLabel={actor.name}
                />
              </div>
            )}
          </div>
          {actor.tagline && (
            <p className="text-base text-gray-500 mt-1 italic">{actor.tagline}</p>
          )}
          {actor.location_name && (
            <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              {actor.location_name}
            </div>
          )}
          {actor.description && (
            <p className="mt-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{actor.description}</p>
          )}

          <div className="mt-5 space-y-2 pt-4 border-t border-gray-100">
            {actor.website && (
              <a href={actor.website} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-sm text-actor-600 hover:underline">
                <Globe className="w-4 h-4 flex-shrink-0" />
                {actor.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {actor.email && (
              <a href={`mailto:${actor.email}`}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
                <Mail className="w-4 h-4 flex-shrink-0" />
                {actor.email}
              </a>
            )}
            {actor.phone && (
              <a href={`tel:${actor.phone}`}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
                <Phone className="w-4 h-4 flex-shrink-0" />
                {actor.phone}
              </a>
            )}
            {actor.address && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {actor.address}
              </div>
            )}
          </div>

          {members.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <Users className="w-3.5 h-3.5" />
                Mitglieder ({members.length})
              </div>
              <ul className="space-y-1.5">
                {members.map(m => (
                  <li key={m.id} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-actor-100 text-actor-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {(m.first_name?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {[m.first_name, m.last_name].filter(Boolean).join(' ') || '—'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{m.email}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pending membership requests (owner only) */}
          {isOwner && pendingRequests.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowRequests(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2"
              >
                <span className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center text-[10px]">
                  {pendingRequests.length}
                </span>
                Beitrittsanfragen
              </button>
              {showRequests && (
                <ul className="space-y-2">
                  {pendingRequests.map(r => (
                    <li key={r.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-amber-50 border border-amber-100">
                      <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {(r.first_name?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{r.email}</p>
                      </div>
                      <button
                        onClick={() => handleRequest(r.id, 'approved')}
                        className="text-xs px-2 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleRequest(r.id, 'rejected')}
                        className="text-xs px-2 py-1 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300"
                      >
                        ✗
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {user && !isOwner && (
            <div>
              {isInThisActor ? (
                <button
                  onClick={handleLeave}
                  disabled={joining}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border text-red-600 border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <UserMinus className="w-4 h-4" />
                  Akteur verlassen
                </button>
              ) : myRequestStatus === 'pending' ? (
                <span className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border text-amber-600 border-amber-200 bg-amber-50">
                  Anfrage ausstehend…
                </span>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border text-actor-700 border-actor-200 hover:bg-actor-50 transition-colors disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  {membershipMode === 'approval_required' ? 'Mitgliedschaft beantragen' : 'Beitreten'}
                </button>
              )}
            </div>
          )}
          {isOwner && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => { onDelete(actor.id); onClose(); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {t('actorDetail.deleteButton')}
              </button>
              <button
                onClick={() => onEdit(actor)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-actor-600 hover:bg-actor-700 text-white rounded-xl transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                {t('actorDetail.editButton')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
