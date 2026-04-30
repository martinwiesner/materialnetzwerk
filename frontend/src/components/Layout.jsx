import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  FolderOpen,
  RefreshCw,
  LogOut,
  Mail,
  Menu,
  Package,
  Network,
  User,
  Users,
  X,
  Scale,
  Edit2,
  Check,
  MessageSquare,
  Bell,
  BellOff,
  Inbox,
  ClipboardList,
  FlaskConical,
  BookOpen,
} from 'lucide-react';

import { useAuthStore } from '../store/authStore';
import { useAuthOverlayStore } from '../store/authOverlayStore';
import { useGuidelinesStore } from '../store/guidelinesStore';
import { useToast } from '../store/toastStore';
import { usePush } from '../hooks/usePush';
import AuthOverlay from './auth/AuthOverlay';
import ToastContainer from './shared/ToastContainer';
import CoachMarks from './onboarding/CoachMarks';
import GuidelinesOverlay from './shared/GuidelinesOverlay';
import IncomingRequestsPanel from './requests/IncomingRequestsPanel';
import MyRequestsPanel from './requests/MyRequestsPanel';
import { messageService } from '../services/messageService';
import { materialRequestService } from '../services/materialRequestService';
import { authService } from '../services/authService';

const navigation = [
  { name: 'Netzwerk', href: '/', icon: Network },
  { name: 'Projekte', href: '/projects', icon: FolderOpen },
  { name: 'Materialien', href: '/materials', icon: Package },
  { name: 'Akteure', href: '/actors', icon: Users },
  { name: 'Nachrichten', href: '/messages', icon: Mail },
];

// ── Logo ──────────────────────────────────────────────────────────────────────

function Logo() {
  const openGuidelines = useGuidelinesStore((s) => s.open);
  return (
    <Link to="/" className="flex items-center gap-2" data-onboarding="logo">
      <div className="bg-primary-700 p-2 rounded-xl">
        <RefreshCw className="w-5 h-5 text-white" />
      </div>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-extrabold text-[16.2px] text-gray-900 tracking-tight">
            RZZ Materialien
          </span>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openGuidelines(); }}
            title="Beta-Version — Spielregeln ansehen"
            className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-colors"
          >
            Beta
          </button>
        </div>
        <div className="text-[11px] text-gray-500">Materialien • Projekte • Akteure</div>
      </div>
    </Link>
  );
}

// ── Impressum Overlay ─────────────────────────────────────────────────────────

function ImpressumOverlay({ onClose }) {
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
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-800">
            <Scale className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold">Impressum</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 space-y-4 text-xs text-gray-600 leading-relaxed">
          <div>
            <p className="font-semibold text-gray-800 text-sm mb-2">Projektverbund Reallabor Zekiwa Zeitz</p>
            <p className="mb-2">Das Reallabor ZEKIWA Zeitz ist ein gemeinsames Projekt von:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Hochschule Anhalt</li>
              <li>Stiftung Bauhaus Dessau</li>
              <li>Burg Giebichenstein Kunsthochschule Halle</li>
              <li>Martin-Luther-Universität Halle-Wittenberg</li>
              <li>Forum Rathenau e. V.</li>
              <li>Stadt Zeitz</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-0.5">Angaben gemäß § 5 TMG</p>
            <p>Hochschule Anhalt<br />
            Bernburger Straße 55<br />
            06366 Köthen<br />
            E-Mail: <a href="mailto:info@hs-anhalt.de" className="underline hover:text-gray-800">info@hs-anhalt.de</a></p>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-0.5">Umsatzsteuer</p>
            <p>Umsatzsteuer-Identifikationsnummer gemäß §27 a Umsatzsteuergesetz: DE814092585</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-0.5">Aufsichtsbehörde</p>
            <p>Ministerium für Wissenschaft, Energie, Klimaschutz und Umwelt des Landes Sachsen-Anhalt<br />
            Leipziger Straße 58<br />
            39112 Magdeburg<br />
            E-Mail: <a href="mailto:poststelle@mwu.sachsen-anhalt.de" className="underline hover:text-gray-800">poststelle@mwu.sachsen-anhalt.de</a><br />
            Web: <a href="https://www.mwu.sachsen-anhalt.de" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-800">www.mwu.sachsen-anhalt.de</a></p>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-0.5">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</p>
            <p>Reallabor ZEKIWA Zeitz<br />
            Gastprofessor Martin Wiesner (Projektkoordinator)<br />
            Telefon: +49 (0) 340 5197 1748<br />
            E-Mail: <a href="mailto:martin.wiesner@hs-anhalt.de" className="underline hover:text-gray-800">martin.wiesner@hs-anhalt.de</a></p>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-0.5">Haftungsausschluss</p>
            <p className="mb-2">Die inhaltliche Verantwortung der einzelnen WWW-Seiten liegt bei den jeweiligen informationseinstellenden Einrichtungen oder Personen. Eine Haftung für die Aktualität, Korrektheit, Vollständigkeit und Qualität dieser Webseiten kann trotz sorgfältiger Prüfung nicht übernommen werden. Die Hochschule Anhalt übernimmt insbesondere keinerlei Haftung für eventuelle Schäden oder Konsequenzen, die durch die direkte oder indirekte Nutzung der angebotenen Inhalte entstehen.</p>
            <p className="font-medium text-gray-700 mb-0.5">Rechtswirksamkeit des Haftungsausschlusses</p>
            <p>Dieser Haftungsausschluss ist als Teil des Internetangebotes zu betrachten, von dem aus auf diesen Text verwiesen wurde. Sollten Teile oder einzelne Formulierungen des Textes der geltenden Rechtslage nicht, nicht mehr oder nicht vollständig entsprechen, gilt das rechtlich Gewollte und bleiben die übrigen Teile des Dokuments in ihrem Inhalt und ihrer Gültigkeit davon unberührt.</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-0.5">Urheberrecht</p>
            <p>Alle im Internetangebot der Hochschule Anhalt veröffentlichten Inhalte (Layout, Texte, Bilder, Grafiken, Tondokumente, Videosequenzen usw.) unterliegen dem Urheberrecht. Jede vom Urheberrechtsgesetz nicht zugelassene Verwertung bedarf vorheriger ausdrücklicher Zustimmung. Dies gilt insbesondere für Vervielfältigung, Bearbeitung, Übersetzung, Einspeicherung, Verarbeitung bzw. (öffentliche) Wiedergabe von Inhalten in Datenbanken oder anderen elektronischen Medien und Systemen. Fotokopien und Downloads von Web-Seiten für den privaten, wissenschaftlichen und nicht kommerziellen Gebrauch dürfen hergestellt werden. Alle innerhalb des Internetangebotes genannten und ggf. durch Dritte geschützten Marken und Warenzeichen unterliegen uneingeschränkt den Bestimmungen des jeweils gültigen Kennzeichenrechts und den Besitzrechten der jeweiligen eingetragenen Eigentümer. Allein aufgrund der bloßen Nennung ist nicht der Schluss zu ziehen, dass Markenzeichen nicht durch Rechte Dritter geschützt sind.</p>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="font-medium text-gray-700 mb-0.5">Datenschutz</p>
            <p>Die Datenschutzerklärung der Hochschule Anhalt gilt auch für dieses Angebot:{' '}
              <a href="https://www.hs-anhalt.de/datenschutz.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-800">
                www.hs-anhalt.de/datenschutz.html
              </a>
            </p>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Account Drawer ────────────────────────────────────────────────────────────

function AccountDrawer({ open, onClose, user, onLogout, isAuthenticated, token, pendingRequestCount, onShowRequests, onShowMyRequests }) {
  const [tab, setTab] = useState('profile');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '' });
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { subscribed, permission, loading: pushLoading, enable: enablePush, disable: disablePush, supported: pushSupported } = usePush(isAuthenticated);

  const { data: inboxData } = useQuery({
    queryKey: ['messages-inbox'],
    queryFn: messageService.getInbox,
    enabled: Boolean(open && isAuthenticated && token),
  });

  const { data: unreadData } = useQuery({
    queryKey: ['messages-unread-count'],
    queryFn: messageService.getUnreadCount,
    enabled: Boolean(isAuthenticated && token),
  });

  const updateMutation = useMutation({
    mutationFn: authService.updateMe,
    onSuccess: (data) => {
      const updated = data.user || data;
      useAuthStore.getState().updateUser({
        ...user,
        ...updated,
        firstName: updated.first_name,
        lastName: updated.last_name,
      });
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      setEditing(false);
      toast.success('Profil gespeichert.');
    },
    onError: () => toast.error('Speichern fehlgeschlagen.'),
  });

  useEffect(() => {
    if (open) {
      setTab('profile');
      setEditing(false);
    }
  }, [open]);

  useEffect(() => {
    if (editing) {
      setForm({
        first_name: user?.firstName || user?.first_name || '',
        last_name: user?.lastName || user?.last_name || '',
      });
    }
  }, [editing, user]);

  if (!open) return null;

  const initials = (user?.firstName?.[0] || user?.username?.[0] || user?.email?.[0] || 'U').toUpperCase();
  const displayName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.username || 'Account';
  const unreadCount = unreadData?.count || 0;

  const conversations = Array.isArray(inboxData?.messages)
    ? inboxData.messages
    : Array.isArray(inboxData)
    ? inboxData
    : [];

  const recentConversations = conversations.slice(0, 4);

  return (
    <div className="fixed inset-0 z-[9998]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md">
        <div className="h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-semibold text-sm">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{displayName}</div>
                <div className="text-xs text-gray-500 truncate">{user?.email}</div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setTab('profile')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-b-2',
                tab === 'profile' ? 'border-primary-700 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <User className="w-4 h-4" />
              Profil
            </button>
            <button
              onClick={() => setTab('messages')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-b-2 relative',
                tab === 'messages' ? 'border-primary-700 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <MessageSquare className="w-4 h-4" />
              Nachrichten
              {unreadCount > 0 && (
                <span className="absolute top-2 right-6 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-actor-500 text-white text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'profile' && (
              <div className="space-y-4">
                {/* Profile info / edit */}
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  {editing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Vorname</label>
                          <input
                            value={form.first_name}
                            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-400 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Nachname</label>
                          <input
                            value={form.last_name}
                            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-400 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateMutation.mutate(form)}
                          disabled={updateMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-700 text-white rounded-lg text-xs font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {updateMutation.isPending ? 'Speichern…' : 'Speichern'}
                        </button>
                        <button
                          onClick={() => setEditing(false)}
                          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{displayName}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{user?.email}</div>
                        {user?.is_admin && (
                          <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">Admin</span>
                        )}
                      </div>
                      <button
                        onClick={() => setEditing(true)}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Profil bearbeiten"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick links */}
                <div className="space-y-1">
                  <Link
                    to="/materials"
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Package className="w-4 h-4 text-primary-600" />
                    Meine Materialien
                  </Link>
                  <Link
                    to="/projects"
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FolderOpen className="w-4 h-4 text-project-600" />
                    Meine Projekte
                  </Link>
                  <Link
                    to="/actors"
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Users className="w-4 h-4 text-actor-600" />
                    Meine Akteure
                  </Link>
                  <button
                    onClick={() => { onClose(); onShowMyRequests(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <ClipboardList className="w-4 h-4 text-primary-500" />
                    Meine Anfragen
                  </button>
                  <button
                    onClick={() => { onClose(); onShowRequests(); }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Inbox className="w-4 h-4 text-orange-500" />
                      Eingehende Anfragen
                    </span>
                    {pendingRequestCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                        {pendingRequestCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Push toggle */}
                {pushSupported && permission !== 'denied' && (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                          {subscribed ? <Bell className="w-4 h-4 text-project-600" /> : <BellOff className="w-4 h-4 text-gray-400" />}
                          Benachrichtigungen
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {subscribed ? 'Aktiv — du wirst bei neuen Nachrichten informiert.' : 'Deaktiviert'}
                        </div>
                      </div>
                      <button
                        onClick={subscribed ? disablePush : enablePush}
                        disabled={pushLoading}
                        className={clsx(
                          'flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50',
                          subscribed ? 'bg-project-500' : 'bg-gray-300'
                        )}
                      >
                        <span className={clsx(
                          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                          subscribed ? 'translate-x-6' : 'translate-x-1'
                        )} />
                      </button>
                    </div>
                    {permission === 'denied' && (
                      <p className="mt-2 text-xs text-actor-600">Benachrichtigungen sind im Browser blockiert.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'messages' && (
              <div className="space-y-3">
                {unreadCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-actor-50 border border-actor-200 rounded-xl text-xs text-actor-800">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    {unreadCount} ungelesene Nachricht{unreadCount !== 1 ? 'en' : ''}
                  </div>
                )}

                {recentConversations.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-500">
                    <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    Noch keine Nachrichten
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentConversations.map((msg) => {
                      const other = msg.sender_id === user?.id ? msg.receiver_name : msg.sender_name;
                      return (
                        <button
                          key={msg.id}
                          onClick={() => { onClose(); navigate('/messages'); }}
                          className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {(other?.[0] || '?').toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-gray-900 truncate">{other || 'Unbekannt'}</span>
                              {!msg.is_read && msg.receiver_id === user?.id && (
                                <span className="w-2 h-2 rounded-full bg-actor-500 flex-shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate mt-0.5">{msg.subject || msg.content}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <Link
                  to="/messages"
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Alle Nachrichten anzeigen
                </Link>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={onLogout}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Abmelden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function Layout() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, logout, isAuthenticated, token } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);
  const { isOpen: guidelinesOpen, open: openGuidelines, close: closeGuidelines } = useGuidelinesStore();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [showImpressum, setShowImpressum] = useState(false);
  const [showIncomingRequests, setShowIncomingRequests] = useState(false);
  const [showMyRequests, setShowMyRequests] = useState(false);
  const [betaBannerDismissed, setBetaBannerDismissed] = useState(() => {
    try { return localStorage.getItem('rzz_beta_banner_dismissed') === 'true'; } catch { return false; }
  });
  const dismissBetaBanner = () => {
    setBetaBannerDismissed(true);
    try { localStorage.setItem('rzz_beta_banner_dismissed', 'true'); } catch {}
  };

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const { data: unreadCount } = useQuery({
    queryKey: ['messages-unread-count'],
    queryFn: messageService.getUnreadCount,
    refetchInterval: 30000,
    enabled: Boolean(isAuthenticated && token),
  });

  const { data: incomingRequests = [] } = useQuery({
    queryKey: ['incoming-requests'],
    queryFn: materialRequestService.getIncoming,
    refetchInterval: 60000,
    enabled: Boolean(isAuthenticated && token),
  });
  const pendingRequestCount = incomingRequests.filter(r => r.status === 'pending').length;

  const displayName = useMemo(() => {
    if (isAuthenticated && token) {
      return user?.firstName || user?.username || user?.email?.split('@')[0] || 'User';
    }
    return 'Gast';
  }, [isAuthenticated, token, user]);

  const handleLogout = () => {
    queryClient.clear();
    logout();
    setAccountDrawerOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AuthOverlay />
      <ToastContainer />
      <CoachMarks />
      {guidelinesOpen && <GuidelinesOverlay onClose={closeGuidelines} />}

      {/* Beta banner — shown once until dismissed */}
      {!betaBannerDismissed && (
        <div className="bg-amber-50 border-b border-amber-200 text-center py-1.5 px-4 text-xs text-amber-800 flex items-center justify-center gap-2 relative">
          <FlaskConical className="w-3 h-3 flex-shrink-0" />
          <span>
            Diese Plattform befindet sich in der <strong>Beta-Phase</strong>.{' '}
            <button onClick={openGuidelines} className="underline hover:text-amber-900 transition-colors">
              Spielregeln &amp; Richtlinien ansehen
            </button>
          </span>
          <button
            onClick={dismissBetaBanner}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-600 transition-colors p-0.5 rounded"
            aria-label="Hinweis schließen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <AccountDrawer
        open={accountDrawerOpen}
        onClose={() => setAccountDrawerOpen(false)}
        user={user}
        onLogout={handleLogout}
        isAuthenticated={isAuthenticated}
        token={token}
        pendingRequestCount={pendingRequestCount}
        onShowRequests={() => setShowIncomingRequests(true)}
        onShowMyRequests={() => setShowMyRequests(true)}
      />

      {showImpressum && <ImpressumOverlay onClose={() => setShowImpressum(false)} />}
      {showIncomingRequests && <IncomingRequestsPanel onClose={() => setShowIncomingRequests(false)} />}
      {showMyRequests && <MyRequestsPanel onClose={() => setShowMyRequests(false)} />}

      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="mx-auto max-w-[1400px] px-4">
          <div className="h-16 flex items-center gap-3">
            <div className="flex items-center gap-3 flex-1">
              <Logo />
              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-1 ml-6">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
                  const showBadge = item.href === '/messages' && unreadCount?.count > 0;
                  const onboardingKey = item.href === '/materials' ? 'nav-materials' : item.href === '/messages' ? 'nav-messages' : undefined;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      data-onboarding={onboardingKey}
                      className={clsx(
                        'relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                        isActive ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.name}
                      {showBadge && (
                        <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-actor-500 text-white text-[11px]">
                          {unreadCount.count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <div className="hidden lg:block text-sm text-gray-600">Welcome, {displayName}</div>

              {/* Mobile nav toggle */}
              <button
                type="button"
                onClick={() => setMobileNavOpen((v) => !v)}
                className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
                aria-label="Toggle navigation"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Account button */}
              <button
                type="button"
                data-onboarding="account-button"
                onClick={() => {
                  if (isAuthenticated && token) {
                    setAccountDrawerOpen(true);
                  } else {
                    openAuth({
                      tab: 'login',
                      reason: 'Bitte logge dich ein, um Materialien anzulegen oder Nachrichten zu senden.',
                    });
                  }
                }}
                className="relative inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:bg-gray-800"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{isAuthenticated && token ? 'Account' : 'Login'}</span>
                <ChevronRight className="w-4 h-4 opacity-80" />
                {pendingRequestCount > 0 && isAuthenticated && (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold border-2 border-gray-900">
                    {pendingRequestCount}
                  </span>
                )}
                {pendingRequestCount === 0 && unreadCount?.count > 0 && isAuthenticated && (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-actor-500 text-white text-[10px] font-bold border-2 border-gray-900">
                    {unreadCount.count}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Mobile nav panel */}
          {mobileNavOpen && (
            <div className="md:hidden pb-4">
              <div className="grid grid-cols-1 gap-2 mt-2">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
                  const showBadge = item.href === '/messages' && unreadCount?.count > 0;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={clsx(
                        'flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium',
                        isActive ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        <item.icon className="w-4 h-4" />
                        {item.name}
                      </span>
                      {showBadge && (
                        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-actor-500 text-white text-[11px]">
                          {unreadCount.count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-[1400px] p-4 lg:p-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-[1400px] px-4 pb-6 pt-2">
        <div className="border-t border-gray-100 pt-4 flex items-center justify-between flex-wrap gap-3">
          {/* Funding logos */}
          <div className="flex items-center gap-4">
            <img src="/assets/logos/logo_rzz.svg" alt="Reallabor ZEKIWA Zeitz" className="w-auto object-contain flex-shrink-0" style={{ height: 32, maxWidth: 120 }} />
            <a href="https://www.neuebauhaeusler.com" target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
              <img src="/assets/logos/logo_neb.svg" alt="Neue Bauhäusler – Landesinitiative Sachsen-Anhalt" className="h-10 w-auto max-w-[140px] object-contain" style={{ minWidth: 80 }} />
            </a>
            <img src="/assets/logos/logo_eu_foerderung.svg" alt="Gefördert durch die Europäische Union" className="h-10 w-auto max-w-[200px] object-contain flex-shrink-0" style={{ minWidth: 120 }} />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={openGuidelines}
              className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              <BookOpen className="w-3 h-3" />
              Spielregeln
            </button>
            <a
              href="https://www.hs-anhalt.de/datenschutz.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Datenschutz
            </a>
            <button
              onClick={() => setShowImpressum(true)}
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Impressum
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
