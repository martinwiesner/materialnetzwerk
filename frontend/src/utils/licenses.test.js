import { describe, it, expect } from 'vitest';
import { LICENSE_OPTIONS, licenseOptionsFor, getLicenseLabel } from './licenses';

describe('licenseOptionsFor', () => {
  it('returns only hardware licenses plus the category-agnostic ones', () => {
    const options = licenseOptionsFor('hardware');
    expect(options.map(o => o.value)).toEqual(
      expect.arrayContaining(['CERN-OHL-S-2.0', 'CERN-OHL-W-2.0', 'CERN-OHL-P-2.0', 'All-Rights-Reserved', 'Other'])
    );
    // No software- or documentation-only licenses should leak in
    expect(options.some(o => o.value === 'MIT')).toBe(false);
    expect(options.some(o => o.value === 'CC-BY-4.0')).toBe(false);
  });

  it('returns only software licenses plus the category-agnostic ones', () => {
    const options = licenseOptionsFor('software');
    expect(options.map(o => o.value)).toEqual(expect.arrayContaining(['MIT', 'Apache-2.0', 'GPL-3.0-only']));
    expect(options.some(o => o.value === 'CERN-OHL-S-2.0')).toBe(false);
  });

  it('returns only documentation licenses plus the category-agnostic ones', () => {
    const options = licenseOptionsFor('documentation');
    expect(options.map(o => o.value)).toEqual(expect.arrayContaining(['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0-1.0']));
    expect(options.some(o => o.value === 'MIT')).toBe(false);
  });

  it('every option in LICENSE_OPTIONS belongs to exactly one of the three categories or none', () => {
    const validCategories = new Set(['hardware', 'software', 'documentation', null]);
    for (const opt of LICENSE_OPTIONS) {
      expect(validCategories.has(opt.category)).toBe(true);
    }
  });
});

describe('getLicenseLabel', () => {
  it('resolves a known SPDX value to its human-readable label', () => {
    expect(getLicenseLabel('MIT')).toBe('MIT License');
    expect(getLicenseLabel('CC-BY-4.0')).toBe('CC BY 4.0 – Namensnennung');
  });

  it('returns null for an empty/falsy value (no license set)', () => {
    expect(getLicenseLabel('')).toBeNull();
    expect(getLicenseLabel(null)).toBeNull();
    expect(getLicenseLabel(undefined)).toBeNull();
  });

  it('falls back to returning the raw value for an unrecognized SPDX id', () => {
    // e.g. a legacy value that predates this list, or a manually-entered one
    expect(getLicenseLabel('Some-Unknown-License')).toBe('Some-Unknown-License');
  });
});
