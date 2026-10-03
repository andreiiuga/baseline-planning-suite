import type { Employee, RateRecord } from '../domain/model';

/** People's own persistence port. Nothing else may open this app's database. */
export interface PeopleRepository {
  listEmployees(): Promise<Employee[]>;
  /** Rate history per requested employee, each sorted by validFrom. Unknown ids map to []. */
  getRates(employeeIds: readonly string[]): Promise<Record<string, RateRecord[]>>;
  /** Replaces one employee's whole history atomically. */
  replaceRates(employeeId: string, records: readonly RateRecord[]): Promise<void>;
  /** Restores the seed data. */
  reset(): Promise<void>;
}
