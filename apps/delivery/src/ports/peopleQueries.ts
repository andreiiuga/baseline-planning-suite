import type { Employee } from '../domain/model';
import type { RateRecord } from '../domain/rates';
import type { Availability } from './availability';

/**
 * What Delivery needs from People. Declared here, by the consumer: People only has to
 * satisfy the shape and never imports this file. The contract suites in tests/contracts pin
 * the behaviour, including the rule that validFrom is inclusive and the last rate is open.
 */
export interface EmployeeQuery {
  listEmployees(): Promise<Availability<Employee[]>>;
}

export interface RateQuery {
  /** One entry per requested id; an employee with no rates maps to []. Order is not promised. */
  getRates(employeeIds: readonly string[]): Promise<Availability<Record<string, RateRecord[]>>>;
}
