import type { Allocation } from './model';

/** One person-month of capacity, in person-months. */
export const CAPACITY_PM = 1;

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
    const culprit = group
      .filter((a) => a.amount > 0)
      .reduce<Allocation | null>((latest, a) => (!latest || a.seq > latest.seq ? a : latest), null);
    loads.push({
      employeeId: first.employeeId,
      month: first.month,
      totalPm,
      over: isOverCapacity(totalPm),
      culprit,
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
