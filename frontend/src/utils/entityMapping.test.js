import { describe, it, expect } from 'vitest';
import { dbImageUrl, toMaterialEntity, toProjectEntity } from './entityMapping';

describe('dbImageUrl', () => {
  it('returns null when there are no images', () => {
    expect(dbImageUrl(undefined)).toBeNull();
    expect(dbImageUrl([])).toBeNull();
  });

  it('returns null when the first image has no file_path', () => {
    expect(dbImageUrl([{}])).toBeNull();
  });

  it('builds a URL from the first image, adding a leading slash if missing', () => {
    expect(dbImageUrl([{ file_path: 'uploads/materials/x.jpg' }])).toBe('/uploads/materials/x.jpg');
    expect(dbImageUrl([{ file_path: '/uploads/materials/x.jpg' }])).toBe('/uploads/materials/x.jpg');
  });

  it('only ever uses the first image', () => {
    expect(dbImageUrl([{ file_path: '/a.jpg' }, { file_path: '/b.jpg' }])).toBe('/a.jpg');
  });
});

describe('toMaterialEntity', () => {
  const material = { id: 'mat-1', name: 'Recyceltes Holz', category: 'Holz', images: [] };

  it('produces a correctly typed, routable entity', () => {
    const entity = toMaterialEntity(material);
    expect(entity.type).toBe('material');
    expect(entity.id).toBe('material:mat-1');
    expect(entity.href).toBe('/materials/mat-1');
    expect(entity.title).toBe('Recyceltes Holz');
    expect(entity.subtitle).toBe('Holz');
    expect(entity.raw).toBe(material);
  });

  it('falls back to "Material" as subtitle when category is missing', () => {
    const entity = toMaterialEntity({ id: 'mat-2', name: 'Ohne Kategorie', images: [] });
    expect(entity.subtitle).toBe('Material');
  });

  it('prefers a real DB image over the imageResolver fallback', () => {
    const withImage = { id: 'mat-3', name: 'x', images: [{ file_path: '/uploads/x.jpg' }] };
    const entity = toMaterialEntity(withImage, { imageResolver: () => '/assets/fallback.png' });
    expect(entity.imageUrl).toBe('/uploads/x.jpg');
  });

  it('uses the imageResolver fallback when there is no DB image', () => {
    const entity = toMaterialEntity(material, { imageResolver: () => '/assets/fallback.png' });
    expect(entity.imageUrl).toBe('/assets/fallback.png');
  });

  it('has no imageUrl when neither a DB image nor a resolver is available', () => {
    const entity = toMaterialEntity(material);
    expect(entity.imageUrl).toBeNull();
  });
});

describe('toProjectEntity', () => {
  const project = { id: 'proj-1', name: 'Akustik-Upgrade', location_name: 'Zeitz', images: [] };

  it('produces a correctly typed, routable entity', () => {
    const entity = toProjectEntity(project);
    expect(entity.type).toBe('project');
    expect(entity.id).toBe('project:proj-1');
    expect(entity.href).toBe('/projects/proj-1');
    expect(entity.title).toBe('Akustik-Upgrade');
    expect(entity.subtitle).toBe('Zeitz');
  });

  it('falls back to "Projekt" as subtitle when location_name is missing', () => {
    const entity = toProjectEntity({ id: 'proj-2', name: 'x', images: [] });
    expect(entity.subtitle).toBe('Projekt');
  });
});
