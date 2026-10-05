import { describe, expect, it } from 'vitest';
import {
  amountThatFits,
  buildCapacityIndex,
  excessPm,
  isOverCapacity,
} from '../../src/domain/capacity';
import type { Allocation } from '../../src/domain/model';
import { allocations } from '../support/seed';

const alloc = (id: string, amount: number, seq: number, month = '2026-06'): Allocation => ({
  id,
  breakdownItemId: 'wbs-x',
  employeeId: 'emp-x',
  month,
  amount,
  seq,
});

describe('isOverCapacity', () => {
  it('flags only totals above one person-month', () => {
    expect(isOverCapacity(1)).toBe(false);
    expect(isOverCapacity(1.01)).toBe(true);
    expect(isOverCapacity(0.99)).toBe(false);
  });

  it('does not flag 0.1 + 0.7 + 0.2, which floating point may not sum to exactly 1', () => {
    expect(isOverCapacity(0.1 + 0.7 + 0.2)).toBe(false);
    expect(isOverCapacity(0.1 + 0.2 + 0.7)).toBe(false);
  });
});

describe('buildCapacityIndex', () => {
  it('sums every allocation of a person-month regardless of item or project', () => {
    const index = buildCapacityIndex([alloc('a', 0.6, 1), alloc('b', 0.59, 2)]);
    const load = index.get('emp-x', '2026-06');
    expect(load?.totalPm).toBeCloseTo(1.19, 10);
    expect(load?.over).toBe(true);
  });

  it('keeps months and people apart', () => {
    const index = buildCapacityIndex([
      alloc('a', 0.6, 1, '2026-05'),
      alloc('b', 0.6, 2, '2026-06'),
    ]);
    expect(index.overCapacity()).toEqual([]);
    expect(index.get('emp-x', '2026-07')).toBeUndefined();
    expect(index.get('emp-y', '2026-06')).toBeUndefined();
  });

  it('names the most recently edited allocation as the culprit', () => {
    const forward = buildCapacityIndex([alloc('a', 0.6, 1), alloc('b', 0.6, 2)]);
    const flipped = buildCapacityIndex([alloc('a', 0.6, 3), alloc('b', 0.6, 2)]);
    expect(forward.get('emp-x', '2026-06')?.culprit?.id).toBe('b');
    expect(flipped.get('emp-x', '2026-06')?.culprit?.id).toBe('a');
  });

  it('ignores zero-amount allocations when naming a culprit', () => {
    const index = buildCapacityIndex([alloc('a', 1.2, 1), alloc('zero', 0, 9)]);
    expect(index.get('emp-x', '2026-06')?.culprit?.id).toBe('a');
  });

  it('is not over at exactly one person-month', () => {
    const index = buildCapacityIndex([alloc('a', 0.1, 1), alloc('b', 0.7, 2), alloc('c', 0.2, 3)]);
    expect(index.get('emp-x', '2026-06')?.over).toBe(false);
  });
});

describe('seed data', () => {
  const index = buildCapacityIndex(allocations);

  it('flags Milan Brandt (emp-003) in June 2026 at 1.18 person-months (figure 5)', () => {
    const load = index.get('emp-003', '2026-06');
    expect(load?.totalPm).toBeCloseTo(1.18, 10);
    expect(load?.over).toBe(true);
  });

  it('names alloc-073, the later of his two 0.59 allocations, then alloc-050 when seq flips', () => {
    expect(index.get('emp-003', '2026-06')?.culprit?.id).toBe('alloc-073');
    const flipped = allocations.map((a) => (a.id === 'alloc-050' ? { ...a, seq: 1000 } : a));
    expect(buildCapacityIndex(flipped).get('emp-003', '2026-06')?.culprit?.id).toBe('alloc-050');
  });

  it('finds exactly the six over-capacity person-months in the fixtures', () => {
    const found = index
      .overCapacity()
      .map((l) => `${l.employeeId} ${l.month}`)
      .sort();
    expect(found).toEqual([
      'emp-002 2026-09',
      'emp-003 2026-06',
      'emp-012 2026-05',
      'emp-023 2026-06',
      'emp-031 2026-12',
      'emp-043 2026-10',
    ]);
  });

  it('counts the seeded March 2026 allocation outside the default window', () => {
    expect(index.get('emp-001', '2026-03')?.totalPm).toBeGreaterThanOrEqual(0.5);
  });

  it('only ever names a culprit for over-capacity person-months', () => {
    for (const load of index.overCapacity()) {
      expect(load.culprit).not.toBeNull();
      expect(load.totalPm).toBeGreaterThan(1);
    }
  });
});

describe('contributors and excess', () => {
  it('lists every non-zero allocation of a person-month, most recently edited first', () => {
    const load = buildCapacityIndex([
      alloc('old', 0.5, 1),
      alloc('zero', 0, 9),
      alloc('newest', 0.4, 7),
      alloc('mid', 0.3, 4),
    ]).get('emp-x', '2026-06');
    expect(load?.contributors.map((a) => a.id)).toEqual(['newest', 'mid', 'old']);
    expect(load?.culprit?.id).toBe('newest'); // the first contributor is the culprit
  });

  it('has no contributors for a person-month that only holds zeros', () => {
    const load = buildCapacityIndex([alloc('zero', 0, 1)]).get('emp-x', '2026-06');
    expect(load?.contributors).toEqual([]);
    expect(load?.culprit).toBeNull();
  });

  it('measures the excess over one person-month, and is zero when within capacity', () => {
    expect(excessPm({ totalPm: 1.18, over: true })).toBeCloseTo(0.18, 10);
    expect(excessPm({ totalPm: 1, over: false })).toBe(0);
    expect(excessPm({ totalPm: 0.4, over: false })).toBe(0);
  });

  it('gives the amount an allocation would drop to so the month fits', () => {
    const load = { totalPm: 1.18, over: true };
    expect(amountThatFits({ amount: 0.59 }, load)).toBeCloseTo(0.41, 10);
    expect(amountThatFits({ amount: 0.1 }, load)).toBe(0); // cannot absorb 0.18 on its own
    expect(amountThatFits({ amount: 0.59 }, { totalPm: 0.9, over: false })).toBe(0.59);
  });

  it('after applying the fit, the person-month is no longer over capacity', () => {
    const set = [alloc('a', 0.6, 1), alloc('b', 0.59, 2)];
    const before = buildCapacityIndex(set).get('emp-x', '2026-06');
    if (!before) throw new Error('missing');
    const fitted = set.map((a) => (a.id === 'b' ? { ...a, amount: amountThatFits(a, before) } : a));
    expect(buildCapacityIndex(fitted).get('emp-x', '2026-06')?.over).toBe(false);
  });

  it('finds Brandt in June 2026 with both seeded allocations, the later one first', () => {
    const load = buildCapacityIndex(allocations).get('emp-003', '2026-06');
    expect(load?.contributors.map((a) => a.id)).toEqual(['alloc-073', 'alloc-050']);
  });
});
