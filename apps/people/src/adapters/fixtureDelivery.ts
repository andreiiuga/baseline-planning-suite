import { available } from '../ports/availability';
import type { AllocationTotals, MonthlyTotal } from '../ports/allocationTotals';

/** Standalone mode: People's own copy of the totals, so it runs without Delivery. */
export function createFixtureAllocationTotals(fixture: readonly MonthlyTotal[]): AllocationTotals {
  return {
    getMonthlyTotals: (employeeIds) =>
      Promise.resolve(
        available(structuredClone(fixture.filter((t) => employeeIds.includes(t.employeeId)))),
      ),
  };
}
