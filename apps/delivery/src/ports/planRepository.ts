import type { TreeState } from '../domain/breakdown';
import type { Allocation, BreakdownItem, Project } from '../domain/model';

export interface PlanSnapshot {
  readonly projects: readonly Project[];
  readonly items: readonly BreakdownItem[];
  /** Every project's allocations: capacity is counted across all of them. */
  readonly allocations: readonly Allocation[];
}

export interface AllocationCell {
  readonly breakdownItemId: string;
  readonly employeeId: string;
  /** YYYY-MM */
  readonly month: string;
}

/** Delivery's own persistence port. Nothing else may open this app's database. */
export interface PlanRepository {
  load(): Promise<PlanSnapshot>;

  /**
   * Persists the result of a tree operation (items and the allocations that moved or went
   * with them) atomically. Allocation amounts and seq are not changed by this call.
   */
  saveTree(next: TreeState): Promise<void>;

  /**
   * Sets one cell, creating the allocation if the cell had none, and stamps it with the next
   * seq so it counts as the most recently edited. Returns the stored allocation.
   */
  setAllocationAmount(cell: AllocationCell, amount: number): Promise<Allocation>;

  /** Allocations of the given people across every project (uses the employee+month index). */
  listAllocationsForEmployees(employeeIds: readonly string[]): Promise<Allocation[]>;

  /** Restores the seed data. */
  reset(): Promise<void>;
}
