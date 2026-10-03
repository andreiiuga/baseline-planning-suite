import { unavailable } from '../ports/availability';
import type { EmployeeQuery, RateQuery } from '../ports/peopleQueries';

/** Null object used when People failed to load: every question answers "unavailable". */
export const unavailableEmployeeQuery: EmployeeQuery = {
  listEmployees: () => Promise.resolve(unavailable()),
};

export const unavailableRateQuery: RateQuery = {
  getRates: () => Promise.resolve(unavailable()),
};
