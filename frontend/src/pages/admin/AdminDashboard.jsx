import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import {
  Package, FolderOpen, Users, Building2, Inbox, Bookmark,
  TrendingUp, AlertCircle
} from 'lucide-react';

async function fetchStats() {
  const res = await api.get('/admin/stats');
  return res.data;
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = 'blue', sub }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    violet: 'bg-violet-50 text-violet-600',
    amber:  'bg-amber-50 text-amber-600',
    rose:   'bg-rose-50 text-rose-600',
    gray:   'bg-gray-100 text-gray-500',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── CategoryBar ──────────────────────────────────────────────────────────────

function CategoryBar({ data, total }) {
  if (!data?.length) return <p className="text-sm text-gray-400">Keine Daten</p>;
  const max = data[0].count;
  return (
    <div className="space-y-2">
      {data.map((row) => (
        <div key={row.category} className="flex items-center gap-3">
          <span className="text-xs text-gray-600 w-36 truncate shrink-0" title={row.category}>
            {row.category}
          </span>
          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full bg-primary-400 transition-all"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-600 w-8 text-right">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── MonthChart ───────────────────────────────────────────────────────────────

function MonthChart({ data }) {
  if (!data?.length) return <p className="text-sm text-gray-400">Keine Daten</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((row) => {
        const pct = (row.count / max) * 100;
        const label = row.month?.slice(5); // MM
        return (
          <div key={row.month} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-[10px] text-gray-500">{row.count}</span>
            <div className="w-full bg-gray-100 rounded-t-md overflow-hidden" style={{ height: 64 }}>
              <div
                className="w-full bg-primary-400 rounded-t-md transition-all"
                style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchStats,
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-gray-400">Lade Statistiken…</div>;
  }

  if (error) {
    return (
      <div className="py-8 flex items-center gap-2 text-sm text-red-500">
        <AlertCircle className="w-4 h-4" />
        Fehler beim Laden: {error.message}
      </div>
    );
  }

  const { totals, byCategory, topBookmarked, activeUsers, materialsByMonth, openRequests } = data;

  return (
    <div className="space-y-6">

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon={Package}   label="Materialien"       value={totals.materials}       color="blue" />
        <StatCard icon={FolderOpen} label="Projekte"          value={totals.projects}         color="green" />
        <StatCard icon={Building2} label="Akteure"            value={totals.actors}           color="violet" />
        <StatCard icon={Users}     label="Nutzer"             value={totals.users}            color="gray" />
        <StatCard icon={Bookmark}  label="Bookmarks gesamt"   value={totals.bookmarks}        color="amber" />
        <StatCard
          icon={Inbox}
          label="Offene Anfragen"
          value={totals.pendingRequests}
          color={totals.pendingRequests > 0 ? 'rose' : 'gray'}
          sub={totals.pendingRequests > 0 ? 'Aktion erforderlich' : 'Keine offenen Anfragen'}
        />
      </div>

      {/* Category + monthly chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Materialien nach Kategorie">
          <CategoryBar data={byCategory} total={totals.materials} />
        </Section>
        <Section title="Neue Materialien (letzte 6 Monate)">
          <MonthChart data={materialsByMonth} />
        </Section>
      </div>

      {/* Top bookmarked + active users */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Meistgebookmarkte Materialien">
          {topBookmarked?.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Material</th>
                  <th className="text-left pb-2 font-medium">Kategorie</th>
                  <th className="text-right pb-2 font-medium">Bookmarks</th>
                </tr>
              </thead>
              <tbody>
                {topBookmarked.map((m) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 text-gray-800 max-w-[140px] truncate">{m.name}</td>
                    <td className="py-2 text-gray-500 text-xs">{m.category || '–'}</td>
                    <td className="py-2 text-right font-semibold text-primary-600">{m.bookmark_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">Noch keine Bookmarks vorhanden.</p>
          )}
        </Section>

        <Section title="Aktivste Nutzer">
          {activeUsers?.filter((u) => u.mat_count + u.proj_count > 0).length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Nutzer</th>
                  <th className="text-right pb-2 font-medium">Mat.</th>
                  <th className="text-right pb-2 font-medium">Proj.</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers
                  .filter((u) => u.mat_count + u.proj_count > 0)
                  .map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2">
                      <p className="text-gray-800 truncate max-w-[160px]">{u.display_name}</p>
                      <p className="text-[11px] text-gray-400 truncate max-w-[160px]">{u.email}</p>
                    </td>
                    <td className="py-2 text-right text-gray-600">{u.mat_count}</td>
                    <td className="py-2 text-right text-gray-600">{u.proj_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">Noch keine Inhalte erstellt.</p>
          )}
        </Section>
      </div>

      {/* Open requests */}
      {openRequests?.length > 0 && (
        <Section title={`Offene Materialanfragen (${openRequests.length})`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Anfragender</th>
                <th className="text-left pb-2 font-medium">Material</th>
                <th className="text-right pb-2 font-medium">Menge</th>
                <th className="text-right pb-2 font-medium">Datum</th>
              </tr>
            </thead>
            <tbody>
              {openRequests.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2">
                    <p className="text-gray-800">{r.requester_name}</p>
                    <p className="text-[11px] text-gray-400">{r.requester_email}</p>
                  </td>
                  <td className="py-2 text-gray-600 max-w-[140px] truncate">{r.material_name || '–'}</td>
                  <td className="py-2 text-right text-gray-600">{r.quantity} {r.unit}</td>
                  <td className="py-2 text-right text-gray-400 text-xs">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('de-DE') : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

    </div>
  );
}
