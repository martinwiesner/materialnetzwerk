import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/projectService';
import { materialService } from '../../services/materialService';
import { toMaterialEntity } from '../../utils/entityMapping';
import { Plus, Search, Edit2, Trash2, FolderOpen, Globe, Lock, MapPinned, MapPin, List, Leaf, Tag, Download, FileText, Scale, Package2, Share2 } from 'lucide-react';
import BookmarkButton from '../../components/shared/BookmarkButton';
import { exportProjectsToCSV, exportProjectsToPDF } from '../../utils/exportUtils';
import clsx from 'clsx';
import ProjectForm from '../../components/projects/ProjectForm';
import GeoMap from '../../components/maps/GeoMap';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import RzzDecoration from '../../components/ui/RzzDecoration';
import { useToast } from '../../store/toastStore';
import { useCompareStore } from '../../store/compareStore';
import { OwnerLine } from '../../components/shared/ContactButton';
import { formatDate } from '../../utils/dates';
import { useT } from '../../i18n/useT';

// Lower score = higher in list (same weighting as Explore: recency 50%, completeness 30%, proximity 20%)
function projectScore(p) {
  // Completeness
  let filled = 0, total = 0;
  const chk = (v) => { total++; if (v) filled++; };
  chk(p.images?.length > 0);
  chk(p.description || p.content);
  chk(p.latitude && p.longitude);
  chk(p.tools);
  chk(p.time_effort);
  try { const s = Array.isArray(p.steps) ? p.steps : JSON.parse(p.steps || '[]'); chk(s.some(x => x?.text || x?.title)); } catch { chk(false); }
  const incomplete = total > 0 ? 1 - filled / total : 0.5;

  const rawDate = p.created_at || p.createdAt;
  const ageDays = rawDate ? Math.max(0, (Date.now() - new Date(rawDate).getTime()) / 86400000) : 0;
  const ageScore = Math.min(ageDays / 180, 1);

  return ageScore * 0.60 + incomplete * 0.40;
}

export default function Projects() {
  const t = useT();
  const navigate = useNavigate();
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

  // Secondary results: only fetched while actively searching, so a search term
  // that matches a material (but no project) doesn't dead-end the user.
  const { data: matchingMaterialsData } = useQuery({
    queryKey: ['materials', 'secondary-for-projects-search', search],
    queryFn: () => materialService.getAll({ search }),
    enabled: !!search,
  });

  const toast = useToast();
  const compare = useCompareStore();

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

  const handleEdit = async (project) => {
    if (!requireAuth()) return;
    try {
      const full = await projectService.getById(project.id);
      setEditingProject(full);
    } catch {
      setEditingProject(project);
    }
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  const allProjects = Array.isArray(allProjectsData) ? allProjectsData : allProjectsData?.data || [];
  const myProjects = Array.isArray(myProjectsData) ? myProjectsData : myProjectsData?.data || [];

  // Public tab = all projects with is_public=1 (incl. own public ones)
  const publicProjects = allProjects.filter(p => p.is_public == 1);

  // Shared tab = projects returned for the viewer that are neither owned nor public,
  // i.e. visible only via a direct user_shares entry or actor membership.
  const sharedProjects = allProjects.filter(p => p.owner_id !== user?.id && p.is_public != 1);

  const projectsBase = activeTab === 'my-projects' ? myProjects
    : activeTab === 'shared-projects' ? sharedProjects
    : publicProjects;
  const projectsFiltered = filterAvailable ? projectsBase.filter(p => p.is_available == 1) : projectsBase;
  const projects = [...projectsFiltered].sort((a, b) => projectScore(a) - projectScore(b));

  // materialService.getAll returns { data: [...] }, unlike /api/projects' bare array.
  const matchingMaterials = (matchingMaterialsData?.data || [])
    .map((m) => toMaterialEntity(m));
  const showMatchingMaterials = !!search && matchingMaterials.length > 0;

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
            {t('projects.subtitle')}
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white mb-4 leading-tight">
            {t('projects.heroHeading')}
          </h1>
          <p className="text-lg text-white/80 mb-8 max-w-xl">
            {t('projects.heroBody')}
          </p>
          <button
            onClick={() => { if (!requireAuth()) return; setShowForm(true); }}
            className="inline-flex items-center gap-2 bg-white text-project-700 hover:bg-project-50 px-6 py-3 rounded-xl font-semibold text-base transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            {t('projects.ctaAdd')}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('projects.title')}</h2>
          <p className="text-gray-600">{t('projects.subtitle2')}</p>
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
              {t('common.list')}
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={clsx(
                'px-3 py-2 text-sm font-medium inline-flex items-center gap-2',
                viewMode === 'map' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <MapPinned className="w-4 h-4" />
              {t('common.map')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportProjectsToCSV(projects)}
              disabled={!projects?.length}
              title={t('materials.csvExport')}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => exportProjectsToPDF(projects)}
              disabled={!projects?.length}
              title={t('materials.pdfExport')}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
            >
              <FileText className="w-4 h-4" />
            </button>
            {activeTab === 'my-projects' && (
              <button
                onClick={() => {
                  if (!requireAuth()) return;
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
                {t('projects.ctaAdd')}
              </button>
            )}
          </div>
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
            {t('projects.filterMy')} ({myProjects.length})
          </button>
        )}
        {isAuthenticated && (
          <button
            onClick={() => setActiveTab('shared-projects')}
            className={clsx(
              'pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2',
              activeTab === 'shared-projects'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Share2 className="w-4 h-4" />
            {t('projects.filterShared')} ({sharedProjects.length})
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
          {t('projects.filterAll')} ({publicProjects.length})
        </button>
      </div>

      {/* Search / filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('projects.searchPlaceholder')}
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
              <option value="">{t('projects.filterStatus')}</option>
              <option value="draft">{t('projects.statusDraft')}</option>
              <option value="active">{t('projects.statusPublished')}</option>
              <option value="completed">{t('projects.statusDone')}</option>
              <option value="archived">{t('projects.statusArchived')}</option>
            </select>
          )}
          <button
            onClick={() => setFilterAvailable(v => !v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              filterAvailable ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-orange-300 text-orange-600 hover:bg-orange-50'
            }`}
          >
            {t('projects.filterAvailable')}
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('projects.noLocation')}</h3>
            <p className="text-gray-600">{t('projects.noLocationHint')}</p>
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
      ) : (projects.length === 0 && !showMatchingMaterials) ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {activeTab === 'my-projects' ? 'Noch keine Artikel'
              : activeTab === 'shared-projects' ? 'Noch nichts mit dir geteilt'
              : 'Keine öffentlichen Artikel'}
          </h3>
          <p className="text-gray-600 mb-4">
            {activeTab === 'my-projects' ? 'Erstelle deinen ersten Projekt-Artikel'
              : activeTab === 'shared-projects' ? 'Projekte, die andere mit dir teilen, erscheinen hier.'
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
        <div className="@container">
        {/* Search matched a material, not a project — point the user there instead of a dead end */}
        {projects.length === 0 && showMatchingMaterials && (
          <p className="text-gray-600 mb-4">Keine passenden Projekte gefunden.</p>
        )}

        {projects.length > 0 && (
        <div className="grid grid-cols-1 @[34rem]:grid-cols-2 @[54rem]:grid-cols-3 gap-4">
          {projects.map((project) => {
            const imgUrl = getProjectImageUrl(project, import.meta.env.VITE_API_URL || '');
            const isOwner = isAuthenticated && (project.owner_id === user?.id || user?.is_admin);
            return (
              <div
                key={project.id}
                className="relative bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <Link to={`/projects/${project.id}`} className="absolute inset-0" aria-label={`${project.name} ansehen`} />

                {/* Image */}
                <div className="relative">
                  {imgUrl ? (
                    <img src={imgUrl} alt={project.name} className="w-full h-44 object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-44 bg-gray-100 flex items-center justify-center">
                      <FolderOpen className="w-10 h-10 text-gray-300" />
                    </div>
                  )}

                  {/* Overlay badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-gray-200 text-sm text-gray-700 shadow-sm">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{project.location_name || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {project.is_available == 1 && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/90 text-white text-xs font-medium shadow-sm">
                          <Tag className="w-3.5 h-3.5" />
                          verfügbar
                        </div>
                      )}
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm ${statusColors[project.status] || statusColors.draft}`}>
                        {statusLabels[project.status] || 'Entwurf'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{project.name}</h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-project-50 text-project-700 text-xs rounded-full mt-1">
                        {project.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {project.is_public ? 'Öffentlich' : 'Privat'}
                      </span>
                    </div>
                    <div className="relative flex gap-1 flex-shrink-0">
                      <button
                        type="button"
                        title={compare.isSelected(project.id) ? 'Aus Vergleich entfernen' : 'Zum Vergleich hinzufügen'}
                        onClick={(e) => { e.stopPropagation(); compare.toggle('projects', project.id); }}
                        disabled={!compare.isSelected(project.id) && !compare.canAdd('projects')}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${
                          compare.isSelected(project.id)
                            ? 'text-project-600 bg-project-50 hover:bg-project-100'
                            : 'text-gray-400 hover:text-project-500 hover:bg-project-50'
                        }`}
                      >
                        <Scale className="w-4 h-4" />
                      </button>
                      <BookmarkButton entityType="project" entityId={project.id} size="sm" showCount />
                      {isOwner && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(project); }}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Bearbeiten"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {project.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{project.description}</p>
                  )}

                  {project.owner_id && !isOwner && (
                    <div className="relative mb-2">
                      <OwnerLine
                        ownerId={project.owner_id}
                        ownerFirstName={project.owner_first_name}
                        ownerLastName={project.owner_last_name}
                        ownerEmail={project.owner_email}
                        contextLabel={project.name}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-1">
                    {typeof project.total_gwp_value === 'number' && project.total_gwp_value > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-medium text-green-800">
                        <Leaf className="w-3 h-3 text-green-600" />
                        GWP {project.total_gwp_value.toFixed(3)} {project.total_gwp_unit || 'kg CO₂e'}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 self-center">{formatDate(project.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Secondary results: materials matching the current search term */}
        {showMatchingMaterials && (
          <div className={projects.length > 0 ? 'mt-8' : ''}>
            <h3 className="text-base font-semibold text-primary-800 mb-3 flex items-center gap-2">
              <Package2 className="w-4 h-4" />
              {projects.length > 0 ? 'Auch passende Materialien' : 'Passende Materialien'} ({matchingMaterials.length})
            </h3>
            <div className="grid grid-cols-1 @[34rem]:grid-cols-2 @[54rem]:grid-cols-3 gap-4">
              {matchingMaterials.map((m) => (
                <Link
                  key={m.id}
                  to={m.href}
                  className="block bg-white rounded-2xl shadow-sm border border-primary-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="relative">
                    {m.imageUrl ? (
                      <img src={m.imageUrl} alt={m.title} className="w-full h-32 object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-32 bg-primary-50 flex items-center justify-center">
                        <Package2 className="w-8 h-8 text-primary-300" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 border border-primary-200 text-primary-700 text-xs font-medium shadow-sm">
                        <Package2 className="w-3 h-3" />
                        Material
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">{m.title}</h4>
                    {m.subtitle && <p className="text-xs text-gray-500 truncate mt-0.5">{m.subtitle}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
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
