/** Delivery's own view of its data. Employees and rates come from People through ports. */

export interface Employee {
  readonly id: string;
  readonly name: string;
  readonly weeklyHours: number;
}

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
}

export interface BreakdownItem {
  readonly id: string;
  readonly projectId: string;
  /** null at the root. */
  readonly parentId: string | null;
  readonly name: string;
}

export interface Allocation {
  readonly id: string;
  /** Always a leaf: parents are derived. */
  readonly breakdownItemId: string;
  readonly employeeId: string;
  /** YYYY-MM */
  readonly month: string;
  /** Person-months, the one canonical unit. */
  readonly amount: number;
  /**
   * Monotonic edit counter. The allocation with the highest seq in a person-month is the
   * most recently edited one. Moving an allocation does not change it.
   */
  readonly seq: number;
}
