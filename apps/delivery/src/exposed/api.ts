/**
 * Exposed to other apps as `delivery/api`: adapters only, no UI. The shell loads this module
 * eagerly, builds the adapter once, and hands it to People.
 */
import { getPlanRepository } from '../adapters/idb/sharedRepository';
import { allocationTotalsFor, type PublishedAllocationTotals } from './totals';

export type { PublishedAllocationTotals, PublishedMonthlyTotal } from './totals';

export function createAllocationTotals(): PublishedAllocationTotals {
  return allocationTotalsFor(getPlanRepository);
}
