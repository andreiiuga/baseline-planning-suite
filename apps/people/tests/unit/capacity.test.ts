import { describe, expect, it } from 'vitest';
import { oversubscribedMonths } from '../../src/domain/capacity';
import { formatMoney } from '../../src/domain/money';

describe('oversubscribedMonths', () => {
  it('lists, per person, the sorted months above capacity', () => {
    const result = oversubscribedMonths([
      { employeeId: 'a', month: '2026-07', allocatedPM: 1.2 },
      { employeeId: 'a', month: '2026-06', allocatedPM: 1.18 },
      { employeeId: 'a', month: '2026-08', allocatedPM: 1 },
      { employeeId: 'b', month: '2026-06', allocatedPM: 0.9 },
    ]);
    expect([...result.entries()]).toEqual([['a', ['2026-06', '2026-07']]]);
  });

  it('is empty when nobody is over', () => {
    expect(oversubscribedMonths([{ employeeId: 'a', month: '2026-06', allocatedPM: 1 }]).size).toBe(
      0,
    );
    expect(oversubscribedMonths([]).size).toBe(0);
  });
});

describe('formatMoney', () => {
  it('converts from EUR with two decimals', () => {
    expect(formatMoney(95, 1)).toBe('95.00');
    expect(formatMoney(95, 1.08)).toBe('102.60');
  });
});
