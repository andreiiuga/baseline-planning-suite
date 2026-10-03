import { parseYearMonth, type YearMonth } from './dates';
import type { PersonMonthLoad } from './capacity';
import { UNIT_DECIMALS } from './display';
import type { Allocation, BreakdownItem, Employee, Project } from './model';
import { buildRateSchedule, type RateRecord, type RateSchedule } from './rates';
import { buildGrid, type GridModel } from './rollup';
import { cellContext, pmToUnit, type CellContext, type Unit } from './units';

/** What Delivery knows about people, read through its ports. */
export interface PeopleModel {
  readonly employees: ReadonlyMap<string, Employee>;
  readonly schedules: ReadonlyMap<string, RateSchedule>;
}

export function buildPeopleModel(
  employees: readonly Employee[],
  ratesByEmployee: Readonly<Record<string, readonly RateRecord[]>>,
): PeopleModel {
  return {
    employees: new Map(employees.map((e) => [e.id, e])),
    schedules: new Map(
      employees.map((e) => [e.id, buildRateSchedule(ratesByEmployee[e.id] ?? [])]),
    ),
  };
}

/** Everything needed to convert one person's cell in one month, or null if People has no such person. */
export function contextFor(
  people: PeopleModel,
  employeeId: string,
  month: YearMonth,
): CellContext | null {
  const employee = people.employees.get(employeeId);
  const schedule = people.schedules.get(employeeId);
  if (!employee || !schedule) return null;
  return cellContext(employee.weeklyHours, month, schedule);
}

/** Person-months and percent need nothing from People; hours and cost need hours and rates. */
export function unitNeedsPeople(unit: Unit): boolean {
  return unit === 'hours' || unit === 'eur';
}

export interface Currency {
  readonly code: string;
  /** Units of this currency per 1 EUR. Amounts are stored in EUR. */
  readonly perEur: number;
}

export interface StaffingGridInput {
  readonly items: readonly BreakdownItem[];
  readonly allocations: readonly Allocation[];
  readonly months: readonly YearMonth[];
  readonly unit: Unit;
  readonly currency: Currency;
  /** Null while People is unavailable: only units that do not need it can be shown. */
  readonly people: PeopleModel | null;
}

/**
 * The numbers for one project's grid in the chosen unit. Conversion happens on exact
 * stored values first; rounding and reconciliation happen afterwards, in the rollup.
 */
export function buildStaffingGrid(input: StaffingGridInput): GridModel {
  const { unit, currency, people } = input;
  const contexts = new Map<string, CellContext | null>();
  const contextOf = (employeeId: string, month: string): CellContext | null => {
    if (!people) return null;
    const key = `${employeeId}|${month}`;
    if (!contexts.has(key))
      contexts.set(key, contextFor(people, employeeId, parseYearMonth(month)));
    return contexts.get(key) ?? null;
  };

  return buildGrid({
    items: input.items,
    allocations: input.allocations,
    months: input.months,
    decimals: UNIT_DECIMALS[unit],
    valueOf: (allocation) => {
      if (unit === 'pm') return allocation.amount;
      if (unit === 'pct') return allocation.amount * 100;
      const ctx = contextOf(allocation.employeeId, allocation.month);
      if (!ctx) return 0; // unit unavailable or person unknown: shown as zero, flagged by the UI
      const value = pmToUnit(allocation.amount, unit, ctx);
      return unit === 'eur' ? value * currency.perEur : value;
    },
  });
}

/** "Ledger migration › Design", for naming where an allocation sits. */
export function itemPath(items: readonly BreakdownItem[], itemId: string): string {
  const byId = new Map(items.map((i) => [i.id, i]));
  const names: string[] = [];
  for (
    let item = byId.get(itemId);
    item;
    item = item.parentId ? byId.get(item.parentId) : undefined
  ) {
    names.unshift(item.name);
  }
  return names.join(' › ');
}

export function describeCulprit(
  load: PersonMonthLoad,
  items: readonly BreakdownItem[],
  projects: readonly Project[],
): string {
  const culprit = load.culprit;
  if (!culprit) return 'Over capacity.';
  const item = items.find((i) => i.id === culprit.breakdownItemId);
  const project = projects.find((p) => p.id === item?.projectId);
  const where = [project?.name, itemPath(items, culprit.breakdownItemId)]
    .filter(Boolean)
    .join(' › ');
  return `${load.totalPm.toFixed(2)} person-months allocated, over capacity. Most recently edited: ${where}.`;
}
