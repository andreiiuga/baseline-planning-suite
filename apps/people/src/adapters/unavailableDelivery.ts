import { unavailable } from '../ports/availability';
import type { AllocationTotals } from '../ports/allocationTotals';

/** Null object used when Delivery failed to load: capacity answers "unavailable". */
export const unavailableAllocationTotals: AllocationTotals = {
  getMonthlyTotals: () => Promise.resolve(unavailable()),
};
