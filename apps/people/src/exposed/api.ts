/**
 * Exposed to other apps as `people/api`: adapters only, no UI. The shell loads this module
 * eagerly, builds the adapters once, and hands them to Delivery.
 */
import { getPeopleRepository } from '../adapters/idb/sharedRepository';
import {
  employeeQueryFor,
  rateQueryFor,
  type PublishedEmployeeQuery,
  type PublishedRateQuery,
} from './queries';

export type { PublishedEmployee, PublishedEmployeeQuery, PublishedRateQuery } from './queries';

export function createEmployeeQuery(): PublishedEmployeeQuery {
  return employeeQueryFor(getPeopleRepository);
}

export function createRateQuery(): PublishedRateQuery {
  return rateQueryFor(getPeopleRepository);
}
