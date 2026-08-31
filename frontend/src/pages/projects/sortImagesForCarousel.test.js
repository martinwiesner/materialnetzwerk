import { describe, it, expect } from 'vitest';
import { sortImagesForCarousel } from './ProjectDetail';

describe('sortImagesForCarousel', () => {
  it('puts general (non-step) images before step images', () => {
    const images = [
      { id: 'step-1', step_index: 0 },
      { id: 'general-1', step_index: null },
      { id: 'step-2', step_index: 1 },
      { id: 'general-2', step_index: null },
    ];
    const sorted = sortImagesForCarousel(images).map((i) => i.id);
    expect(sorted).toEqual(['general-1', 'general-2', 'step-1', 'step-2']);
  });

  it('is a stable sort — preserves relative order within each group', () => {
    const images = [
      { id: 'step-b', step_index: 1 },
      { id: 'step-a', step_index: 0 },
      { id: 'general-b', step_index: null },
      { id: 'general-a', step_index: null },
    ];
    const sorted = sortImagesForCarousel(images).map((i) => i.id);
    expect(sorted).toEqual(['general-b', 'general-a', 'step-b', 'step-a']);
  });

  it('does not mutate the input array', () => {
    const images = [{ id: 'a', step_index: 0 }, { id: 'b', step_index: null }];
    const original = [...images];
    sortImagesForCarousel(images);
    expect(images).toEqual(original);
  });

  it('handles an all-general or all-step list unchanged in order', () => {
    const allGeneral = [{ id: 'a', step_index: null }, { id: 'b', step_index: null }];
    expect(sortImagesForCarousel(allGeneral).map((i) => i.id)).toEqual(['a', 'b']);

    const allSteps = [{ id: 'a', step_index: 0 }, { id: 'b', step_index: 1 }];
    expect(sortImagesForCarousel(allSteps).map((i) => i.id)).toEqual(['a', 'b']);
  });
});
