import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/projectService';
import { materialService } from '../../services/materialService';
import { actorService } from '../../services/actorService';
import { X, Globe, Lock, FileText, Plus, Trash2, Save, Upload, Image as ImageIcon, Users, ChevronUp, ChevronDown, BookOpen, Tag, Package } from 'lucide-react';
import ImageUploader from '../shared/ImageUploader';
import FileUploader from '../shared/FileUploader';
import GeolocateButton from '../shared/GeolocateButton';
import { MEDIA_BASE } from '../../services/api';
import { useToast } from '../../store/toastStore';

const API_BASE = MEDIA_BASE;

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function toggleInArray(arr, value) {
  const set = new Set(arr || []);
  set.has(value) ? set.delete(value) : set.add(value);
  return Array.from(set);
}

const PRINCIPLES = {
  sufficiency: ['Suffizienz', 'Kollaborativer Konsum', 'Verhaltensänderndes Design'],
  consistency: ['Nachwachsende Rohstoffe', 'Recycelt', 'Recyclinggerecht', 'Reparierbar', 'Kompostierbar'],
  efficiency: [
    'Schadstofffrei', 'Materialeffizient', 'Energieeffizient', 'Langlebiges Design',
    'Logistikgerechtes Design', 'Naturraumerhaltend', 'Fair produziert', 'Wasserschonend',
  ],
};

const CIRCULAR_PRINCIPLES_DE = [
  'Design für Demontage', 'Modulares Design', 'Abfallreduktion',
  'Gebäude als Materialbanken', 'Materialkreisläufe schließen',
  'Wiederaufarbeitung (Remanufacturing)', 'Produkt-als-Service', 'Wertschöpfung aus Abfall',
];

const GENERAL_SUSTAINABILITY = [
  'Klimaschutz', 'Ressourcenschonung', 'Biodiversitätsschutz',
  'Gesundheitsschonend', 'Soziale Fairness', 'Regionale Wertschöpfung',
];

const emptyForm = {
  name: '',
  description: '',
  content: '',
  location_name: '',
  latitude: '',
  longitude: '',
  address: '',
  status: 'draft',
  is_public: false,
  is_available: false,
  materials: [],
  circular_principles: [],
  principles_sufficiency: [],
  principles_consistency: [],
  principles_efficiency: [],
  general_sustainability_principles: [],
  time_effort: '',
  tools: '',
  steps: [],
  references: [],
};

function StepImageUpload({ stepIndex, onUpload, ensureDraft }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const id = await ensureDraft();
      if (!id) return;
      await onUpload(files, { step_index: stepIndex });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-primary-600 hover:text-primary-700 py-1">
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleChange} />
      {uploading
        ? <span className="text-gray-400 animate-pulse">Hochladen…</span>
        : <><Upload className="w-3.5 h-3.5" /> Bild hochladen</>
      }
    </label>
  );
}

export default function ProjectForm({ project, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState('');
  // draftId: the ID of the auto-created draft (for new projects)
  const [draftId, setDraftId] = useState(null);
  const [localImages, setLocalImages] = useState([]);
  const [localFiles, setLocalFiles] = useState([]);
  const [autoSaving, setAutoSaving] = useState(false);
  // track if we are editing an existing project
  const isEditing = !!project;
  const activeId = project?.id || draftId;

  const [actorIds, setActorIds] = useState(['']);

  // Mode: 'project' = full project, 'offer-only' = lightweight availability entry
  const [mode, setMode] = useState('project');

  // Sync is_available when switching to offer-only
  useEffect(() => {
    if (mode === 'offer-only') {
      setFormData(f => ({ ...f, is_available: true, is_public: true, status: 'active' }));
    }
  }, [mode]);

  const { data: materialsData } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materialService.getAll(),
  });
  const availableMaterials = Array.isArray(materialsData) ? materialsData : (materialsData?.data || []);

  const { data: allActors = [] } = useQuery({
    queryKey: ['actors'],
    queryFn: () => actorService.getAll(),
    select: (d) => (Array.isArray(d) ? d : d?.data || []),
  });

  useEffect(() => {
    if (project?.id) {
      projectService.getActors(project.id).then((actors) => {
        setActorIds(actors.length > 0 ? actors.map((a) => a.id) : ['']);
      }).catch(() => {});
    }
  }, [project?.id]);

  useEffect(() => {
    if (project) {
      setLocalImages(project.images || []);
      setLocalFiles(project.files || []);
      let steps = [];
      try { steps = project.steps ? JSON.parse(project.steps) : []; } catch { steps = []; }
      setFormData({
        name: project.name || '',
        description: project.description || '',
        content: project.content || '',
        location_name: project.location_name || '',
        latitude: project.latitude ?? '',
        longitude: project.longitude ?? '',
        address: project.address || '',
        status: project.status || 'draft',
        is_public: project.is_public || false,
        is_available: project.is_available == 1 || false,
        materials: project.materials?.map(m => ({
          material_id: m.material_id,
          quantity: m.quantity || 1,
          unit: m.unit || '',
        })) || [],
        circular_principles: safeJsonParse(project.circular_principles, []),
        principles_sufficiency: safeJsonParse(project.principles_sufficiency, []),
        principles_consistency: safeJsonParse(project.principles_consistency, []),
        principles_efficiency: safeJsonParse(project.principles_efficiency, []),
        general_sustainability_principles: safeJsonParse(project.general_sustainability_principles, []),
        time_effort: project.time_effort || '',
        tools: project.tools || '',
        steps: Array.isArray(steps) ? steps : [],
        references: safeJsonParse(project.references, []),
      });
    }
  }, [project]);

  // ── Auto-create draft when first image/file upload is triggered ──────────
  const ensureDraft = async () => {
    if (activeId) return activeId;
    setAutoSaving(true);
    try {
      const submitData = buildSubmitData();
      const created = await projectService.create(submitData);
      setDraftId(created.id);
      setLocalImages(created.images || []);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      return created.id;
    } catch (e) {
      setError('Konnte Entwurf nicht speichern: ' + (e.response?.data?.message || e.message));
      return null;
    } finally {
      setAutoSaving(false);
    }
  };

  const buildSubmitData = () => ({
    ...formData,
    latitude: formData.latitude === '' ? null : Number(formData.latitude),
    longitude: formData.longitude === '' ? null : Number(formData.longitude),
    circular_principles: JSON.stringify(formData.circular_principles || []),
    principles_sufficiency: JSON.stringify(formData.principles_sufficiency || []),
    principles_consistency: JSON.stringify(formData.principles_consistency || []),
    principles_efficiency: JSON.stringify(formData.principles_efficiency || []),
    general_sustainability_principles: JSON.stringify(formData.general_sustainability_principles || []),
    steps: formData.steps?.length ? formData.steps : null,
    references: formData.references?.length ? formData.references : null,
  });

  // ── Save / update ─────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: projectService.create,
    onSuccess: (created) => {
      setDraftId(created?.id || null);
      setLocalImages(created?.images || []);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projekt erfolgreich angelegt.');
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Erstellen fehlgeschlagen.';
      setError(msg);
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => projectService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projekt gespeichert.');
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Aktualisieren fehlgeschlagen.';
      setError(msg);
      toast.error(msg);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const submitData = buildSubmitData();
    const validActorIds = actorIds.filter(Boolean);

    if (draftId) {
      projectService.setActors(draftId, validActorIds).catch(() => {});
      updateMutation.mutate({ id: draftId, data: submitData });
    } else if (isEditing) {
      projectService.setActors(project.id, validActorIds).catch(() => {});
      updateMutation.mutate({ id: project.id, data: submitData });
    } else {
      createMutation.mutate(submitData, {
        onSuccess: (created) => {
          if (created?.id && validActorIds.length > 0) {
            projectService.setActors(created.id, validActorIds).catch(() => {});
          }
        },
      });
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    if (value === '') { setFormData({ ...formData, [name]: '' }); return; }
    const num = Number(value);
    setFormData({ ...formData, [name]: Number.isFinite(num) ? num : '' });
  };

  const addMaterial = () =>
    setFormData({ ...formData, materials: [...formData.materials, { material_id: '', quantity: 1, unit: '' }] });

  const removeMaterial = (i) =>
    setFormData({ ...formData, materials: formData.materials.filter((_, j) => j !== i) });

  const updateMaterial = (i, field, value) => {
    const updated = [...formData.materials];
    updated[i] = { ...updated[i], [field]: value };
    setFormData({ ...formData, materials: updated });
  };

  const isPending = createMutation.isPending || updateMutation.isPending || autoSaving;

  // ── Image handlers ────────────────────────────────────────────────────────
  const handleImageUpload = async (files, opts) => {
    const id = await ensureDraft();
    if (!id) return;
    const result = await projectService.uploadImages(id, files, opts);
    setLocalImages(prev => [...prev, ...(Array.isArray(result) ? result : [result])]);
  };

  const handleImageDelete = async (imageId) => {
    const id = activeId;
    if (!id) return;
    await projectService.deleteImage(id, imageId);
    setLocalImages(prev => prev.filter(i => i.id !== imageId));
  };

  const handleSetCover = async (imageId) => {
    const id = activeId;
    if (!id) return;
    const updated = await projectService.updateImage(id, imageId, { is_cover: true });
    setLocalImages(Array.isArray(updated) ? updated : localImages);
  };

  const handleSetStep = async (imageId, stepIndex, stepCaption) => {
    const id = activeId;
    if (!id) return;
    const updated = await projectService.updateImage(id, imageId, { step_index: stepIndex, step_caption: stepCaption });
    setLocalImages(Array.isArray(updated) ? updated : localImages);
  };

  // ── File handlers ─────────────────────────────────────────────────────────
  const handleFileUpload = async (files) => {
    const id = await ensureDraft();
    if (!id) return;
    const result = await projectService.uploadFiles(id, files);
    setLocalFiles(prev => [...prev, ...(Array.isArray(result) ? result : [result])]);
  };

  const handleFileDelete = async (fileId) => {
    const id = activeId;
    if (!id) return;
    await projectService.deleteFile(id, fileId);
    setLocalFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleSetCredit = async (imageId, credit) => {
    if (!activeId) return;
    await projectService.updateImage(activeId, imageId, { credit });
    setLocalImages(prev => prev.map(img => img.id === imageId ? { ...img, credit } : img));
  };

  const moveStep = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= formData.steps.length) return;
    const oldStep = idx + 1;   // 1-based step_index
    const newStep = newIdx + 1;
    setFormData(f => {
      const steps = [...f.steps];
      [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
      return { ...f, steps };
    });
    setLocalImages(imgs => imgs.map(img => {
      if (img.step_index === oldStep) return { ...img, step_index: newStep };
      if (img.step_index === newStep) return { ...img, step_index: oldStep };
      return img;
    }));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const draftCreated = !!draftId && !isEditing;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing
                ? 'Artikel bearbeiten'
                : draftCreated
                  ? 'Artikel (Entwurf)'
                  : mode === 'offer-only'
                    ? 'Neues Angebot'
                    : 'Neuer Artikel'}
            </h2>
            {autoSaving && <span className="text-xs text-gray-400 animate-pulse">Entwurf wird gespeichert…</span>}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          {/* Mode toggle — only when creating (not editing) */}
          {!isEditing && (
            <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
              <button type="button" onClick={() => setMode('project')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  mode === 'project' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Package className="w-3.5 h-3.5" />
                Projekt anlegen
              </button>
              <button type="button" onClick={() => setMode('offer-only')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  mode === 'offer-only' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Tag className="w-3.5 h-3.5" />
                Nur Angebot
              </button>
            </div>
          )}

          {draftCreated && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-lg text-sm">
              <Save className="w-4 h-4 inline mr-1" />
              Entwurf gespeichert – Bilder und Dateien wurden hinzugefügt. Klicke <strong>Aktualisieren</strong> um den Artikel zu veröffentlichen.
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange}
              placeholder="Titel des Projekts" required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kurzbeschreibung</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={2}
              placeholder="Kurze Zusammenfassung für die Listenansicht"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
          </div>

          {/* Content */}
          {mode === 'project' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Inhalt</label>
            <textarea name="content" value={formData.content} onChange={handleChange} rows={8}
              placeholder="Beschreibe dein Projekt – verwendete Materialien, Prozess, Ergebnis…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none font-mono text-sm" />
          </div>
          )}

          {/* Images — available immediately */}
          <div className="border-t pt-4">
            <ImageUploader
              images={localImages}
              onUpload={handleImageUpload}
              onDelete={handleImageDelete}
              onSetCover={handleSetCover}
              onSetStep={mode === 'project' ? handleSetStep : undefined}
              onSetCredit={handleSetCredit}
              stepCount={mode === 'project' ? formData.steps.length : 0}
              apiBase={API_BASE}
              label={mode === 'offer-only' ? 'Bilder (optional)' : 'Bilder (Cover + Anleitungsbilder)'}
            />
          </div>

          {/* Files */}
          {mode === 'project' && (
          <FileUploader
            files={localFiles}
            onUpload={handleFileUpload}
            onDelete={handleFileDelete}
            apiBase={API_BASE}
            label="Fertigungsdaten (DXF, STEP, STL, PDF, …)"
          />
          )}

          {/* Sustainability principles */}
          {mode === 'project' && (<div className="border-t pt-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Nachhaltigkeit &amp; Kreislaufprinzipien</div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
              {[
                { key: 'circular_principles', label: 'Kreislaufprinzipien', options: CIRCULAR_PRINCIPLES_DE },
                { key: 'principles_sufficiency', label: 'Suffizienz', options: PRINCIPLES.sufficiency },
                { key: 'principles_consistency', label: 'Konsistenz', options: PRINCIPLES.consistency },
                { key: 'principles_efficiency', label: 'Effizienz', options: PRINCIPLES.efficiency },
                { key: 'general_sustainability_principles', label: 'Allgemeine Nachhaltigkeitsprinzipien', options: GENERAL_SUSTAINABILITY },
              ].map(({ key, label, options }) => (
                <div key={key}>
                  <div className="text-xs font-semibold text-gray-700 mb-2">{label}</div>
                  <div className="flex flex-wrap gap-3">
                    {options.map((p) => (
                      <label key={p} className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox"
                          checked={(formData[key] || []).includes(p)}
                          onChange={() => setFormData(prev => ({ ...prev, [key]: toggleInArray(prev[key], p) }))}
                          className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500" />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>)}

          {/* Location */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Standort (optional)</label>
              <GeolocateButton
                onLocate={(lat, lon) => setFormData(f => ({ ...f, latitude: lat, longitude: lon }))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <input type="text" name="location_name" value={formData.location_name} onChange={handleChange}
                  placeholder="Ortsname (z.B. Zeitz Lager)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <input type="number" step="0.000001" name="latitude" value={formData.latitude}
                onChange={handleNumberChange} placeholder="Breitengrad"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              <input type="number" step="0.000001" name="longitude" value={formData.longitude}
                onChange={handleNumberChange} placeholder="Längengrad"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              <div className="md:col-span-2">
                <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Adresse"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
            </div>
          </div>

          {/* Materials */}
          {mode === 'project' && (<div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Materialien &amp; Mengen</label>
              <button type="button" onClick={addMaterial}
                className="flex items-center gap-1 px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded-lg">
                <Plus className="w-4 h-4" /> Material hinzufügen
              </button>
            </div>
            {formData.materials.length === 0 ? (
              <p className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg">
                Noch keine Materialien. Klicke „Material hinzufügen".
              </p>
            ) : (
              <div className="space-y-2">
                {formData.materials.map((mat, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <select value={mat.material_id} onChange={(e) => updateMaterial(i, 'material_id', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required>
                      <option value="">Material wählen</option>
                      {availableMaterials.map((m) => (
                        <option key={m.id} value={m.id}>{m.name} ({m.category})</option>
                      ))}
                    </select>
                    <input type="number" step="0.01" min="0" value={mat.quantity}
                      onChange={(e) => updateMaterial(i, 'quantity', parseFloat(e.target.value) || 0)}
                      placeholder="Menge" required
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                    <input type="text" value={mat.unit} onChange={(e) => updateMaterial(i, 'unit', e.target.value)}
                      placeholder="Einheit"
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                    <button type="button" onClick={() => removeMaterial(i)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>)}

          {/* Status + Visibility */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="status" value={formData.status} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="draft">Entwurf</option>
                <option value="active">Veröffentlicht</option>
                <option value="completed">Abgeschlossen</option>
                <option value="archived">Archiviert</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_public" checked={formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                  className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500" />
                <span className="flex items-center gap-1 text-sm text-gray-700">
                  {formData.is_public
                    ? <><Globe className="w-4 h-4 text-project-600" /> Öffentlich</>
                    : <><Lock className="w-4 h-4 text-gray-500" /> Privat</>
                  }
                </span>
              </label>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_available" checked={formData.is_available}
                  onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                  className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-400" />
                <span className="text-sm text-gray-700">Als <span className="text-orange-600 font-medium">verfügbar</span> markieren</span>
              </label>
            </div>
          </div>

          {/* Execution */}
          {mode === 'project' && (<div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold text-gray-800">🛠️ Ausführung</p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Zeitaufwand</label>
              <input type="text" value={formData.time_effort}
                onChange={e => setFormData({ ...formData, time_effort: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="z.B. 2–4 Stunden" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Werkzeuge</label>
              <textarea value={formData.tools}
                onChange={e => setFormData({ ...formData, tools: e.target.value })} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                placeholder="z.B. Säge, Bohrmaschine" />
            </div>
          </div>)}

          {/* Steps */}
          {mode === 'project' && (<div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">📋 Schritt-für-Schritt-Anleitung</p>
              <button type="button"
                onClick={() => setFormData(f => ({ ...f, steps: [...f.steps, { title: '', text: '' }] }))}
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Schritt hinzufügen
              </button>
            </div>
            {formData.steps.map((step, i) => {
              // step_index is 1-based: Schritt 1 → step_index = 1
              const stepIndex = i + 1;
              const stepImgs = localImages.filter(img => img.step_index === stepIndex);
              return (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">Schritt {stepIndex}</span>
                    <div className="flex items-center gap-0.5 ml-1">
                      <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0}
                        className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed" title="Nach oben">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => moveStep(i, 1)} disabled={i === formData.steps.length - 1}
                        className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed" title="Nach unten">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button type="button"
                      onClick={() => {
                        // also remove images assigned to this step
                        stepImgs.forEach(img => handleImageDelete(img.id));
                        setFormData(f => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }));
                      }}
                      className="ml-auto text-red-400 hover:text-red-600" title="Schritt löschen">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input type="text" placeholder="Titel" value={step.title || ''}
                    onChange={e => setFormData(f => ({ ...f, steps: f.steps.map((s, j) => j === i ? { ...s, title: e.target.value } : s) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  <textarea placeholder="Beschreibung" value={step.text || ''} rows={2}
                    onChange={e => setFormData(f => ({ ...f, steps: f.steps.map((s, j) => j === i ? { ...s, text: e.target.value } : s) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none" />

                  {/* Inline images for this step */}
                  <div className="border-t border-gray-100 pt-2 space-y-1.5">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Bilder für Schritt {stepIndex}</p>
                    {stepImgs.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {stepImgs.map(img => {
                          const url = `${API_BASE}${img.file_path?.replace(/^\./, '')}`;
                          return (
                            <div key={img.id} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                              <img src={url} alt={img.original_name} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => handleImageDelete(img.id)}
                                className="absolute inset-0 bg-red-500/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                title="Bild löschen"
                              >
                                <Trash2 className="w-4 h-4 text-white" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <StepImageUpload
                      stepIndex={stepIndex}
                      onUpload={handleImageUpload}
                      disabled={!activeId && !draftId}
                      ensureDraft={ensureDraft}
                    />
                  </div>
                </div>
              );
            })}
          </div>)}

          {/* References */}
          {mode === 'project' && (<div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-gray-500" />
                Quellen &amp; Referenzen
              </p>
              <button type="button"
                onClick={() => setFormData(f => ({ ...f, references: [...(f.references || []), ''] }))}
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Quelle hinzufügen
              </button>
            </div>
            {(!formData.references || formData.references.length === 0) ? (
              <p className="text-xs text-gray-400 italic">Noch keine Quellen. Wissenschaftliche Literatur, URLs oder sonstige Referenzen.</p>
            ) : (
              <div className="space-y-2">
                {formData.references.map((ref, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ref}
                      onChange={e => setFormData(f => ({ ...f, references: f.references.map((r, j) => j === i ? e.target.value : r) }))}
                      placeholder={`Quelle ${i + 1} (z.B. Autor, Titel, Jahr, URL)`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                    <button type="button"
                      onClick={() => setFormData(f => ({ ...f, references: f.references.filter((_, j) => j !== i) }))}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>)}

          {/* Beteiligte Akteure */}
          {mode === 'project' && (<div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-gray-500" />
              Beteiligte Akteure
            </p>
            {actorIds.map((actorId, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={actorId}
                  onChange={(e) => {
                    const next = [...actorIds];
                    next[idx] = e.target.value;
                    setActorIds(next);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                >
                  <option value="">— Akteur wählen —</option>
                  {allActors.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.type ? ` (${a.type})` : ''}</option>
                  ))}
                </select>
                {actorIds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setActorIds(actorIds.filter((_, i) => i !== idx))}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setActorIds([...actorIds, ''])}
              className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              Weiteren Akteur hinzufügen
            </button>
          </div>)}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              {draftCreated ? 'Schließen' : 'Abbrechen'}
            </button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50">
              {isPending ? 'Speichern…' : draftCreated || isEditing ? 'Aktualisieren' : mode === 'offer-only' ? 'Angebot erstellen' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
