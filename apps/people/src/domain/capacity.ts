/** One person-month of capacity, in person-months. */
export const CAPACITY_PM = 1;

/** Floating-point allowance for sums of decimals such as 0.1 + 0.7 + 0.2. Not a rounding budget. */
const EPSILON = 1e-9;

/**
 * People shows a person as oversubscribed when a month's total exceeds capacity. Delivery
 * applies the same threshold on its side; an integration test keeps the two in agreement.
 */
export function isOversubscribed(totalPm: number): boolean {
  return totalPm > CAPACITY_PM + EPSILON;
}

export interface MonthTotal {
  readonly employeeId: string;
  /** YYYY-MM */
  readonly month: string;
  readonly allocatedPM: number;
}

/** For each person, the months (sorted) in which they are allocated beyond capacity. */
export function oversubscribedMonths(totals: readonly MonthTotal[]): Map<string, string[]> {
  const byEmployee = new Map<string, string[]>();
  for (const total of totals) {
    if (!isOversubscribed(total.allocatedPM)) continue;
    const months = byEmployee.get(total.employeeId) ?? [];
    months.push(total.month);
    byEmployee.set(total.employeeId, months);
  }
  for (const months of byEmployee.values()) months.sort();
  return byEmployee;
}
