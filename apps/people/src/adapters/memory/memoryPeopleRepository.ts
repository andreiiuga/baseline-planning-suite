import { sortedHistory } from '../../domain/rateHistory';
import type { Employee, RateRecord } from '../../domain/model';
import type { PeopleRepository } from '../../ports/peopleRepository';
import { assertOwnedBy } from '../assertOwnedBy';
import type { PeopleSeed } from '../seed/types';

export function createMemoryPeopleRepository(seed: PeopleSeed): PeopleRepository {
  let employees: Employee[] = structuredClone([...seed.employees]);
  let rates: RateRecord[] = structuredClone([...seed.rateRecords]);

  return {
    listEmployees: () => Promise.resolve(structuredClone(employees)),

    getRates: (employeeIds) =>
      Promise.resolve(
        Object.fromEntries(
          employeeIds.map((id) => [
            id,
            structuredClone(sortedHistory(rates.filter((r) => r.employeeId === id))),
          ]),
        ),
      ),

    // async so a guard failure is a rejected promise, as in every other adapter
    async replaceRates(employeeId, records) {
      assertOwnedBy(employeeId, records);
      rates = [
        ...rates.filter((r) => r.employeeId !== employeeId),
        ...structuredClone([...records]),
      ];
    },

    reset() {
      employees = structuredClone([...seed.employees]);
      rates = structuredClone([...seed.rateRecords]);
      return Promise.resolve();
    },
  };
}
