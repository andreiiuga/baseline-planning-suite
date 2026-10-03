import type { Availability } from './availability';

export interface MonthlyTotal {
  readonly employeeId: string;
  /** YYYY-MM */
  readonly month: string;
  /** Person-months allocated to this person that month, summed across every project. */
  readonly allocatedPM: number;
}

/**
 * What People needs from Delivery to show who is oversubscribed. Declared here, by the
 * consumer: Delivery only has to satisfy the shape and never imports this file.
 */
export interface AllocationTotals {
  /** Only entries for the requested employees, and only for months that have an allocation. */
  getMonthlyTotals(employeeIds: readonly string[]): Promise<Availability<MonthlyTotal[]>>;
}
