import { MEDIA_BASE } from '../services/api';

// Shared by Explore (multi-type list) and the Materials/Projects secondary-result
// sections, so a material or project is always described the same way regardless
// of which page found it: same `type`, same `href`, same image resolution.

const API_BASE = MEDIA_BASE;

export function dbImageUrl(images) {
  const first = Array.isArray(images) ? images[0] : null;
  if (!first?.file_path) return null;
  const base = (API_BASE || '').replace(/\/$/, '');
  const p = first.file_path.startsWith('/') ? first.file_path : '/' + first.file_path;
  return `${base}${p}`;
}

export function toMaterialEntity(m, { imageResolver } = {}) {
  return {
    id: `material:${m.id}`,
    type: 'material',
    title: m.name,
    subtitle: m.category || 'Material',
    imageUrl: dbImageUrl(m.images) || imageResolver?.(m) || null,
    href: `/materials/${m.id}`,
    raw: m,
  };
}

export function toProjectEntity(p, { imageResolver } = {}) {
  return {
    id: `project:${p.id}`,
    type: 'project',
    title: p.name,
    subtitle: p.location_name || 'Projekt',
    imageUrl: dbImageUrl(p.images) || imageResolver?.(p) || null,
    href: `/projects/${p.id}`,
    raw: p,
  };
}
