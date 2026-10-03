import type { Employee } from '../domain/model';
import type { RateRecord } from '../domain/rates';
import { available } from '../ports/availability';
import type { EmployeeQuery, RateQuery } from '../ports/peopleQueries';

export interface PeopleFixture {
  readonly employees: readonly Employee[];
  readonly rateRecords: readonly RateRecord[];
}

/** Standalone mode: Delivery's own copy of the people data, so it runs without People. */
export function createFixtureEmployeeQuery(fixture: PeopleFixture): EmployeeQuery {
  return {
    listEmployees: () => Promise.resolve(available(structuredClone([...fixture.employees]))),
  };
}

export function createFixtureRateQuery(fixture: PeopleFixture): RateQuery {
  return {
    getRates: (employeeIds) =>
      Promise.resolve(
        available(
          Object.fromEntries(
            employeeIds.map((id) => [
              id,
              structuredClone(fixture.rateRecords.filter((r) => r.employeeId === id)),
            ]),
          ),
        ),
      ),
  };
}
