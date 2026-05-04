import { useState } from 'react';
import { Settings, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useSettings, useUpdateSetting } from '../../hooks/useSettings';
import { useAuthStore } from '../../store/authStore';
import { Navigate } from 'react-router-dom';

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

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const user = useAuthStore((s) => s.user);
  const { data: settings, isLoading } = useSettings();

  if (!user?.is_admin) return <Navigate to="/" replace />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Admin-Panel</h1>
          <p className="text-xs text-gray-500">Plattform-Texte bearbeiten</p>
        </div>
      </div>

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

    </div>
  );
}
