import { formatYearMonth, type YearMonth } from './dates';
import { apportion } from './rounding';
import type { Allocation, BreakdownItem } from './model';

/**
 * Builds the numbers shown in the staffing grid, as scaled integers.
 *
 * Rounding rules, so that everything on screen adds up:
 * - A person row (one person on one leaf) is the authority: its months are apportioned by
 *   largest remainder, so the row total is the exact sum rounded once.
 * - Leaf rows, parent rows and the footer are plain integer sums of the displayed values
 *   below them, so every identity holds by construction.
 *
 * Cost of this: a parent total can differ from the nearest-rounded exact value by a few
 * units in the last place. In a two-dimensional grid rows and columns cannot generally both
 * match the exact rounded values, so visible reconciliation wins.
 */

export interface PersonLine {
  readonly employeeId: string;
  /** One scaled integer per month in the window. */
  readonly cells: readonly number[];
  readonly total: number;
}

export interface ItemRollup {
  readonly itemId: string;
  readonly childIds: readonly string[];
  /** Empty for parents: they are derived and read-only. */
  readonly people: readonly PersonLine[];
  readonly cells: readonly number[];
  readonly total: number;
}

export interface GridModel {
  readonly months: readonly YearMonth[];
  readonly rootIds: readonly string[];
  readonly items: ReadonlyMap<string, ItemRollup>;
  readonly footer: { readonly cells: readonly number[]; readonly total: number };
}

export interface GridInput {
  /** The items of one project. */
  readonly items: readonly BreakdownItem[];
  readonly allocations: readonly Allocation[];
  readonly months: readonly YearMonth[];
  readonly decimals: number;
  /** An allocation's value in the display unit, exact (not rounded). */
  readonly valueOf: (allocation: Allocation) => number;
}

const sumColumns = (rows: readonly (readonly number[])[], width: number): number[] =>
  Array.from({ length: width }, (_, column) =>
    rows.reduce((sum, row) => sum + (row[column] ?? 0), 0),
  );

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

export function buildGrid(input: GridInput): GridModel {
  const { items, allocations, months, decimals, valueOf } = input;
  const monthIndex = new Map(months.map((month, i) => [formatYearMonth(month), i]));

  const childIds = new Map<string | null, string[]>();
  for (const item of items) {
    const siblings = childIds.get(item.parentId);
    if (siblings) siblings.push(item.id);
    else childIds.set(item.parentId, [item.id]);
  }

  const itemIds = new Set(items.map((item) => item.id));
  const exactByItem = new Map<string, Map<string, number[]>>();
  for (const allocation of allocations) {
    if (!itemIds.has(allocation.breakdownItemId)) continue; // belongs to another project
    if (childIds.has(allocation.breakdownItemId)) {
      throw new Error(
        `Allocation ${allocation.id} sits on ${allocation.breakdownItemId}, which is not a leaf`,
      );
    }
    const column = monthIndex.get(allocation.month);
    if (column === undefined) continue; // outside the visible window
    const people = exactByItem.get(allocation.breakdownItemId) ?? new Map<string, number[]>();
    const exact = people.get(allocation.employeeId) ?? new Array<number>(months.length).fill(0);
    exact[column] = (exact[column] ?? 0) + valueOf(allocation);
    people.set(allocation.employeeId, exact);
    exactByItem.set(allocation.breakdownItemId, people);
  }

  const rollups = new Map<string, ItemRollup>();
  const visit = (itemId: string): ItemRollup => {
    const children = childIds.get(itemId) ?? [];
    let people: PersonLine[] = [];
    let cells: number[];
    if (children.length === 0) {
      const byPerson = exactByItem.get(itemId) ?? new Map<string, number[]>();
      people = [...byPerson.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([employeeId, exact]) => {
          const apportioned = apportion(exact, decimals);
          return { employeeId, cells: apportioned.cells, total: apportioned.total };
        });
      cells = sumColumns(
        people.map((p) => p.cells),
        months.length,
      );
    } else {
      cells = sumColumns(
        children.map((childId) => visit(childId).cells),
        months.length,
      );
    }
    const rollup: ItemRollup = { itemId, childIds: children, people, cells, total: sum(cells) };
    rollups.set(itemId, rollup);
    return rollup;
  };

  const rootIds = childIds.get(null) ?? [];
  const roots = rootIds.map(visit);
  if (rollups.size !== items.length) {
    throw new Error('Breakdown items form a cycle or reference a missing parent');
  }
  const footerCells = sumColumns(
    roots.map((r) => r.cells),
    months.length,
  );
  return {
    months,
    rootIds,
    items: rollups,
    footer: { cells: footerCells, total: sum(footerCells) },
  };
}
