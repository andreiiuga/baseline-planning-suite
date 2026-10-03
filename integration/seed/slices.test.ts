import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderSlices, SEED_PATH, SLICE_PATHS } from '../../scripts/make-seed-slices';
import { buildSlices, validateSeed, type RawSeed } from '../../scripts/seed-slices';

const root = resolve(import.meta.dirname, '../..');
const load = (): RawSeed => JSON.parse(readFileSync(resolve(root, SEED_PATH), 'utf8')) as RawSeed;
/** A fresh copy each time so corruption never leaks between tests. */
const corrupt = (change: (seed: RawSeed) => void): RawSeed => {
  const seed = load();
  change(seed);
  return seed;
};

describe('the provided seed', () => {
  it('satisfies every invariant', () => {
    expect(() => validateSeed(load())).not.toThrow();
  });

  it('has the documented counts', () => {
    const seed = load();
    expect([
      seed.employees.length,
      seed.rateRecords.length,
      seed.projects.length,
      seed.breakdownItems.length,
      seed.allocations.length,
    ]).toEqual([60, 150, 4, 90, 720]);
  });
});

describe('validateSeed fails loudly on a corrupted copy', () => {
  it('a wrong count', () => {
    expect(() => validateSeed(corrupt((s) => s.allocations.pop()))).toThrow(/720 allocations/);
  });

  it('a duplicate id', () => {
    const seed = corrupt((s) => {
      const second = s.employees[1];
      if (second) second.id = 'emp-001';
    });
    expect(() => validateSeed(seed)).toThrow(/duplicate ids in employees/);
  });

  it('an allocation on a parent item', () => {
    const seed = corrupt((s) => {
      const parentId = s.breakdownItems.find((i) => i.parentId !== null)?.parentId;
      const first = s.allocations[0];
      if (first && parentId) first.breakdownItemId = parentId;
    });
    expect(() => validateSeed(seed)).toThrow(/not a leaf/);
  });

  it('a missing reference allocation', () => {
    const seed = corrupt((s) => {
      const first = s.allocations[0];
      if (first) first.id = 'alloc-renamed';
    });
    expect(() => validateSeed(seed)).toThrow(/alloc-001/);
  });

  it('an allocation for an unknown employee', () => {
    const seed = corrupt((s) => {
      const first = s.allocations[1];
      if (first) first.employeeId = 'emp-999';
    });
    expect(() => validateSeed(seed)).toThrow(/unknown employee/);
  });

  it('a weekly hours value outside 40, 32 and 20', () => {
    const seed = corrupt((s) => {
      const first = s.employees[0];
      if (first) first.weeklyHours = 35;
    });
    expect(() => validateSeed(seed)).toThrow(/weeklyHours/);
  });

  it('two rates starting on the same day', () => {
    const seed = corrupt((s) => {
      const [a, b] = s.rateRecords.filter((r) => r.employeeId === 'emp-001');
      if (a && b) b.validFrom = a.validFrom;
    });
    expect(() => validateSeed(seed)).toThrow(/start on/);
  });
});

describe('buildSlices', () => {
  const slices = buildSlices(load());

  it('keeps ids and values intact', () => {
    const seed = load();
    expect(slices.people.employees).toEqual(seed.employees);
    expect(slices.people.rateRecords).toEqual(seed.rateRecords);
    expect(slices.delivery.projects).toEqual(seed.projects);
    expect(slices.delivery.breakdownItems).toEqual(seed.breakdownItems);
    expect(
      slices.delivery.allocations.map((a) => ({
        id: a.id,
        breakdownItemId: a.breakdownItemId,
        employeeId: a.employeeId,
        month: a.month,
        amount: a.amount,
      })),
    ).toEqual(seed.allocations);
  });

  it('assigns seq in file order starting at 1', () => {
    const { allocations } = slices.delivery;
    expect(allocations[0]?.seq).toBe(1);
    expect(allocations.at(-1)?.seq).toBe(720);
    expect(allocations.find((a) => a.id === 'alloc-050')?.seq).toBeLessThan(
      allocations.find((a) => a.id === 'alloc-073')?.seq ?? 0,
    );
  });

  it('derives monthly totals for People, including Brandt in June 2026', () => {
    const brandt = slices.peopleAllocationTotals.find(
      (t) => t.employeeId === 'emp-003' && t.month === '2026-06',
    );
    expect(brandt?.allocatedPM).toBeCloseTo(1.18, 10);
  });
});

describe('committed slices', () => {
  it('match what the script generates (run pnpm seed:slices after touching the seed)', () => {
    const rendered = renderSlices();
    for (const key of Object.keys(SLICE_PATHS) as (keyof typeof SLICE_PATHS)[]) {
      const committed = readFileSync(resolve(root, SLICE_PATHS[key]), 'utf8');
      expect(committed, SLICE_PATHS[key]).toBe(rendered[key]);
    }
  });
});
