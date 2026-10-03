/**
 * The shell's view of what it forwards between the remotes. The shell is the integrator, not
 * a participant: it never looks inside a payload, so results are `unknown` here and each
 * remote validates and types them against its own consumer-owned port.
 */
import type { EventBus } from './bus/eventBus';

export type PortAvailability =
  { readonly status: 'ok'; readonly data: unknown } | { readonly status: 'unavailable' };

export interface EmployeeQueryPort {
  listEmployees(): Promise<PortAvailability>;
}
export interface RateQueryPort {
  getRates(employeeIds: readonly string[]): Promise<PortAvailability>;
}
export interface AllocationTotalsPort {
  getMonthlyTotals(employeeIds: readonly string[]): Promise<PortAvailability>;
}

/** What `people/api` and `delivery/api` export. */
export interface PeopleApi {
  createEmployeeQuery(): EmployeeQueryPort;
  createRateQuery(): RateQueryPort;
}
export interface DeliveryApi {
  createAllocationTotals(): AllocationTotalsPort;
}

/** Shown to the remotes as plain data; they re-render when the shell changes it. */
export interface Currency {
  readonly code: string;
  /** Units of this currency per 1 EUR. Amounts are stored in EUR. */
  readonly perEur: number;
}

export interface ActiveUser {
  readonly id: string;
  readonly name: string;
}

/**
 * Props the shell injects into each remote's `App`. A port is null when the app that
 * provides it failed to load; the receiving app then falls back to its own null object.
 */
export interface PeopleAppProps {
  readonly allocationTotals: AllocationTotalsPort | null;
  readonly bus: EventBus;
  readonly currency: Currency;
  readonly activeUser: ActiveUser;
}

export interface DeliveryAppProps {
  readonly employeeQuery: EmployeeQueryPort | null;
  readonly rateQuery: RateQueryPort | null;
  readonly bus: EventBus;
  readonly currency: Currency;
  readonly activeUser: ActiveUser;
}
