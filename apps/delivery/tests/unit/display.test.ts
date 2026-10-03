import { describe, expect, it } from 'vitest';
import {
  apportionUnit,
  displayValue,
  formatUnit,
  monthLabel,
  UNIT_DECIMALS,
} from '../../src/domain/display';
import { parseYearMonth } from '../../src/domain/dates';

describe('display precision', () => {
  it('uses hours 2, person-months 2, percent 1, cost 2 decimals', () => {
    expect(UNIT_DECIMALS).toEqual({ hours: 2, pm: 2, pct: 1, eur: 2 });
  });

  it.each([
    [88, 'hours', '88.00'],
    [0.5, 'pm', '0.50'],
    [50, 'pct', '50.0'],
    [7880, 'eur', '7,880.00'],
    [0.59, 'pm', '0.59'],
    [49.96, 'pct', '50.0'],
    [4.7, 'pm', '4.70'],
  ] as const)('shows %d in %s as %s', (value, unit, text) => {
    expect(displayValue(value, unit).text).toBe(text);
  });

  it('formats scaled integers per unit', () => {
    expect(formatUnit(788000, 'eur')).toBe('7,880.00');
    expect(formatUnit(505, 'pct')).toBe('50.5');
  });

  it('apportions a row in the unit precision so the shown cells add up', () => {
    const months = [0.8, 1.0, 1.15, 0.9, 0.6, 0.25];
    const { cells, total } = apportionUnit(months, 'pm');
    expect(total).toBe(470);
    expect(cells.reduce((a, b) => a + b, 0)).toBe(total);
    expect(cells.map((c) => formatUnit(c, 'pm'))).toEqual([
      '0.80',
      '1.00',
      '1.15',
      '0.90',
      '0.60',
      '0.25',
    ]);
  });
});

describe('monthLabel', () => {
  it.each([
    ['2026-04', 'Apr 26'],
    ['2027-03', 'Mar 27'],
    ['2026-12', 'Dec 26'],
    ['2030-01', 'Jan 30'],
  ])('labels %s as %s', (month, label) => {
    expect(monthLabel(parseYearMonth(month))).toBe(label);
  });
});
