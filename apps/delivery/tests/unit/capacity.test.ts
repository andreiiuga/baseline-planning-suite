import { describe, expect, it } from 'vitest';
import { buildCapacityIndex, isOverCapacity } from '../../src/domain/capacity';
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
