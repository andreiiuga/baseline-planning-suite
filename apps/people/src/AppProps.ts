import type { AllocationTotals } from './ports/allocationTotals';
import type { PeopleEventBus } from './ports/eventBus';

/** Shown in the shell's header and pushed in as plain data: re-renders follow normally. */
export interface Currency {
  readonly code: string;
  /** Units of this currency per 1 EUR. Amounts are stored in EUR. */
  readonly perEur: number;
}

export interface ActiveUser {
  readonly id: string;
  readonly name: string;
}

/** What the shell (or the standalone entry) injects into People's App. */
export interface PeopleAppProps {
  /** Null when Delivery failed to load: People then reports capacity as unavailable. */
  readonly allocationTotals: AllocationTotals | null;
  readonly bus: PeopleEventBus;
  readonly currency: Currency;
  readonly activeUser: ActiveUser;
}
