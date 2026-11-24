import { describe, it, expect } from 'vitest';
import { expandSearchTerm } from './searchSynonyms';

describe('expandSearchTerm', () => {
  it('splits compounds into searchable material stems', () => {
    const r = expandSearchTerm('Hanfdämmung');
    expect(r.queries).toEqual(['Hanfdämmung', 'Hanf']);
    expect(r.suggestions).toContain('Dämmstoff');
  });

  it('suggests categories for a plain material word', () => {
    const r = expandSearchTerm('Beton');
    expect(r.queries).toEqual(['Beton']);
    expect(r.suggestions).toEqual(expect.arrayContaining(['Transportbeton', 'Betonfertigteil']));
  });

  it('handles empty and unknown terms', () => {
    expect(expandSearchTerm('')).toEqual({ queries: [], suggestions: [] });
    expect(expandSearchTerm('Xyz')).toEqual({ queries: ['Xyz'], suggestions: [] });
  });
});
