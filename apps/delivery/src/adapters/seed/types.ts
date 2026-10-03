import type { Allocation, BreakdownItem, Project } from '../../domain/model';

export interface DeliverySeed {
  readonly seedVersion: number;
  readonly projects: readonly Project[];
  readonly breakdownItems: readonly BreakdownItem[];
  readonly allocations: readonly Allocation[];
}
