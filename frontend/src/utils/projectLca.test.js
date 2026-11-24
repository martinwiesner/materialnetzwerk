import { describe, it, expect } from 'vitest';
import { parseDensity, quantityFactor, conversionGap, buildProjectLca, indicatorModules, libDeclaredUnit, projectGwpSummary, formatProjectGwp } from './projectLca';

describe('parseDensity', () => {
  it('parses free-text densities to kg/m³', () => {
    expect(parseDensity('1600')).toBe(1600);
    expect(parseDensity('2.000 kg/m³')).toBe(2000);
    expect(parseDensity('1,2 g/cm³')).toBeCloseTo(1200);
    expect(parseDensity('1.67')).toBeNull();
    expect(parseDensity('15 kg')).toBeNull();
    expect(parseDensity('Idk')).toBeNull();
  });
});

describe('quantityFactor', () => {
  it('converts mass units and declared amounts', () => {
    expect(quantityFactor('kg', '1 t')).toBeCloseTo(0.001);
    expect(quantityFactor('t', 'kg')).toBe(1000);
    expect(quantityFactor('kg', '1000 kg')).toBeCloseTo(0.001);
    expect(quantityFactor('unit', '1 t')).toBe(1);
    expect(quantityFactor('m3', 'm³')).toBe(1);
  });
  it('converts mass ↔ volume via density only', () => {
    expect(quantityFactor('m³', 'kg', 1600)).toBe(1600);
    expect(quantityFactor('kg', '1 m³', 2000)).toBeCloseTo(0.0005);
    expect(quantityFactor('kg', '1 m³')).toBeNull();
    expect(quantityFactor('kg', 'm²')).toBeNull();
  });
});

describe('libDeclaredUnit', () => {
  it('prefers declared_unit over the (defaulted) GWP denominator', () => {
    expect(libDeclaredUnit({ gwp_unit: 'kg CO2e/kg', declared_unit: '1 m³' })).toBe('1 m³');
    expect(libDeclaredUnit({ gwp_unit: 'kg CO2e/m3' })).toBe('m3');
    expect(libDeclaredUnit({ gwp_unit: 'kg CO2e/unit', declared_unit: '1 t' })).toBe('1 t');
    expect(libDeclaredUnit({ gwp_unit: 'kg CO2e' })).toBe('kg');
  });
});

describe('buildProjectLca', () => {
  const lib = (o) => ({ has_gwp_data: 1, effective_gwp_value: o.gwp_value, ...o });

  it('includes library-only projects', () => {
    const lca = buildProjectLca({
      materials: [lib({ material_name: 'Sekundäraluminium', quantity: 6.9, unit: 'kg', gwp_value: 0.5, gwp_unit: 'kg CO2e/kg' })],
      oekodat_materials: '[]',
    });
    expect(lca.entries).toHaveLength(1);
    expect(indicatorModules(lca.totals, 'GWP-total').a1a3).toBeCloseTo(3.45);
  });

  it('combines library materials and EPDs and reports skipped ones', () => {
    const lca = buildProjectLca({
      materials: [
        lib({ material_name: 'Sand', quantity: 0.3, unit: 'unit', gwp_value: 4.15, gwp_unit: 'kg CO2e/unit', declared_unit: '1 t' }),
        lib({ material_name: 'Placeholder', quantity: 1, unit: 'kg', gwp_value: 0, gwp_unit: 'kg CO2e/kg' }),
        lib({ material_name: 'Ohne Menge', quantity: null, unit: 'kg', gwp_value: 2, gwp_unit: 'kg CO2e/kg' }),
      ],
      oekodat_materials: JSON.stringify([{
        name: 'Beton', quantity: 2, unit: 'm³', declaredUnit: 'm³',
        indicators: { 'GWP-total': { unit: 'kg CO₂ eq.', mods: { 'A1-A3': 200, C3: 5, C4: 3, D: -10 } } },
      }]),
    });
    expect(lca.materialCount).toBe(4);
    expect(lca.entries).toHaveLength(2);
    expect(lca.skipped.map(s => s.reason)).toEqual(['data', 'quantity']);
    const gwp = indicatorModules(lca.totals, 'GWP-total');
    expect(gwp.a1a3).toBeCloseTo(0.3 * 4.15 + 400);
    expect(gwp.eol).toBeCloseTo(16); // C3 + C4 summed
    expect(gwp.d).toBeCloseTo(-20);
    expect(gwp.total).toBeCloseTo(0.3 * 4.15 + 416);
  });
});

describe('conversion via areal / piece weight', () => {
  it('bridges dimensions via mass and explains gaps', () => {
    expect(quantityFactor('m²', 'kg', { areal: 12 })).toBe(12);
    expect(quantityFactor('stk', '1 t', { piece: 500 })).toBeCloseTo(0.5);
    expect(quantityFactor('m³', 'm²', { density: 1000, areal: 10 })).toBe(100);
    expect(conversionGap('m³', 'kg')).toBe('density');
    expect(conversionGap('kg', 'm²')).toBe('areal');
    expect(conversionGap('stk', 'kg')).toBe('piece');
    expect(conversionGap('kg', 'lfm')).toBe('unit');
  });
});

describe('ad-hoc variant from an ÖKOBAUDAT dataset', () => {
  it('balances 1 m³ of a concrete EPD declared per m³', () => {
    const epd = {
      uuid: 'b1', name: 'Beton C25/30', declaredUnit: 'm3', density: 2280,
      indicators: { 'GWP-total': { unit: 'kg CO₂ eq.', mods: { 'A1-A3': 127.2, C3: 1.1, D: -3 } } },
    };
    const lca = buildProjectLca({ materials: [], oekodat_materials: [{ ...epd, quantity: 1, unit: 'm³' }] });
    const gwp = indicatorModules(lca.totals, 'GWP-total');
    expect(gwp.a1a3).toBeCloseTo(127.2);
    expect(gwp.total).toBeCloseTo(128.3);
    // same dataset per kg via its density
    expect(quantityFactor('1 kg', 'm3', 2280) * 127.2).toBeCloseTo(0.0558, 4);
  });
});

describe('projectGwpSummary (cards & badges)', () => {
  const climAdd = { material_name: 'Clim@Add', quantity: 60, unit: 'kg', has_gwp_data: 1, gwp_value: -2.768, effective_gwp_value: -2.768, gwp_unit: 'kg CO2e/kg', declared_unit: '1 kg' };
  const beton = { name: 'Beton C25/30', quantity: 1, unit: 'm³', declaredUnit: 'm3', indicators: { 'GWP-total': { unit: 'kg CO₂ eq.', mods: { 'A1-A3': 125.88, C3: 2 } } } };

  it('includes ÖKOBAUDAT EPDs, not only library materials', () => {
    const s = projectGwpSummary({ materials: [climAdd], oekodat_materials: JSON.stringify([beton]) });
    expect(s.a1a3).toBeCloseTo(-166.08 + 125.88);
    expect(s.complete).toBe(true);
    expect(formatProjectGwp(s)).toBe('-40,2 kg CO₂e (A1–A3)');
  });

  it('marks incomplete sums', () => {
    const s = projectGwpSummary({ materials: [climAdd, { material_name: 'Sand', quantity: 100, unit: 'kg', has_gwp_data: 0, gwp_value: 0 }], oekodat_materials: '[]' });
    expect(formatProjectGwp(s)).toBe('-166,1 kg CO₂e (A1–A3) · 1 von 2');
  });

  it('returns no label without materials or values', () => {
    expect(projectGwpSummary({ materials: [], oekodat_materials: '[]' })).toBeNull();
    expect(formatProjectGwp(projectGwpSummary({ materials: [{ material_name: 'X', quantity: 1, has_gwp_data: 0 }] }))).toBeNull();
  });
});
