import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/projectService';
import { Plus, Search, Edit2, Trash2, FolderOpen, Eye, Globe, Lock, MapPinned, List, Leaf, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import ProjectForm from '../../components/projects/ProjectForm';
import GeoMap from '../../components/maps/GeoMap';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import RzzDecoration from '../../components/ui/RzzDecoration';
import { useToast } from '../../store/toastStore';
import { OwnerLine } from '../../components/shared/ContactButton';

export default function Projects() {
  const { isAuthenticated, token, user } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);

  const requireAuth = () => {
    if (isAuthenticated && token) return true;
    openAuth({
      tab: 'login',
      reason: 'Bitte logge dich ein, um Projekte anzulegen oder zu bearbeiten.',
      onSuccess: () => setShowForm(true),
    });
    return false;
  };

  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [filterAvailable, setFilterAvailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [activeTab, setActiveTab] = useState('public-projects');

  const { data: allProjectsData, isLoading } = useQuery({
    queryKey: ['projects', { search, status }],
    queryFn: () => projectService.getAll({ search, status }),
  });

  const { data: myProjectsData, isLoading: myLoading } = useQuery({
    queryKey: ['projects', 'mine', { search, status }],
    queryFn: () => projectService.getAll({ search, status, my_projects: true }),
    enabled: isAuthenticated && !!token,
  });

  const toast = useToast();

  const deleteMutation = useMutation({
    mutationFn: projectService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projekt gelöscht.');
    },
    onError: () => toast.error('Löschen fehlgeschlagen.'),
  });

  const handleDelete = (id) => {
    if (!requireAuth()) return;
    if (window.confirm('Projekt wirklich löschen?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (project) => {
    if (!requireAuth()) return;
    setEditingProject(project);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  const allProjects = Array.isArray(allProjectsData) ? allProjectsData : allProjectsData?.data || [];
  const myProjects = Array.isArray(myProjectsData) ? myProjectsData : myProjectsData?.data || [];

  // Public projects = all projects not owned by current user
  const publicProjects = isAuthenticated
    ? allProjects.filter(p => p.owner_id !== user?.id)
    : allProjects;

  const projectsBase = activeTab === 'my-projects' ? myProjects : publicProjects;
  const projects = filterAvailable ? projectsBase.filter(p => p.is_available == 1) : projectsBase;

  const mapPoints = (projects || [])
    .filter((p) => p?.latitude && p?.longitude)
    .map((p) => ({
      id: p.id,
      type: 'project',
      title: p.name || 'Project',
      subtitle:
        (typeof p.total_gwp_value === 'number'
          ? `Total GWP: ${p.total_gwp_value.toFixed(3)} ${p.total_gwp_unit || 'kg CO2e'}`
          : p.description || '') + (p.location_name ? ` • ${p.location_name}` : ''),
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      address: p.address || '',
    }));

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-project-50 text-project-700 border border-project-200',
    completed: 'bg-rzz-cloud-light text-rzz-urban-ash',
    archived: 'bg-gray-100 text-gray-500',
  };

  const statusLabels = {
    draft: 'Entwurf',
    active: 'Veröffentlicht',
    completed: 'Abgeschlossen',
    archived: 'Archiviert',
  };

  const coverImage = (project) => {
    const imgs = project?.images || [];
    // Find explicit cover (sort_order = 0 and is_cover, or first by sort_order)
    const sorted = [...imgs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return sorted[0] || null;
  };

  const getProjectImageUrl = (project, apiBase = '') => {
    const img = coverImage(project);
    if (!img?.file_path) return null;
    const base = apiBase.replace(/\/$/, '');
    const p = img.file_path.startsWith('/') ? img.file_path : '/' + img.file_path;
    return `${base}${p}`;
  };

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-project-600 via-project-500 to-project-400 mb-8">
        <RzzDecoration className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-8 w-56 sm:w-72 md:w-96 lg:w-[30rem] text-white opacity-[0.13]" />
        <div className="relative px-8 py-12 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 text-white text-sm font-medium mb-4">
            <FolderOpen className="w-4 h-4" />
            Nachhaltige Projekte
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white mb-4 leading-tight">
            Baue deine eigenen<br />
            nachhaltigen Projekte.
          </h1>
          <p className="text-lg text-white/80 mb-8 max-w-xl">
            Entdecke umweltfreundliche Projekte von Makern aus der ganzen Welt.
            Erhalte 3D-Modelle, Skizzen und Schritt-für-Schritt-Anleitungen –
            oder teile dein eigenes Projekt mit der Community.
          </p>
          <button
            onClick={() => { if (!requireAuth()) return; setShowForm(true); }}
            className="inline-flex items-center gap-2 bg-white text-project-700 hover:bg-project-50 px-6 py-3 rounded-xl font-semibold text-base transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Jetzt Projekt anlegen
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Projekt-Artikel</h2>
          <p className="text-gray-600">Teile, was du mit Materialien gebaut hast</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'px-3 py-2 text-sm font-medium inline-flex items-center gap-2',
                viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <List className="w-4 h-4" />
              Liste
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={clsx(
                'px-3 py-2 text-sm font-medium inline-flex items-center gap-2',
                viewMode === 'map' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <MapPinned className="w-4 h-4" />
              Karte
            </button>
          </div>

          {activeTab === 'my-projects' && (
            <button
              onClick={() => {
                if (!requireAuth()) return;
                setShowForm(true);
              }}
              className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Neuer Artikel
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        {isAuthenticated && (
          <button
            onClick={() => setActiveTab('my-projects')}
            className={clsx(
              'pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2',
              activeTab === 'my-projects'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <FolderOpen className="w-4 h-4" />
            Meine Artikel ({myProjects.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab('public-projects')}
          className={clsx(
            'pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2',
            activeTab === 'public-projects'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Globe className="w-4 h-4" />
          Öffentliche Artikel ({publicProjects.length})
        </button>
      </div>

      {/* Search / filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Artikel suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          {activeTab === 'my-projects' && (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="">Alle Status</option>
              <option value="draft">Entwurf</option>
              <option value="active">Veröffentlicht</option>
              <option value="completed">Abgeschlossen</option>
              <option value="archived">Archiviert</option>
            </select>
          )}
          <button
            onClick={() => setFilterAvailable(v => !v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              filterAvailable ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-orange-300 text-orange-600 hover:bg-orange-50'
            }`}
          >
            Nur verfügbare
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'map' ? (
        isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : mapPoints.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Projekte mit Standort</h3>
            <p className="text-gray-600">Füge einem Projekt Koordinaten hinzu, um es auf der Karte zu sehen.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
            <div className="h-[520px]">
              <GeoMap points={mapPoints} className="h-full" />
            </div>
          </div>
        )
      ) : (isLoading || (activeTab === 'my-projects' && myLoading)) ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {activeTab === 'my-projects' ? 'Noch keine Artikel' : 'Keine öffentlichen Artikel'}
          </h3>
          <p className="text-gray-600 mb-4">
            {activeTab === 'my-projects'
              ? 'Erstelle deinen ersten Projekt-Artikel'
              : 'Noch niemand hat Artikel veröffentlicht'}
          </p>
          {activeTab === 'my-projects' && (
            <button
              onClick={() => {
                if (!requireAuth()) return;
                setShowForm(true);
              }}
              className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Neuer Artikel
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => {
            const imgUrl = getProjectImageUrl(project, import.meta.env.VITE_API_URL || '');
            const isOwner = isAuthenticated && (project.owner_id === user?.id || user?.is_admin);
            return (
              <div key={project.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row">
                  {/* Cover image */}
                  <div className="relative w-full sm:w-64 h-44 sm:h-auto flex-shrink-0">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={project.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <FolderOpen className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                    {project.is_available == 1 && (
                      <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/90 text-white text-xs font-medium shadow-sm">
                        <Tag className="w-3.5 h-3.5" />
                        verfügbar
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            to={`/projects/${project.id}`}
                            className="font-semibold text-lg text-gray-900 hover:text-primary-600 truncate"
                          >
                            {project.name}
                          </Link>
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[project.status] || statusColors.draft}`}>
                            {statusLabels[project.status] || 'Entwurf'}
                          </span>
                          {project.is_public ? (
                            <Globe className="w-4 h-4 text-project-600" />
                          ) : (
                            <Lock className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        {project.description && (
                          <p className="text-gray-600 text-sm mb-2 line-clamp-2">{project.description}</p>
                        )}
                        {project.owner_id && !isOwner && (
                          <div className="mb-2">
                            <OwnerLine
                              ownerId={project.owner_id}
                              ownerFirstName={project.owner_first_name}
                              ownerLastName={project.owner_last_name}
                              ownerEmail={project.owner_email}
                              contextLabel={project.name}
                            />
                          </div>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(project.created_at).toLocaleDateString('de-DE')}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {typeof project.total_gwp_value === 'number' && project.total_gwp_value > 0 && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                              GWP: {project.total_gwp_value.toFixed(3)} {project.total_gwp_unit || 'kg CO2e'}
                            </span>
                          )}
                          {project.location_name && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                              {project.location_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Link
                          to={`/projects/${project.id}`}
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Anzeigen"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {isOwner && (
                          <>
                            <button
                              onClick={() => handleEdit(project)}
                              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              title="Bearbeiten"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(project.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProjectForm
          project={editingProject}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
