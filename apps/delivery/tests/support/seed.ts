import { buildRateSchedule, type RateRecord, type RateSchedule } from '../../src/domain/rates';
import { cellContext, type CellContext } from '../../src/domain/units';
import { parseYearMonth } from '../../src/domain/dates';
import type { Allocation, BreakdownItem, Employee } from '../../src/domain/model';
import seed from '../../../../docs/baseline-seed.json';

export const employees: readonly Employee[] = seed.employees.map((e) => ({
  id: e.id,
  name: e.name,
  weeklyHours: e.weeklyHours,
}));

/** seq follows file order, as the seed script will assign it. */
export const allocations: readonly Allocation[] = seed.allocations.map((a, index) => ({
  ...a,
  seq: index + 1,
}));

export const breakdownItems: readonly BreakdownItem[] = seed.breakdownItems;

export const projectIds: readonly string[] = seed.projects.map((p) => p.id);

export const rateRecords: readonly RateRecord[] = seed.rateRecords;

const schedules = new Map<string, RateSchedule>();
for (const employee of employees) {
  schedules.set(
    employee.id,
    buildRateSchedule(rateRecords.filter((r) => r.employeeId === employee.id)),
  );
}
const employeeById = new Map(employees.map((e) => [e.id, e]));

export function contextFor(employeeId: string, month: string): CellContext {
  const employee = employeeById.get(employeeId);
  const schedule = schedules.get(employeeId);
  if (!employee || !schedule) throw new Error(`Unknown employee ${employeeId}`);
  return cellContext(employee.weeklyHours, parseYearMonth(month), schedule);
}
