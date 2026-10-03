import { describe, expect, it } from 'vitest';
import { monthRange, parseYearMonth } from '../../src/domain/dates';
import { UNIT_DECIMALS } from '../../src/domain/display';
import type { Allocation, BreakdownItem } from '../../src/domain/model';
import { buildGrid, type GridModel } from '../../src/domain/rollup';
import { pmToUnit, UNITS } from '../../src/domain/units';
import { allocations, breakdownItems, contextFor, projectIds } from '../support/seed';

const window = monthRange(parseYearMonth('2026-04'), parseYearMonth('2027-03'));

const item = (id: string, parentId: string | null): BreakdownItem => ({
  id,
  projectId: 'p',
  parentId,
  name: id,
});
const alloc = (
  id: string,
  itemId: string,
  employeeId: string,
  month: string,
  amount: number,
): Allocation => ({
  id,
  breakdownItemId: itemId,
  employeeId,
  month,
  amount,
  seq: 1,
});

describe('buildGrid on a small tree', () => {
  const items = [item('root', null), item('a', 'root'), item('b', 'root'), item('lone', null)];
  const months = window.slice(0, 3); // Apr, May, Jun
  const data = [
    alloc('1', 'a', 'e1', '2026-04', 0.5),
    alloc('2', 'a', 'e1', '2026-05', 0.25),
    alloc('3', 'a', 'e2', '2026-05', 0.25),
    alloc('4', 'b', 'e1', '2026-06', 1),
    alloc('5', 'lone', 'e2', '2026-04', 0.1),
    alloc('6', 'a', 'e1', '2027-01', 9), // outside the window: not shown
  ];
  const grid = buildGrid({
    items,
    allocations: data,
    months,
    decimals: 2,
    valueOf: (a) => a.amount,
  });
  const row = (id: string) => {
    const r = grid.items.get(id);
    if (!r) throw new Error(`no row ${id}`);
    return r;
  };

  it('puts person rows only under leaves, in employee order', () => {
    expect(row('a').people.map((p) => p.employeeId)).toEqual(['e1', 'e2']);
    expect(row('root').people).toEqual([]);
  });

  it('derives parents from their children as scaled integers', () => {
    expect(row('a').cells).toEqual([50, 50, 0]);
    expect(row('b').cells).toEqual([0, 0, 100]);
    expect(row('root').cells).toEqual([50, 50, 100]);
    expect(row('root').total).toBe(200);
  });

  it('adds the footer from the root rows', () => {
    expect(grid.footer.cells).toEqual([60, 50, 100]);
    expect(grid.footer.total).toBe(210);
  });

  it('ignores allocations outside the window and on other projects', () => {
    const other = alloc('x', 'not-in-this-project', 'e1', '2026-04', 5);
    const again = buildGrid({
      items,
      allocations: [...data, other],
      months,
      decimals: 2,
      valueOf: (a) => a.amount,
    });
    expect(again.footer.total).toBe(210);
  });

  it('refuses an allocation sitting on a parent instead of dropping it', () => {
    expect(() =>
      buildGrid({
        items,
        allocations: [alloc('bad', 'root', 'e1', '2026-04', 1)],
        months,
        decimals: 2,
        valueOf: (a) => a.amount,
      }),
    ).toThrow(/not a leaf/);
  });

  it('rejects a tree that references a missing parent', () => {
    expect(() =>
      buildGrid({
        items: [item('orphan', 'ghost')],
        allocations: [],
        months,
        decimals: 2,
        valueOf: (a) => a.amount,
      }),
    ).toThrow(/cycle or reference a missing parent/);
  });

  it('apportions a person row so its months add up to the rounded exact sum', () => {
    const thirds = buildGrid({
      items: [item('x', null)],
      allocations: [
        alloc('t1', 'x', 'e1', '2026-04', 1 / 3),
        alloc('t2', 'x', 'e1', '2026-05', 1 / 3),
        alloc('t3', 'x', 'e1', '2026-06', 1 / 3),
      ],
      months,
      decimals: 2,
      valueOf: (a) => a.amount,
    });
    const person = thirds.items.get('x')?.people[0];
    expect(person?.cells).toEqual([34, 33, 33]);
    expect(person?.total).toBe(100);
  });
});

/** Recomputes every identity independently of buildGrid's own bookkeeping. */
function expectReconciled(grid: GridModel): void {
  const width = grid.months.length;
  const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
  for (const row of grid.items.values()) {
    expect(sum(row.cells)).toBe(row.total);
    if (row.childIds.length === 0) {
      for (const person of row.people) expect(sum(person.cells)).toBe(person.total);
      for (let c = 0; c < width; c += 1) {
        expect(sum(row.people.map((p) => p.cells[c] ?? 0))).toBe(row.cells[c]);
      }
      expect(sum(row.people.map((p) => p.total))).toBe(row.total);
    } else {
      for (let c = 0; c < width; c += 1) {
        const children = row.childIds.map((id) => grid.items.get(id)?.cells[c] ?? 0);
        expect(sum(children)).toBe(row.cells[c]);
      }
      expect(sum(row.childIds.map((id) => grid.items.get(id)?.total ?? 0))).toBe(row.total);
    }
  }
  const roots = grid.rootIds.map((id) => grid.items.get(id));
  for (let c = 0; c < width; c += 1) {
    expect(sum(roots.map((r) => r?.cells[c] ?? 0))).toBe(grid.footer.cells[c]);
  }
  expect(sum(grid.footer.cells)).toBe(grid.footer.total);
  expect(sum(roots.map((r) => r?.total ?? 0))).toBe(grid.footer.total);
}

describe('the whole seed reconciles', () => {
  for (const unit of UNITS) {
    for (const projectId of projectIds) {
      it(`${projectId} in ${unit}: every row, column and total adds up`, () => {
        const grid = buildGrid({
          items: breakdownItems.filter((i) => i.projectId === projectId),
          allocations,
          months: window,
          decimals: UNIT_DECIMALS[unit],
          valueOf: (a) => pmToUnit(a.amount, unit, contextFor(a.employeeId, a.month)),
        });
        expect(grid.items.size).toBeGreaterThan(0);
        expectReconciled(grid);
      });
    }
  }

  it('shows each project in person-months close to the exact sum of its allocations', () => {
    const itemsOf = (projectId: string) => breakdownItems.filter((i) => i.projectId === projectId);
    for (const projectId of projectIds) {
      const ids = new Set(itemsOf(projectId).map((i) => i.id));
      const exact = allocations
        .filter(
          (a) =>
            ids.has(a.breakdownItemId) &&
            window.some((m) => `${m.y}-${String(m.m).padStart(2, '0')}` === a.month),
        )
        .reduce((sum, a) => sum + a.amount, 0);
      const grid = buildGrid({
        items: itemsOf(projectId),
        allocations,
        months: window,
        decimals: 2,
        valueOf: (a) => a.amount,
      });
      // Each person row is within half a unit of exact; allow that per row.
      const rows = [...grid.items.values()].reduce((n, r) => n + r.people.length, 0);
      expect(Math.abs(grid.footer.total / 100 - exact)).toBeLessThanOrEqual(
        (rows * 0.5) / 100 + 1e-9,
      );
    }
  });
});
