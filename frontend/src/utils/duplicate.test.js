import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/api', () => ({ MEDIA_BASE: 'https://api.example' }));

import { materialCopyPayload, projectCopyPayload, copyMedia } from './duplicate';

describe('materialCopyPayload', () => {
  it('keeps content, drops identity and starts private', () => {
    const out = materialCopyPayload({
      id: 'm1', material_id: 'RZZ-M-1', created_by: 'u1', owner_email: 'a@b.c', images: [{}], files: [],
      name: 'Beton C25/30', category: 'Mineralische Baustoffe', gwp_value: 0.0558, declared_unit: '1 m³',
      tech_density: '2280', visibility: 'public', share_actor_id: 'a1',
    });
    expect(out).toMatchObject({ name: 'Beton C25/30 (Kopie)', category: 'Mineralische Baustoffe', gwp_value: 0.0558, declared_unit: '1 m³', tech_density: '2280', visibility: 'private' });
    for (const k of ['id', 'material_id', 'created_by', 'owner_email', 'images', 'files', 'share_actor_id']) expect(out).not.toHaveProperty(k);
  });
});

describe('projectCopyPayload', () => {
  it('copies materials with quantities and parses JSON columns', () => {
    const out = projectCopyPayload({
      id: 'p1', name: 'Klimapositiver Beton', owner_id: 'u1', material_id: 'RZZ-P-1', status: 'completed', is_public: 1,
      description: 'Rezeptur', steps: '[{"title":"Mischen"}]', oekodat_materials: '[{"uuid":"x","quantity":240}]',
      references: null, derived_material_id: 'm9',
      materials: [{ id: 'pm1', material_id: 'm1', quantity: 75, unit: 'kg', material_name: 'Clim@Add', gwp_value: -2.77 }],
    });
    expect(out).toMatchObject({
      name: 'Klimapositiver Beton (Kopie)', status: 'draft', is_public: false, visibility: 'private', description: 'Rezeptur',
      steps: [{ title: 'Mischen' }], oekodat_materials: [{ uuid: 'x', quantity: 240 }],
      materials: [{ material_id: 'm1', quantity: 75, unit: 'kg' }],
    });
    for (const k of ['id', 'owner_id', 'material_id', 'derived_material_id', 'references']) expect(out).not.toHaveProperty(k);
  });
});

describe('copyMedia', () => {
  it('re-uploads images with their step and counts failures', async () => {
    global.fetch = vi.fn(async (url) => url.endsWith('broken.jpg')
      ? { ok: false, status: 404 }
      : { ok: true, blob: async () => new Blob(['x'], { type: 'image/jpeg' }) });
    const uploadImage = vi.fn(async () => {});
    const uploadFile = vi.fn(async () => {});
    const failed = await copyMedia({
      images: [
        { file_path: '/uploads/a.jpg', original_name: 'a.jpg', sort_order: 0, step_index: 2, step_caption: 'Schalung' },
        { file_path: '/uploads/broken.jpg' },
      ],
      files: [{ file_path: '/uploads/epd.pdf', original_name: 'epd.pdf', file_label: 'EPD' }],
    }, { uploadImage, uploadFile });
    expect(failed).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith('https://api.example/uploads/a.jpg');
    expect(uploadImage).toHaveBeenCalledWith(expect.any(File), { sort_start: 0, step_index: 2, step_caption: 'Schalung' });
    expect(uploadFile).toHaveBeenCalledWith(expect.any(File), 'EPD');
  });
});
