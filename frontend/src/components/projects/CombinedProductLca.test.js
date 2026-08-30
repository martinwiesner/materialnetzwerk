import { describe, it, expect } from 'vitest';
import {
  EF31_CONV,
  sumMods,
  indsToPt,
  indsToCatPt,
  indsToGWP,
  ccPtToGWP,
  ptToPhysical,
  buildEntries,
  fmtPt,
  fmtGWP,
  fmtPct,
  fmtIndVal,
  heatBg,
} from './CombinedProductLca';

const A1A3_KEYS = ['A1-A3', 'A1', 'A2', 'A3'];
const EOL_KEYS = ['C3', 'C4'];

describe('sumMods', () => {
  it('sumAll=false returns the first matching key in the given order', () => {
    expect(sumMods({ 'A1-A3': 5, A1: 1, A2: 2, A3: 3 }, A1A3_KEYS)).toBe(5);
  });

  it('sumAll=false returns the first individual key when the composite key is absent', () => {
    expect(sumMods({ A1: 1, A2: 2, A3: 3 }, A1A3_KEYS)).toBe(1);
  });

  it('sumAll=true sums every matching key found (independent modules like C3+C4)', () => {
    expect(sumMods({ C3: 2, C4: 3 }, EOL_KEYS, true)).toBe(5);
    expect(sumMods({ C3: 2 }, EOL_KEYS, true)).toBe(2);
  });

  it('returns null when none of the keys are present', () => {
    expect(sumMods({ B6: 1 }, A1A3_KEYS)).toBeNull();
  });

  it('ignores null values for a key', () => {
    expect(sumMods({ 'A1-A3': null, A1: 4 }, A1A3_KEYS)).toBe(4);
  });
});

describe('ccPtToGWP (IDEMAT climate_change Pt -> kg CO2 eq.)', () => {
  it('applies the EF 3.1 norm/weighting inversion', () => {
    // climate_change [Pt] = GWP / 7550 * 0.2106  =>  GWP = Pt * 7550 / 0.2106
    expect(ccPtToGWP(0.2106)).toBeCloseTo(7550, 5);
  });

  it('returns null for a missing Pt value', () => {
    expect(ccPtToGWP(null)).toBeNull();
    expect(ccPtToGWP(undefined)).toBeNull();
  });

  it('handles zero correctly (not treated as missing)', () => {
    expect(ccPtToGWP(0)).toBe(0);
  });
});

describe('ptToPhysical (generic inverse of Pt = value/norm * wf)', () => {
  it('matches ccPtToGWP exactly for the GWP-total category (same underlying formula)', () => {
    const pt = 0.05;
    expect(ptToPhysical('GWP-total', pt)).toBeCloseTo(ccPtToGWP(pt), 8);
  });

  it('uses the category-specific norm/wf for a different indicator (WDP)', () => {
    const { norm, wf } = EF31_CONV['WDP'];
    const pt = 0.01;
    expect(ptToPhysical('WDP', pt)).toBeCloseTo((pt * norm) / wf, 8);
  });

  it('returns null for an unknown indicator key', () => {
    expect(ptToPhysical('not-a-real-indicator', 1)).toBeNull();
  });
});

describe('indsToGWP / indsToPt / indsToCatPt', () => {
  const indicators = {
    'GWP-total': { unit: 'kg CO2 eq.', mods: { 'A1-A3': 10, B6: 1, C3: 0.5, C4: 0.5 } },
    'AP': { unit: 'mol H+ eq.', mods: { 'A1-A3': 0.02 } },
  };

  it('indsToGWP reads the declared GWP value directly, no Pt conversion', () => {
    expect(indsToGWP(indicators, A1A3_KEYS)).toBe(10);
    expect(indsToGWP(indicators, EOL_KEYS, true)).toBe(1); // C3 + C4
  });

  it('indsToPt converts every present, convertible indicator to Pt and sums them', () => {
    const { pt, covered } = indsToPt(indicators, A1A3_KEYS);
    const expectedGwpPt = (10 / EF31_CONV['GWP-total'].norm) * EF31_CONV['GWP-total'].wf;
    const expectedApPt = (0.02 / EF31_CONV['AP'].norm) * EF31_CONV['AP'].wf;
    expect(pt).toBeCloseTo(expectedGwpPt + expectedApPt, 10);
    expect(covered.sort()).toEqual(['AP', 'GWP-total']);
  });

  it('indsToCatPt isolates a single EF 3.1 category by its ef31 key', () => {
    const gwpPt = indsToCatPt(indicators, 'climate_change', A1A3_KEYS);
    expect(gwpPt).toBeCloseTo((10 / EF31_CONV['GWP-total'].norm) * EF31_CONV['GWP-total'].wf, 10);
    // A category not present in the indicators returns null
    expect(indsToCatPt(indicators, 'water_use', A1A3_KEYS)).toBeNull();
  });
});

describe('buildEntries', () => {
  const material = {
    id: 'mat-1',
    name: 'Anhydrous Citric Acid',
    quantity: 2,
    unit: 'kg',
    indicators: {
      'GWP-total': { unit: 'kg CO2 eq.', mods: { 'A1-A3': 1.15 } },
    },
  };
  const idematItem = {
    id: 'proc-1',
    name: 'Flour wheat, white',
    quantity: 0.2,
    unit: 'kg',
    ef31_total: 0.0000476,
    ef31: { climate_change: 0.0000047, acidification: 0.000001 },
  };

  it('scales a material entry’s declared GWP by its quantity', () => {
    const [matEntry] = buildEntries([material], [], 'total');
    expect(matEntry.type).toBe('material');
    expect(matEntry.gwpA1A3).toBeCloseTo(1.15 * 2, 10);
  });

  it('back-calculates a process entry’s GWP from its climate_change Pt × quantity', () => {
    const [, procEntry] = buildEntries([material], [idematItem], 'total');
    expect(procEntry.type).toBe('process');
    const expectedCcPt = idematItem.ef31.climate_change * idematItem.quantity;
    expect(procEntry.gwpA1A3).toBeCloseTo(ccPtToGWP(expectedCcPt), 8);
  });

  it('computes total Pt for a material from every convertible indicator it declares', () => {
    const [matEntry] = buildEntries([material], [], 'total');
    const expectedPt = (1.15 * 2 / EF31_CONV['GWP-total'].norm) * EF31_CONV['GWP-total'].wf;
    expect(matEntry.a1a3Pt).toBeCloseTo(expectedPt, 10);
  });

  it('computes a process entry’s total Pt as ef31_total × quantity', () => {
    const [, procEntry] = buildEntries([material], [idematItem], 'total');
    expect(procEntry.a1a3Pt).toBeCloseTo(idematItem.ef31_total * idematItem.quantity, 12);
  });

  it('returns an empty array when given no materials or processes', () => {
    expect(buildEntries([], [], 'total')).toEqual([]);
  });
});

describe('formatters', () => {
  it('fmtIndVal stays in fixed-point notation down to 1e-8', () => {
    expect(fmtIndVal(0.0000829)).toBe('0,00008290');
    expect(fmtIndVal(1e-8)).not.toMatch(/e/i);
  });

  it('fmtIndVal falls back to exponential notation below 1e-8', () => {
    expect(fmtIndVal(5e-10)).toMatch(/e/i);
  });

  it('fmtIndVal handles zero and null distinctly from small numbers', () => {
    expect(fmtIndVal(0)).toBe('0');
    expect(fmtIndVal(null)).toBe('—');
    expect(fmtIndVal(undefined)).toBe('—');
  });

  it('fmtPct formats a ratio as a German-style percentage with one decimal', () => {
    expect(fmtPct(24.567)).toBe('24.6 %');
  });

  it('fmtPct handles non-finite / missing values', () => {
    expect(fmtPct(null)).toBe('—');
    expect(fmtPct(Infinity)).toBe('—');
  });

  it('fmtPt and fmtGWP both render 0 and missing values consistently', () => {
    for (const fmt of [fmtPt, fmtGWP]) {
      expect(fmt(0)).toBe('0');
      expect(fmt(null)).toBe('—');
    }
  });
});

describe('heatBg', () => {
  it('returns undefined for zero/falsy intensity (no highlight)', () => {
    expect(heatBg(0)).toBeUndefined();
  });

  it('scales alpha linearly between 0.1 and 0.6 with intensity', () => {
    expect(heatBg(1)).toBe('rgba(220, 38, 38, 0.60)');
    expect(heatBg(0.5)).toBe('rgba(220, 38, 38, 0.35)');
  });

  it('clamps intensity above 1 to the maximum alpha', () => {
    expect(heatBg(5)).toBe('rgba(220, 38, 38, 0.60)');
  });
});
