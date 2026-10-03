/**
 * Compile-time checks that what each remote publishes fits the shell's (opaque) port shapes,
 * so the shell can forward it. The reverse direction is deliberately not checked: the shell
 * never looks inside payloads, which is why consumer-owned contract suites exist.
 */
import { describe, expect, it } from 'vitest';
import { allocationTotalsFor } from '../../apps/delivery/src/exposed/totals';
import { employeeQueryFor, rateQueryFor } from '../../apps/people/src/exposed/queries';
import type {
  AllocationTotalsPort,
  EmployeeQueryPort,
  RateQueryPort,
} from '../../apps/shell/src/contracts';

describe('published adapters fit the shell ports', () => {
  it('compiles', () => {
    const never = () => Promise.reject(new Error('unused'));
    const employees: EmployeeQueryPort = employeeQueryFor(never);
    const rates: RateQueryPort = rateQueryFor(never);
    const totals: AllocationTotalsPort = allocationTotalsFor(never);
    expect([employees, rates, totals]).toHaveLength(3);
  });
});
