import type { RateRecord } from '../domain/model';

/** Guards a whole-history replacement: every record must belong to the employee being written. */
export function assertOwnedBy(employeeId: string, records: readonly RateRecord[]): void {
  const stray = records.find((r) => r.employeeId !== employeeId);
  if (stray) {
    throw new RangeError(`Rate ${stray.id} belongs to ${stray.employeeId}, not ${employeeId}`);
  }
}
