import { monthlyLoads } from '../domain/capacity';
import { available, unavailable, type Availability } from '../ports/availability';
import type { PlanRepository } from '../ports/planRepository';

/**
 * What Delivery publishes to other apps: how much of each person's month is allocated,
 * across every project. A published contract, not internals.
 */
export interface PublishedMonthlyTotal {
  readonly employeeId: string;
  readonly month: string;
  readonly allocatedPM: number;
}

export interface PublishedAllocationTotals {
  getMonthlyTotals(employeeIds: readonly string[]): Promise<Availability<PublishedMonthlyTotal[]>>;
}

export function allocationTotalsFor(
  repository: () => Promise<PlanRepository>,
): PublishedAllocationTotals {
  return {
    async getMonthlyTotals(employeeIds) {
      try {
        const allocations = await (await repository()).listAllocationsForEmployees(employeeIds);
        const data = monthlyLoads(allocations).map(({ employeeId, month, totalPm }) => ({
          employeeId,
          month,
          allocatedPM: totalPm,
        }));
        return available(data);
      } catch (error) {
        console.error('[delivery] allocation totals failed', error);
        return unavailable();
      }
    },
  };
}
