import type { Allocation } from './model';

/** One person-month of capacity, in person-months. */
const CAPACITY_PM = 1;

/** Floating-point allowance for sums of decimals such as 0.1 + 0.7 + 0.2. Not a rounding budget. */
const EPSILON = 1e-9;

export function isOverCapacity(totalPm: number): boolean {
  return totalPm > CAPACITY_PM + EPSILON;
}

export interface PersonMonthLoad {
  readonly employeeId: string;
  readonly month: string;
  /** Sum across every project, including ones nobody has open. */
  readonly totalPm: number;
  readonly over: boolean;
  /** The most recently edited non-zero allocation contributing to this person-month. */
  readonly culprit: Allocation | null;
  /** Every non-zero allocation that makes up the total, most recently edited first. */
  readonly contributors: readonly Allocation[];
}

/** How far above capacity a person-month is, in person-months. Zero when within capacity. */
export function excessPm(load: Pick<PersonMonthLoad, 'totalPm' | 'over'>): number {
  return load.over ? load.totalPm - CAPACITY_PM : 0;
}

/**
 * The amount an allocation would have to drop to so that, with nothing else changed, the
 * person-month fits capacity. Never below zero: if the allocation alone cannot absorb the
 * excess, the rest has to come from somewhere else.
 */
export function amountThatFits(
  allocation: Pick<Allocation, 'amount'>,
  load: Pick<PersonMonthLoad, 'totalPm' | 'over'>,
): number {
  return Math.max(0, allocation.amount - excessPm(load));
}

export interface CapacityIndex {
  /** Undefined when the person has no allocation in that month. */
  readonly get: (employeeId: string, month: string) => PersonMonthLoad | undefined;
  readonly overCapacity: () => readonly PersonMonthLoad[];
}

const keyOf = (employeeId: string, month: string): string => `${employeeId}|${month}`;

/** One entry per person-month that has at least one allocation. All projects together. */
export function monthlyLoads(allocations: readonly Allocation[]): PersonMonthLoad[] {
  const groups = new Map<string, Allocation[]>();
  for (const allocation of allocations) {
    const key = keyOf(allocation.employeeId, allocation.month);
    const group = groups.get(key);
    if (group) group.push(allocation);
    else groups.set(key, [allocation]);
  }

  const loads: PersonMonthLoad[] = [];
  for (const group of groups.values()) {
    const [first] = group;
    if (!first) continue;
    const totalPm = group.reduce((sum, a) => sum + a.amount, 0);
    const contributors = group.filter((a) => a.amount > 0).sort((a, b) => b.seq - a.seq);
    loads.push({
      employeeId: first.employeeId,
      month: first.month,
      totalPm,
      over: isOverCapacity(totalPm),
      culprit: contributors[0] ?? null,
      contributors,
    });
  }
  return loads;
}

/** Allocations for all projects, not only the one on screen. */
export function buildCapacityIndex(allocations: readonly Allocation[]): CapacityIndex {
  const loads = new Map(
    monthlyLoads(allocations).map((load) => [keyOf(load.employeeId, load.month), load]),
  );
  return {
    get: (employeeId, month) => loads.get(keyOf(employeeId, month)),
    overCapacity: () => [...loads.values()].filter((load) => load.over),
  };
}
