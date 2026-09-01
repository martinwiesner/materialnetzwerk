import { describe, it, expect } from 'vitest';
import { formatPt } from './lcaFormat';

describe('formatPt', () => {
  it('handles null/empty/NaN', () => {
    expect(formatPt(null)).toBe('—');
    expect(formatPt(undefined)).toBe('—');
    expect(formatPt('')).toBe('—');
    expect(formatPt('abc')).toBe('—');
  });

  it('handles zero', () => {
    expect(formatPt(0)).toBe('0 Pt');
  });

  it('keeps values >= 1 Pt in Pt', () => {
    expect(formatPt(1.5)).toBe('1,5 Pt');
    expect(formatPt(42)).toBe('42 Pt');
  });

  it('scales values in [0.001, 1) Pt to mPt', () => {
    expect(formatPt(0.5)).toBe('500 mPt');
    expect(formatPt(0.001)).toBe('1 mPt');
  });

  it('never scales below mPt, even for very small values (stays approachable for laypeople)', () => {
    // exact values from the screenshot that prompted this fix — capped at mPt
    // with extra fraction digits instead of switching to µPt
    expect(formatPt(0.00005549)).toBe('0,05549 mPt');
    expect(formatPt(0.000009618)).toBe('0,009618 mPt');
  });

  it('falls back to scientific Pt notation only for practically negligible values (< 1e-9 Pt)', () => {
    expect(formatPt(0.0000000005)).toBe('5.00e-10 Pt');
  });

  it('preserves sign for negative values (avoided-burden credits)', () => {
    expect(formatPt(-0.00005549)).toBe('-0,05549 mPt');
    expect(formatPt(-2)).toBe('-2 Pt');
  });
});
