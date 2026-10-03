/**
 * Splits the provided fixture file into the slices each app owns, and checks every
 * invariant the apps rely on. Pure: no file access, so it is unit-tested.
 */

interface RawEmployee {
  id: string;
  name: string;
  role: string;
  weeklyHours: number;
}
interface RawRateRecord {
  id: string;
  employeeId: string;
  validFrom: string;
  hourlyCost: number;
}
interface RawProject {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}
interface RawBreakdownItem {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
}
interface RawAllocation {
  id: string;
  breakdownItemId: string;
  employeeId: string;
  month: string;
  amount: number;
}

export interface RawSeed {
  employees: RawEmployee[];
  rateRecords: RawRateRecord[];
  projects: RawProject[];
  breakdownItems: RawBreakdownItem[];
  allocations: RawAllocation[];
}

const SEED_VERSION = 1;

export const EXPECTED_COUNTS = {
  employees: 60,
  rateRecords: 150,
  projects: 4,
  breakdownItems: 90,
  allocations: 720,
} as const;

const WEEKLY_HOURS = new Set([40, 32, 20]);
const MAX_DEPTH = 3;

export interface PeopleSeed {
  seedVersion: number;
  employees: RawEmployee[];
  rateRecords: RawRateRecord[];
}

export interface DeliverySeed {
  seedVersion: number;
  projects: RawProject[];
  breakdownItems: RawBreakdownItem[];
  /** seq follows file order, so "most recently edited" starts out well defined. */
  allocations: (RawAllocation & { seq: number })[];
}

/** What Delivery's standalone fixtures need from People, kept as Delivery's own copy. */
export interface DeliveryPeopleFixture {
  employees: { id: string; name: string; weeklyHours: number }[];
  rateRecords: RawRateRecord[];
}

/** What People's standalone fixtures need from Delivery. */
export type AllocationTotalsFixture = { employeeId: string; month: string; allocatedPM: number }[];

export interface SeedSlices {
  people: PeopleSeed;
  peopleAllocationTotals: AllocationTotalsFixture;
  delivery: DeliverySeed;
  deliveryPeopleFixture: DeliveryPeopleFixture;
}

class SeedInvariantError extends Error {
  constructor(message: string) {
    super(`Seed invariant violated: ${message}`);
    this.name = 'SeedInvariantError';
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new SeedInvariantError(message);
}

function uniqueIds(label: string, ids: readonly string[]): Set<string> {
  const set = new Set(ids);
  assert(set.size === ids.length, `duplicate ids in ${label}`);
  return set;
}

export function validateSeed(seed: RawSeed): void {
  for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
    const actual = seed[key as keyof typeof EXPECTED_COUNTS].length;
    assert(actual === expected, `expected ${expected} ${key}, found ${actual}`);
  }

  const employeeIds = uniqueIds(
    'employees',
    seed.employees.map((e) => e.id),
  );
  for (const e of seed.employees) {
    assert(WEEKLY_HOURS.has(e.weeklyHours), `${e.id} has weeklyHours ${e.weeklyHours}`);
  }

  uniqueIds(
    'rateRecords',
    seed.rateRecords.map((r) => r.id),
  );
  const rateKeys = new Set<string>();
  for (const r of seed.rateRecords) {
    assert(employeeIds.has(r.employeeId), `${r.id} references unknown employee ${r.employeeId}`);
    assert(Number.isFinite(r.hourlyCost) && r.hourlyCost > 0, `${r.id} has a bad hourlyCost`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(r.validFrom), `${r.id} has a bad validFrom`);
    const key = `${r.employeeId}|${r.validFrom}`;
    assert(!rateKeys.has(key), `two rates for ${r.employeeId} start on ${r.validFrom}`);
    rateKeys.add(key);
  }

  const projectIds = uniqueIds(
    'projects',
    seed.projects.map((p) => p.id),
  );

  const itemIds = uniqueIds(
    'breakdownItems',
    seed.breakdownItems.map((i) => i.id),
  );
  const itemById = new Map(seed.breakdownItems.map((i) => [i.id, i]));
  const parents = new Set<string>();
  for (const item of seed.breakdownItems) {
    assert(projectIds.has(item.projectId), `${item.id} references unknown project`);
    let depth = 1;
    for (let cursor = item; cursor.parentId !== null; depth += 1) {
      const parent = itemById.get(cursor.parentId);
      assert(parent !== undefined, `${cursor.id} references unknown parent ${cursor.parentId}`);
      assert(parent.projectId === item.projectId, `${item.id} has a parent in another project`);
      assert(depth <= MAX_DEPTH, `${item.id} is deeper than ${MAX_DEPTH} levels`);
      cursor = parent;
    }
    assert(depth <= MAX_DEPTH, `${item.id} is deeper than ${MAX_DEPTH} levels`);
    if (item.parentId !== null) parents.add(item.parentId);
  }

  uniqueIds(
    'allocations',
    seed.allocations.map((a) => a.id),
  );
  assert(
    seed.allocations.some((a) => a.id === 'alloc-001'),
    'alloc-001 (the reference calculation cell) is missing',
  );
  const cellKeys = new Set<string>();
  for (const a of seed.allocations) {
    assert(itemIds.has(a.breakdownItemId), `${a.id} references unknown item`);
    assert(employeeIds.has(a.employeeId), `${a.id} references unknown employee`);
    assert(
      !parents.has(a.breakdownItemId),
      `${a.id} sits on ${a.breakdownItemId}, which is not a leaf`,
    );
    assert(/^\d{4}-\d{2}$/.test(a.month), `${a.id} has a bad month`);
    assert(Number.isFinite(a.amount) && a.amount >= 0, `${a.id} has a bad amount`);
    const key = `${a.breakdownItemId}|${a.employeeId}|${a.month}`;
    assert(!cellKeys.has(key), `${a.id} duplicates cell ${key}`);
    cellKeys.add(key);
  }
}

export function buildSlices(seed: RawSeed): SeedSlices {
  validateSeed(seed);

  const totals = new Map<string, { employeeId: string; month: string; allocatedPM: number }>();
  for (const a of seed.allocations) {
    const key = `${a.employeeId}|${a.month}`;
    const entry = totals.get(key) ?? { employeeId: a.employeeId, month: a.month, allocatedPM: 0 };
    entry.allocatedPM += a.amount;
    totals.set(key, entry);
  }

  return {
    people: {
      seedVersion: SEED_VERSION,
      employees: seed.employees,
      rateRecords: seed.rateRecords,
    },
    peopleAllocationTotals: [...totals.values()].map((t) => ({
      ...t,
      allocatedPM: Math.round(t.allocatedPM * 1e6) / 1e6,
    })),
    delivery: {
      seedVersion: SEED_VERSION,
      projects: seed.projects,
      breakdownItems: seed.breakdownItems,
      allocations: seed.allocations.map((a, index) => ({ ...a, seq: index + 1 })),
    },
    deliveryPeopleFixture: {
      employees: seed.employees.map(({ id, name, weeklyHours }) => ({ id, name, weeklyHours })),
      rateRecords: seed.rateRecords,
    },
  };
}
