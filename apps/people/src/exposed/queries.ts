import type { Employee, RateRecord } from '../domain/model';
import { available, unavailable, type Availability } from '../ports/availability';
import type { PeopleRepository } from '../ports/peopleRepository';

/**
 * What People publishes to other apps. A published contract, not internals: employees are
 * reduced to what consumers need, and rates are the raw effective-dated records.
 */
export interface PublishedEmployee {
  readonly id: string;
  readonly name: string;
  readonly weeklyHours: number;
}

export interface PublishedEmployeeQuery {
  listEmployees(): Promise<Availability<PublishedEmployee[]>>;
}

export interface PublishedRateQuery {
  getRates(employeeIds: readonly string[]): Promise<Availability<Record<string, RateRecord[]>>>;
}

const toPublished = ({ id, name, weeklyHours }: Employee): PublishedEmployee => ({
  id,
  name,
  weeklyHours,
});

/** A storage failure is reported as "unavailable", never thrown across the app boundary. */
async function guarded<T>(read: () => Promise<T>): Promise<Availability<T>> {
  try {
    return available(await read());
  } catch (error) {
    console.error('[people] query failed', error);
    return unavailable();
  }
}

export function employeeQueryFor(
  repository: () => Promise<PeopleRepository>,
): PublishedEmployeeQuery {
  return {
    listEmployees: () =>
      guarded(async () => (await (await repository()).listEmployees()).map(toPublished)),
  };
}

export function rateQueryFor(repository: () => Promise<PeopleRepository>): PublishedRateQuery {
  return {
    getRates: (employeeIds) => guarded(async () => (await repository()).getRates(employeeIds)),
  };
}
