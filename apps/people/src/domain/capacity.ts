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
