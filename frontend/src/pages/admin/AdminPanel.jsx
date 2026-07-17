import { useState } from 'react';
import { Settings, Check, AlertCircle, ChevronDown, ChevronUp, BarChart2, Users, Shield, ShieldOff } from 'lucide-react';
import { useSettings, useUpdateSetting } from '../../hooks/useSettings';
import { useAuthStore } from '../../store/authStore';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import api from '../../services/api';
import AdminDashboard from './AdminDashboard';

// ── helpers ────────────────────────────────────────────────────────────────────

function parseList(jsonStr) {
  try { return JSON.parse(jsonStr).join('\n'); } catch { return jsonStr || ''; }
}

function serializeList(text) {
  return JSON.stringify(
    text.split('\n').map((l) => l.trim()).filter(Boolean)
  );
}

// ── sub-components ─────────────────────────────────────────────────────────────

function SaveButton({ saving, saved, error }) {
  if (saving) return <span className="text-xs text-gray-400">Speichern…</span>;
  if (saved) return <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="w-3.5 h-3.5" />Gespeichert</span>;
  if (error) return <span className="inline-flex items-center gap-1 text-xs text-red-500"><AlertCircle className="w-3.5 h-3.5" />{error}</span>;
  return null;
}

function FieldCard({ title, description, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-4">{children}</div>}
    </div>
  );
}

// ── Field: plain textarea ──────────────────────────────────────────────────────

function InputField({ label, settingKey, currentValue, hint, type = 'text', placeholder = '' }) {
  const [val, setVal] = useState(currentValue ?? '');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const update = useUpdateSetting();

  async function handleSave() {
    setSaved(false); setSaveError('');
    try {
      await update.mutateAsync({ key: settingKey, value: val });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError('Fehler beim Speichern');
    }
  }

  return (
    <div className="space-y-2">
      {label && <label className="block text-xs font-medium text-gray-700">{label}</label>}
      {hint && <p className="text-[11px] text-gray-400 leading-snug">{hint}</p>}
      <input
        type={type}
        value={val}
        placeholder={placeholder}
        onChange={(e) => { setVal(e.target.value); setSaved(false); }}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary-300"
      />
      <div className="flex items-center justify-between">
        <SaveButton saving={update.isPending} saved={saved} error={saveError} />
        <button
          type="button"
          onClick={handleSave}
          disabled={update.isPending}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          Speichern
        </button>
      </div>
    </div>
  );
}

function TextField({ label, settingKey, currentValue, hint }) {
  const [val, setVal] = useState(currentValue ?? '');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const update = useUpdateSetting();

  async function handleSave() {
    setSaved(false); setSaveError('');
    try {
      await update.mutateAsync({ key: settingKey, value: val });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError('Fehler beim Speichern');
    }
  }

  return (
    <div className="space-y-2">
      {label && <label className="block text-xs font-medium text-gray-700">{label}</label>}
      {hint && <p className="text-[11px] text-gray-400 leading-snug">{hint}</p>}
      <textarea
        rows={4}
        value={val}
        onChange={(e) => { setVal(e.target.value); setSaved(false); }}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary-300"
      />
      <div className="flex items-center justify-between">
        <SaveButton saving={update.isPending} saved={saved} error={saveError} />
        <button
          type="button"
          onClick={handleSave}
          disabled={update.isPending}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          Speichern
        </button>
      </div>
    </div>
  );
}

// ── Field: list (one item per line) ───────────────────────────────────────────

function ListField({ label, settingKey, currentValue, hint }) {
  const [val, setVal] = useState(() => parseList(currentValue));
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const update = useUpdateSetting();

  async function handleSave() {
    setSaved(false); setSaveError('');
    try {
      await update.mutateAsync({ key: settingKey, value: serializeList(val) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError('Fehler beim Speichern');
    }
  }

  return (
    <div className="space-y-2">
      {label && <label className="block text-xs font-medium text-gray-700">{label}</label>}
      {hint && <p className="text-[11px] text-gray-400 leading-snug">{hint}</p>}
      <textarea
        rows={6}
        value={val}
        onChange={(e) => { setVal(e.target.value); setSaved(false); }}
        placeholder="Ein Listeneintrag pro Zeile"
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary-300"
      />
      <div className="flex items-center justify-between">
        <SaveButton saving={update.isPending} saved={saved} error={saveError} />
        <button
          type="button"
          onClick={handleSave}
          disabled={update.isPending}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          Speichern
        </button>
      </div>
    </div>
  );
}

// ── UserList ───────────────────────────────────────────────────────────────────

function UserList() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then(r => r.data),
  });

  const patchUser = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/admin/users/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  if (isLoading) return <p className="text-sm text-gray-400 py-6 text-center">Lade Nutzerliste…</p>;
  if (!users.length) return <p className="text-sm text-gray-400">Keine Nutzer gefunden.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-2.5 font-medium">Nutzer</th>
            <th className="text-left px-4 py-2.5 font-medium">Akteur</th>
            <th className="text-right px-4 py-2.5 font-medium">Mat.</th>
            <th className="text-right px-4 py-2.5 font-medium">Proj.</th>
            <th className="text-right px-4 py-2.5 font-medium">Admin</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className="px-4 py-2.5">
                <p className="font-medium text-gray-800 truncate max-w-[180px]">
                  {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                </p>
                <p className="text-xs text-gray-400 truncate max-w-[180px]">{u.email}</p>
              </td>
              <td className="px-4 py-2.5 text-gray-500 text-xs truncate max-w-[140px]">
                {u.actor_name || <span className="text-gray-300">–</span>}
              </td>
              <td className="px-4 py-2.5 text-right text-gray-600">{u.mat_count}</td>
              <td className="px-4 py-2.5 text-right text-gray-600">{u.proj_count}</td>
              <td className="px-4 py-2.5 text-right">
                <button
                  onClick={() => patchUser.mutate({ id: u.id, is_admin: !u.is_admin })}
                  title={u.is_admin ? 'Admin-Rechte entziehen' : 'Zum Admin machen'}
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${
                    u.is_admin
                      ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                      : 'bg-white text-gray-300 border-gray-200 hover:text-gray-500'
                  }`}
                >
                  {u.is_admin ? <Shield className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const user = useAuthStore((s) => s.user);
  const { data: settings, isLoading } = useSettings();
  const [tab, setTab] = useState('dashboard');

  if (!user?.is_admin) return <Navigate to="/" replace />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Admin-Panel</h1>
          <p className="text-xs text-gray-500">Plattform-Verwaltung</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab('dashboard')}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'dashboard'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Dashboard
        </button>
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'users'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Nutzer
        </button>
        <button
          type="button"
          onClick={() => setTab('settings')}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'settings'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="w-4 h-4" />
          Einstellungen
        </button>
      </div>

      {/* Tab content */}
      {tab === 'dashboard' && <AdminDashboard />}
      {tab === 'users' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">{`Alle registrierten Nutzer — Klick auf den Schild-Button gibt Admin-Rechte.`}</p>
          <UserList />
        </div>
      )}

      {tab === 'settings' && <div className="space-y-8">

      {/* ── Benachrichtigungen ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
          Benachrichtigungen
        </h2>
        <FieldCard
          title="Benachrichtigungs-E-Mails"
          description="Diese Adressen erhalten eine Kopie jeder Nachricht, die über die Plattform gesendet wird"
        >
          <ListField
            settingKey="notification_emails"
            currentValue={settings?.notification_emails}
            hint="Eine E-Mail-Adresse pro Zeile. Wird zusätzlich zum eigentlichen Empfänger benachrichtigt."
          />
        </FieldCard>
      </section>

      {/* ── Intro-Text ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
          Intro-Text
        </h2>
        <FieldCard
          title="Plattform-Beschreibung"
          description="Wird im Spielregeln-Dialog ganz oben angezeigt"
        >
          <TextField
            settingKey="platform_intro"
            currentValue={settings?.platform_intro}
            hint="Zeilenumbrüche werden als Absätze dargestellt. Kein HTML erforderlich."
            rows={4}
          />
        </FieldCard>
      </section>

      {/* ── Spielregeln: Materialien ────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
          Spielregeln — Materialien
        </h2>
        <FieldCard
          title="Was gehört hierher (✓-Liste)"
          description="Positive Kriterien für Materialien"
        >
          <ListField
            settingKey="guidelines_materials_yes"
            currentValue={settings?.guidelines_materials_yes}
            hint="Ein Eintrag pro Zeile. HTML-Tags wie <strong>…</strong> sind erlaubt."
          />
        </FieldCard>
        <FieldCard
          title="Was gehört NICHT hierher (✗-Liste)"
          description="Ausschlusskriterien für Materialien"
        >
          <ListField
            settingKey="guidelines_materials_no"
            currentValue={settings?.guidelines_materials_no}
            hint="Ein Eintrag pro Zeile. Kein HTML notwendig."
          />
        </FieldCard>
      </section>

      {/* ── Spielregeln: Projekte ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
          Spielregeln — Projekte
        </h2>
        <FieldCard title="Was gehört hierher (✓-Liste)">
          <ListField
            settingKey="guidelines_projects_yes"
            currentValue={settings?.guidelines_projects_yes}
            hint="Ein Eintrag pro Zeile. HTML-Tags wie <strong>…</strong> sind erlaubt."
          />
        </FieldCard>
        <FieldCard title="Was gehört NICHT hierher (✗-Liste)">
          <ListField
            settingKey="guidelines_projects_no"
            currentValue={settings?.guidelines_projects_no}
            hint="Ein Eintrag pro Zeile."
          />
        </FieldCard>
      </section>

      {/* ── Spielregeln: Akteure ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
          Spielregeln — Akteure
        </h2>
        <FieldCard title="Was gehört hierher (✓-Liste)">
          <ListField
            settingKey="guidelines_actors_yes"
            currentValue={settings?.guidelines_actors_yes}
            hint="Ein Eintrag pro Zeile. HTML-Tags wie <strong>…</strong> sind erlaubt."
          />
        </FieldCard>
        <FieldCard title="Was gehört NICHT hierher (✗-Liste)">
          <ListField
            settingKey="guidelines_actors_no"
            currentValue={settings?.guidelines_actors_no}
            hint="Ein Eintrag pro Zeile."
          />
        </FieldCard>
      </section>

      {/* ── AGB ────────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
          Nutzungsbedingungen &amp; AGB
        </h2>
        <FieldCard
          title="AGB-Text (HTML)"
          description="Ersetzt den eingebauten AGB-Text wenn ausgefüllt"
        >
          <TextField
            settingKey="agb_html"
            currentValue={settings?.agb_html ?? ''}
            hint="Wird als HTML gerendert. Leer lassen = eingebauter Standardtext wird gezeigt. Unterstützte Tags: <p>, <strong>, <em>, <ul>, <li>, <a href='…'>."
            rows={12}
          />
        </FieldCard>
      </section>

      {/* ── Integrationen ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
          Integrationen — OpenProject
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Wenn ein API-Key eingetragen ist, können Nutzer Verbesserungsvorschläge direkt als Work Packages in OpenProject anlegen.
          Leer lassen um die Funktion zu deaktivieren.
        </p>
        <FieldCard title="API-Key" description="Persönlicher API-Key aus OpenProject (Mein Konto → API-Zugriffsschlüssel)">
          <InputField
            settingKey="openproject_api_key"
            currentValue={settings?.openproject_api_key}
            type="password"
            placeholder="Leer lassen = Funktion deaktiviert"
            hint="Wird sicher in der Datenbank gespeichert. Nicht im Code oder in .env-Dateien nötig."
          />
        </FieldCard>
        <FieldCard title="OpenProject URL" description="Basis-URL deiner OpenProject-Instanz">
          <InputField
            settingKey="openproject_url"
            currentValue={settings?.openproject_url}
            placeholder="https://openproject.example.com"
          />
        </FieldCard>
        <FieldCard title="Projekt-ID" description="Numerische ID des Zielprojekts in OpenProject">
          <InputField
            settingKey="openproject_project_id"
            currentValue={settings?.openproject_project_id}
            placeholder="z.B. 3"
          />
        </FieldCard>
        <FieldCard title="Work-Package-Typ ID" description="ID des Work-Package-Typs (z.B. Feature, Bug)">
          <InputField
            settingKey="openproject_type_id"
            currentValue={settings?.openproject_type_id}
            placeholder="z.B. 1"
          />
        </FieldCard>
      </section>

      </div>}

    </div>
  );
}
