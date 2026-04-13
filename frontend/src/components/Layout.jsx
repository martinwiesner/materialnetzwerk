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
  Store,
  User,
  Users,
  X,
  Scale,
  Shield,
  Edit2,
  Check,
  MessageSquare,
  Bell,
  BellOff,
} from 'lucide-react';

import { useAuthStore } from '../store/authStore';
import { useAuthOverlayStore } from '../store/authOverlayStore';
import { useToast } from '../store/toastStore';
import { usePush } from '../hooks/usePush';
import AuthOverlay from './auth/AuthOverlay';
import ToastContainer from './shared/ToastContainer';
import { messageService } from '../services/messageService';
import { authService } from '../services/authService';

const navigation = [
  { name: 'Explore', href: '/', icon: Store },
  { name: 'Projekte', href: '/projects', icon: FolderOpen },
  { name: 'Materialien', href: '/materials', icon: Package },
  { name: 'Akteure', href: '/actors', icon: Users },
  { name: 'Nachrichten', href: '/messages', icon: Mail },
];

// ── Logo ──────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div className="bg-primary-700 p-2 rounded-xl">
        <RefreshCw className="w-5 h-5 text-white" />
      </div>
      <div className="leading-tight">
        <div className="font-display font-extrabold text-sm text-gray-900 tracking-tight">
          Materialnetzwerk
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
            <p className="font-semibold text-gray-800 text-sm mb-1">Angaben gemäß § 5 TMG</p>
            <p>Ressourcenzentrum Zukunft (RZZ)<br />
            Musterstraße 1<br />
            12345 Musterstadt<br />
            Deutschland</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-0.5">Kontakt</p>
            <p>E-Mail: kontakt@rzz.de</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-0.5">Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)</p>
            <p>Ressourcenzentrum Zukunft, Musterstraße 1, 12345 Musterstadt</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-0.5">Haftungsausschluss</p>
            <p>Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte
            externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.
            Die Nutzungsinhalte (Materialien, Akteure, Projekte) werden von den jeweiligen Nutzer·innen
            eingetragen und liegen in deren Verantwortung.</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-0.5">Datenschutz</p>
            <p>Es werden ausschließlich die zur Nutzung der Plattform notwendigen Daten gespeichert
            (E-Mail, Passwort-Hash). Es erfolgt keine Weitergabe an Dritte.
            Anfragen zur Datenlöschung bitte per E-Mail an kontakt@rzz.de.</p>
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

// ── Datenschutz Overlay ───────────────────────────────────────────────────────

function DatenschutzOverlay({ onClose }) {
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
            <Shield className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold">Datenschutzerklärung</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 space-y-4 text-xs text-gray-600 leading-relaxed">
          <div>
            <p className="font-semibold text-gray-800 text-sm mb-1">1. Verantwortliche Stelle</p>
            <p>Ressourcenzentrum Zukunft (RZZ), Musterstraße 1, 12345 Musterstadt. E-Mail: kontakt@rzz.de</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">2. Erhobene Daten</p>
            <p>Bei der Registrierung werden <strong>Vorname, Nachname und E-Mail-Adresse</strong> erhoben.
            Das Passwort wird ausschließlich als nicht umkehrbarer Hash gespeichert.
            Nutzungsinhalte (Materialien, Projekte, Akteure, Nachrichten) werden dem jeweiligen Account zugeordnet.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">3. Zweck der Verarbeitung</p>
            <p>Die Daten dienen ausschließlich dem Betrieb der Plattform (Authentifizierung, Zuordnung von Inhalten, interne Kommunikation zwischen Nutzer·innen).</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">4. Weitergabe an Dritte</p>
            <p>Eine Weitergabe personenbezogener Daten an Dritte erfolgt nicht. Die Plattform nutzt keine externen Tracking- oder Analysedienste.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">5. Cookies & lokaler Speicher</p>
            <p>Die Anwendung speichert den Login-Token im lokalen Browserspeicher (localStorage) zur Aufrechterhaltung der Sitzung. Es werden keine Tracking-Cookies gesetzt.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">6. Rechte der Nutzer·innen</p>
            <p>Sie haben das Recht auf Auskunft, Berichtigung und Löschung Ihrer gespeicherten Daten (Art. 15–17 DSGVO).
            Anfragen bitte per E-Mail an kontakt@rzz.de. Account-Löschung auf Anfrage innerhalb von 14 Werktagen.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">7. Hosting & Serverstandort</p>
            <p>Die Plattform wird auf Servern innerhalb der EU betrieben (Hetzner Online GmbH, Deutschland).</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">8. Änderungen</p>
            <p>Diese Datenschutzerklärung kann bei Bedarf angepasst werden. Die aktuelle Version ist stets auf dieser Seite abrufbar.</p>
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

function AccountDrawer({ open, onClose, user, onLogout, isAuthenticated, token }) {
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

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [showImpressum, setShowImpressum] = useState(false);
  const [showDatenschutz, setShowDatenschutz] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const { data: unreadCount } = useQuery({
    queryKey: ['messages-unread-count'],
    queryFn: messageService.getUnreadCount,
    refetchInterval: 30000,
    enabled: Boolean(isAuthenticated && token),
  });

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

      <AccountDrawer
        open={accountDrawerOpen}
        onClose={() => setAccountDrawerOpen(false)}
        user={user}
        onLogout={handleLogout}
        isAuthenticated={isAuthenticated}
        token={token}
      />

      {showImpressum && <ImpressumOverlay onClose={() => setShowImpressum(false)} />}
      {showDatenschutz && <DatenschutzOverlay onClose={() => setShowDatenschutz(false)} />}

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
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
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
                {unreadCount?.count > 0 && isAuthenticated && (
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
        <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">© {new Date().getFullYear()} Materialnetzwerk</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowDatenschutz(true)}
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Datenschutz
            </button>
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
