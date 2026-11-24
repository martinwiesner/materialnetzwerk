import { MEDIA_BASE } from '../services/api';

// Duplicating = creating a new entry from an existing one's fields. Copies are
// owned by whoever duplicates them and start private, so a variant (e.g. a
// concrete recipe with a different strength class) can be edited before it is
// shared. Identity, ownership and passport fields are always regenerated.

export const copyName = (name) => `${name || 'Ohne Titel'} (Kopie)`;

const MATERIAL_OMIT = [
  'id', 'material_id', 'passport_type', 'passport_data', 'created_by', 'created_at', 'updated_at',
  'owner_id', 'owner_first_name', 'owner_last_name', 'owner_email',
  'images', 'files', 'derived_from_project', 'can_edit', 'share_actor_id', 'actors',
];

export function materialCopyPayload(m) {
  const out = { ...m };
  MATERIAL_OMIT.forEach(k => delete out[k]);
  return { ...out, name: copyName(m.name), visibility: 'private', actor_members_can_edit: false };
}

const PROJECT_FIELDS = [
  'description', 'content',
  'circular_principles', 'principles_sufficiency', 'principles_consistency', 'principles_efficiency', 'general_sustainability_principles',
  'location_name', 'latitude', 'longitude', 'address',
  'time_effort', 'tools', 'license', 'hardware_license', 'software_license', 'documentation_license',
  'cad_share_url', 'cad_preview_url',
];
// Stored as JSON text; the backend stringifies them again on write
const PROJECT_JSON_FIELDS = ['steps', 'references', 'contributors', 'oekodat_materials', 'idemat_lca_items'];

const parseJson = (v) => {
  if (typeof v !== 'string') return v ?? undefined;
  try { return JSON.parse(v); } catch { return undefined; }
};

export function projectCopyPayload(p) {
  const out = { name: copyName(p.name), status: 'draft', is_public: false, is_available: false, visibility: 'private' };
  PROJECT_FIELDS.forEach(k => { if (p[k] != null) out[k] = p[k]; });
  PROJECT_JSON_FIELDS.forEach(k => { const v = parseJson(p[k]); if (v != null) out[k] = v; });
  out.materials = (p.materials || [])
    .filter(r => r.material_id)
    .map(r => ({ material_id: r.material_id, quantity: r.quantity, unit: r.unit ?? null }));
  return out;
}

function mediaUrl(filePath) {
  if (/^https?:\/\//.test(filePath)) return filePath;
  const base = (MEDIA_BASE || '').replace(/\/$/, '');
  return `${base}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
}

async function downloadAsFile(item) {
  const res = await fetch(mediaUrl(item.file_path));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return new File([blob], item.original_name || item.filename || 'datei', { type: item.mime_type || blob.type });
}

/**
 * Re-uploads images and files of the source to the copy, one by one so step
 * assignment and labels survive. Returns how many items could not be copied.
 */
export async function copyMedia({ images = [], files = [] }, { uploadImage, uploadFile }) {
  let failed = 0;
  for (const [i, img] of images.entries()) {
    try {
      const opts = { sort_start: img.sort_order ?? i };
      if (img.step_index != null) opts.step_index = img.step_index;
      if (img.step_caption) opts.step_caption = img.step_caption;
      await uploadImage(await downloadAsFile(img), opts);
    } catch { failed++; }
  }
  if (uploadFile) {
    for (const f of files) {
      try { await uploadFile(await downloadAsFile(f), f.file_label || null); } catch { failed++; }
    }
  }
  return failed;
}
