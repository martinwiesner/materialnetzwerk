import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/projectService';
import { 
  ArrowLeft, Edit2, Trash2, Globe, Lock, Package, 
  Calendar, User, Leaf
} from 'lucide-react';
import ProjectForm from '../../components/projects/ProjectForm';
import { MEDIA_BASE } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
const API_BASE = MEDIA_BASE;

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function TagGroup({ title, items }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-gray-700 mb-2">{title}</div>
      <div className="flex flex-wrap gap-2">
        {list.map((t) => (
          <span key={t} className="px-2.5 py-1 rounded-full text-xs border border-gray-200 bg-gray-50 text-gray-800">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();
  const [showForm, setShowForm] = useState(false);

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectService.getById(id),
  });

  const deleteMutation = useMutation({
    mutationFn: projectService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    },
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this article?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Projekt nicht gefunden.</p>
        <Link to="/projects" className="text-primary-600 hover:underline mt-2 inline-block">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-project-50 text-project-700',
    completed: 'bg-rzz-cloud-light text-rzz-urban-ash',
    archived: 'bg-gray-100 text-gray-500',
  };

  const statusLabels = {
    draft: 'Entwurf',
    active: 'Veröffentlicht',
    completed: 'Abgeschlossen',
    archived: 'Archiviert',
  };

  const circular = safeJsonParse(project.circular_principles, []);
  const suff = safeJsonParse(project.principles_sufficiency, []);
  const cons = safeJsonParse(project.principles_consistency, []);
  const eff = safeJsonParse(project.principles_efficiency, []);
  const gen = safeJsonParse(project.general_sustainability_principles, []);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück zur Übersicht
        </Link>
        {isAuthenticated && (project.owner_id === user?.id || user?.is_admin) && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Bearbeiten
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-2 px-3 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Löschen
            </button>
          </div>
        )}
      </div>

      {/* Article */}
      <article className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Title Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[project.status] || statusColors.draft}`}>
              {statusLabels[project.status] || 'Draft'}
            </span>
            {project.is_public ? (
              <span className="inline-flex items-center gap-1 text-xs text-project-600">
                <Globe className="w-3 h-3" /> Public
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Lock className="w-3 h-3" /> Private
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
          {project.description && (
            <p className="text-lg text-gray-600">{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
            {project.owner_first_name && (
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {project.owner_first_name} {project.owner_last_name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(project.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Images */}
        {project.images && project.images.length > 0 && (
          <div className="p-6 border-b border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {project.images.map((image) => (
                <img
                  key={image.id}
                  src={`${API_BASE}${image.file_path?.replace(/^\./, '')}`}
                  alt={image.original_name}
                  className="w-full h-40 object-cover rounded-lg"
                />
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 border-b border-gray-200">
          {project.content ? (
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap text-gray-700">{project.content}</p>
            </div>
          ) : (
            <p className="text-gray-400 italic">No content yet. Edit this article to add content.</p>
          )}
        </div>

        {/* Sustainability principles */}
        {(circular.length || suff.length || cons.length || eff.length || gen.length) ? (
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Nachhaltigkeit &amp; Kreislaufprinzipien</h2>
            <div className="space-y-4">
              <TagGroup title="Kreislaufprinzipien" items={circular} />
              <TagGroup title="Suffizienz" items={suff} />
              <TagGroup title="Konsistenz" items={cons} />
              <TagGroup title="Effizienz" items={eff} />
              <TagGroup title="Allgemeine Nachhaltigkeitsprinzipien" items={gen} />
            </div>
          </div>
        ) : null}

        {/* Materials Section */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-500" />
              Materialien &amp; Zutaten
            </h2>
            {typeof project.total_gwp_value === 'number' && project.total_gwp_value > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-1 text-xs font-semibold text-green-800">
                <Leaf className="w-3.5 h-3.5 text-green-600" />
                GWP: {project.total_gwp_value.toFixed(3)} {project.total_gwp_unit || 'kg CO₂e'}
              </span>
            )}
          </div>

          {/* Materials List */}
          {project.materials && project.materials.length > 0 ? (
            <div className="space-y-2">
              {project.materials.map((material) => (
                <div
                  key={material.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <span className="font-medium text-gray-900">{material.material_name}</span>
                    <span className="text-gray-500 ml-2">
                      {material.quantity} {material.unit || 'Stk.'}
                    </span>
                    {material.category && (
                      <span className="ml-2 text-xs text-gray-400">({material.category})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">
              Noch keine Materialien eingetragen. Bearbeite diesen Artikel, um Materialien hinzuzufügen.
            </p>
          )}
        </div>

        {/* Time effort + Tools */}
        {(project.time_effort || project.tools) && (
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Ausführung</h2>
            {project.time_effort && (
              <div className="mb-3">
                <span className="text-sm font-semibold text-gray-600">Zeitaufwand: </span>
                <span className="text-sm text-gray-800">{project.time_effort}</span>
              </div>
            )}
            {project.tools && (
              <div>
                <span className="text-sm font-semibold text-gray-600">Werkzeuge: </span>
                <span className="text-sm text-gray-800">{project.tools}</span>
              </div>
            )}
          </div>
        )}

        {/* Step-by-step instructions */}
        {(() => {
          let steps = safeJsonParse(project.steps, []);
          if (!Array.isArray(steps)) steps = safeJsonParse(steps, []);
          if (!Array.isArray(steps)) steps = [];
          if (!steps.length) return null;
          // API_BASE is imported at the top of the file
          const stepImages = (project.images || []).filter(img => img.step_index != null);
          return (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Schritt-für-Schritt-Anleitung</h2>
              <ol className="space-y-6">
                {steps.map((step, i) => {
                  // step_index is 1-based (Schritt 1 = index 1)
                  const stepImgs = stepImages.filter(im => im.step_index === i + 1);
                  return (
                    <li key={i} className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-sm">{i+1}</div>
                      <div className="flex-1 space-y-2">
                        {step.title && <h3 className="font-semibold text-gray-900">{step.title}</h3>}
                        {step.text && <p className="text-sm text-gray-700 whitespace-pre-wrap">{step.text}</p>}
                        {stepImgs.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {stepImgs.map(img => (
                              <img key={img.id} src={`${API_BASE}${img.file_path?.replace(/^\./,'')}`}
                                alt={step.title||`Schritt ${i+1}`}
                                className="rounded-lg max-h-60 object-cover border border-gray-200" />
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })()}

        {/* Manufacturing files */}
        {project.files?.length > 0 && (
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Fertigungsdaten</h2>
            <ul className="space-y-2">
              {project.files.map(f => {
                // API_BASE is imported at the top of the file
                return (
                  <li key={f.id}>
                    <a href={`${API_BASE}${f.file_path?.replace(/^\./,'')}`} download={f.original_name} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 py-1">
                      ⬇ {f.original_name || f.filename}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </article>

      {showForm && (
        <ProjectForm
          project={project}
          onClose={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['project', id] });
          }}
        />
      )}
    </div>
  );
}
