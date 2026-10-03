import type {
  AllocationTotalsPort,
  DeliveryApi,
  EmployeeQueryPort,
  PeopleApi,
  RateQueryPort,
} from './contracts';

/** The ports the shell hands to the remotes. Null means the providing app did not load. */
export interface Ports {
  readonly employeeQuery: EmployeeQueryPort | null;
  readonly rateQuery: RateQueryPort | null;
  readonly allocationTotals: AllocationTotalsPort | null;
}

/**
 * The composition root: turns whichever `api` modules loaded into the ports each remote
 * needs. The shell wires once; afterwards the apps talk to each other's adapters directly
 * and the shell is not in the data path.
 */
export function composePorts(people: PeopleApi | null, delivery: DeliveryApi | null): Ports {
  return {
    employeeQuery: people?.createEmployeeQuery() ?? null,
    rateQuery: people?.createRateQuery() ?? null,
    allocationTotals: delivery?.createAllocationTotals() ?? null,
  };
}
