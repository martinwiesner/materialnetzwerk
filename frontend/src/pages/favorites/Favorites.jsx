import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, Package, FolderOpen, Download, FileText } from 'lucide-react';
import { favoriteService } from '../../services/favoriteService';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import BookmarkButton from '../../components/shared/BookmarkButton';
import { exportMaterialsToCSV, exportProjectsToCSV, exportMaterialsToPDF, exportProjectsToPDF } from '../../utils/exportUtils';

export default function Favorites() {
  const { isAuthenticated, token } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: favoriteService.getAll,
    enabled: Boolean(isAuthenticated && token),
  });

  const favs = data?.data || [];
  const materials = favs.filter((f) => f.entity_type === 'material').map((f) => f.entity);
  const projects = favs.filter((f) => f.entity_type === 'project').map((f) => f.entity);

  if (!isAuthenticated || !token) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Bookmark className="w-12 h-12 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Deine Merkliste</h2>
        <p className="text-gray-500 mb-6 max-w-sm">
          Speichere Materialien und Projekte auf deiner Merkliste — du brauchst dafür ein Konto.
        </p>
        <button
          onClick={() => openAuth({ tab: 'login', reason: 'Merkliste benötigt ein Konto.' })}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
        >
          Anmelden / Registrieren
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bookmark className="w-5 h-5 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">Merkliste</h1>
          </div>
          <p className="text-gray-500 text-sm">
            {favs.length === 0
              ? 'Noch nichts gespeichert.'
              : `${favs.length} gespeicherte${favs.length === 1 ? 'r Eintrag' : ' Einträge'}`}
          </p>
        </div>

        {favs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {materials.length > 0 && (
              <>
                <button
                  onClick={() => exportMaterialsToCSV(materials)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
                >
                  <Download className="w-3.5 h-3.5" />
                  Materialien CSV
                </button>
                <button
                  onClick={() => exportMaterialsToPDF(materials)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Materialien PDF
                </button>
              </>
            )}
            {projects.length > 0 && (
              <>
                <button
                  onClick={() => exportProjectsToCSV(projects)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
                >
                  <Download className="w-3.5 h-3.5" />
                  Projekte CSV
                </button>
                <button
                  onClick={() => exportProjectsToPDF(projects)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Projekte PDF
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : favs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <Bookmark className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Noch nichts gespeichert</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
            Klicke auf das Lesezeichen-Symbol bei einem Material oder Projekt, um es hier zu speichern.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/materials"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              <Package className="w-4 h-4" /> Materialien entdecken
            </Link>
            <Link
              to="/projects"
              className="inline-flex items-center gap-2 px-4 py-2 bg-project-600 text-white rounded-xl text-sm font-semibold hover:bg-project-700 transition-colors"
            >
              <FolderOpen className="w-4 h-4" /> Projekte entdecken
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Saved Materials */}
          {materials.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  Materialien
                  <span className="text-xs font-normal text-gray-400 ml-1">{materials.length}</span>
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {materials.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => navigate(`/materials/${m.id}`)}
                    className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary-700 transition-colors">
                          {m.name}
                        </h3>
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full mt-1">
                          {m.category}
                        </span>
                      </div>
                      <BookmarkButton
                        entityType="material"
                        entityId={m.id}
                        size="sm"
                        className="flex-shrink-0"
                      />
                    </div>
                    {m.description && (
                      <p className="text-sm text-gray-500 line-clamp-2 mt-2">{m.description}</p>
                    )}
                    {m.gwp_value != null && (
                      <div className="mt-2 text-xs text-gray-400">
                        GWP: {m.gwp_value} {m.gwp_unit || 'kg CO₂e'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Saved Projects */}
          {projects.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-project-600" />
                  Projekte
                  <span className="text-xs font-normal text-gray-400 ml-1">{projects.length}</span>
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate group-hover:text-project-700 transition-colors">
                          {p.name}
                        </h3>
                        {p.client_name && (
                          <p className="text-xs text-gray-400 mt-0.5">{p.client_name}</p>
                        )}
                      </div>
                      <BookmarkButton
                        entityType="project"
                        entityId={p.id}
                        size="sm"
                        className="flex-shrink-0"
                      />
                    </div>
                    {p.description && (
                      <p className="text-sm text-gray-500 line-clamp-2 mt-2">{p.description}</p>
                    )}
                    <div className="mt-2">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                        p.status === 'active' ? 'bg-project-50 text-project-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {p.status || 'Entwurf'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
