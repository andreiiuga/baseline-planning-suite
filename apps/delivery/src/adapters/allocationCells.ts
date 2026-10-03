import type { Allocation } from '../domain/model';
import type { AllocationCell } from '../ports/planRepository';

export const sameCell = (a: Allocation, cell: AllocationCell): boolean =>
  a.breakdownItemId === cell.breakdownItemId &&
  a.employeeId === cell.employeeId &&
  a.month === cell.month;

/** seq is unique and increasing, and above every seeded number, so ids cannot collide. */
export const newAllocationId = (seq: number): string => `alloc-${seq}`;

export function assertValidAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`Allocation amount must be a finite, non-negative number, got ${amount}`);
  }
}
