import type { DeliveryEventBus } from './ports/eventBus';
import type { EmployeeQuery, RateQuery } from './ports/peopleQueries';

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

/** What the shell (or the standalone entry) injects into Delivery's App. */
export interface DeliveryAppProps {
  /** Null when People failed to load: Delivery then reports cost data as unavailable. */
  readonly employeeQuery: EmployeeQuery | null;
  readonly rateQuery: RateQuery | null;
  readonly bus: DeliveryEventBus;
  readonly currency: Currency;
  readonly activeUser: ActiveUser;
}
