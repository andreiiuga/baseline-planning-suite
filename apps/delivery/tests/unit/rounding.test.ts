import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { apportion, formatScaled, toScaled } from '../../src/domain/rounding';
import { propertyParams } from '../support/property';

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

describe('toScaled', () => {
  it.each([
    [12.344, 2, 1234],
    [12.345, 2, 1235],
    [0.285, 2, 29], // 0.285 * 100 is 28.499999999999996 in floating point
    [0.5, 0, 1],
    [0, 2, 0],
    [49.95, 1, 500],
  ])('toScaled(%d, %d dp) = %d', (value, decimals, expected) => {
    expect(toScaled(value, decimals)).toBe(expected);
  });

  it.each([-0.01, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (value) => {
    expect(() => toScaled(value, 2)).toThrow(RangeError);
  });
});

describe('formatScaled', () => {
  it.each([
    [0, 2, '0.00'],
    [5, 2, '0.05'],
    [1234, 2, '12.34'],
    [788000, 2, '7,880.00'],
    [500, 1, '50.0'],
    [1234567, 2, '12,345.67'],
    [7, 0, '7'],
  ])('formatScaled(%d, %d dp) = %s', (scaled, decimals, expected) => {
    expect(formatScaled(scaled, decimals)).toBe(expected);
  });
});

describe('apportion (largest remainder)', () => {
  it('makes the displayed cells add up to the displayed total', () => {
    // 0.333.. x3 = 1.00: plain rounding would show 0.33 x3 = 0.99
    const { cells, total } = apportion([1 / 3, 1 / 3, 1 / 3], 2);
    expect(total).toBe(100);
    expect(cells).toEqual([34, 33, 33]);
    expect(sum(cells)).toBe(total);
  });

  it('gives the extra unit to the largest remainder', () => {
    const { cells } = apportion([0.101, 0.109, 0.1], 2); // exact 10.1, 10.9, 10.0
    expect(cells).toEqual([10, 11, 10]);
  });

  it('breaks ties in favour of the earliest index so values do not flicker', () => {
    const { cells, total } = apportion([0.005, 0.005, 0.005, 0.005], 2); // exact total 0.02
    expect(total).toBe(2);
    expect(cells).toEqual([1, 1, 0, 0]);
  });

  it('handles the 0.285 * 100 floating-point case', () => {
    expect(apportion([0.285], 2)).toEqual({ cells: [29], total: 29 });
  });

  it('handles empty and all-zero input', () => {
    expect(apportion([], 2)).toEqual({ cells: [], total: 0 });
    expect(apportion([0, 0, 0], 2)).toEqual({ cells: [0, 0, 0], total: 0 });
  });

  it('rejects negative or non-finite values', () => {
    expect(() => apportion([1, -0.5], 2)).toThrow(RangeError);
    expect(() => apportion([1, Number.NaN], 2)).toThrow(RangeError);
  });

  const amounts = fc.array(fc.double({ min: 0, max: 5000, noNaN: true }), { maxLength: 24 });
  const decimals = fc.integer({ min: 0, max: 3 });

  it('property: the cells always sum to the total', () => {
    fc.assert(
      fc.property(amounts, decimals, (values, dp) => {
        const { cells, total } = apportion(values, dp);
        expect(sum(cells)).toBe(total);
      }),
      propertyParams,
    );
  });

  it('property: the total is the exact sum, rounded once', () => {
    fc.assert(
      fc.property(amounts, decimals, (values, dp) => {
        const { total } = apportion(values, dp);
        expect(Math.abs(total - sum(values) * 10 ** dp)).toBeLessThanOrEqual(0.5 + 1e-6);
      }),
      propertyParams,
    );
  });

  it('property: every cell is within one unit of its exact value', () => {
    fc.assert(
      fc.property(amounts, decimals, (values, dp) => {
        const { cells } = apportion(values, dp);
        cells.forEach((cell, i) => {
          expect(Math.abs(cell - (values[i] ?? 0) * 10 ** dp)).toBeLessThanOrEqual(1 + 1e-6);
        });
      }),
      propertyParams,
    );
  });

  it('property: reordering input does not change the multiset of results when remainders differ', () => {
    // Integer part + a distinct remainder per cell, so no ties exist.
    const distinct = fc
      .uniqueArray(fc.tuple(fc.integer({ min: 0, max: 50 }), fc.integer({ min: 1, max: 63 })), {
        selector: ([, remainder]) => remainder,
        minLength: 1,
        maxLength: 12,
      })
      .map((pairs) => pairs.map(([whole, remainder]) => whole + remainder / 64));
    fc.assert(
      fc.property(distinct, (values) => {
        const forward = apportion(values, 0).cells;
        const reversed = apportion([...values].reverse(), 0).cells;
        expect([...forward].sort((a, b) => a - b)).toEqual([...reversed].sort((a, b) => a - b));
      }),
      propertyParams,
    );
  });
});
