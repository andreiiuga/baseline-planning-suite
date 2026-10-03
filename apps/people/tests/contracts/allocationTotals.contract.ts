/**
 * People's expectations of whatever answers `AllocationTotals`. Written once as a function
 * over the port: People runs it against its own fixture adapter, and the integration suite
 * runs it against Delivery's real adapter.
 */
import { describe, expect, it } from 'vitest';
import { isOversubscribed } from '../../src/domain/capacity';
import type { AllocationTotals, MonthlyTotal } from '../../src/ports/allocationTotals';

export function runAllocationTotalsContract(
  label: string,
  create: () => Promise<AllocationTotals>,
): void {
  async function totalsFor(...ids: string[]): Promise<MonthlyTotal[]> {
    const result = await (await create()).getMonthlyTotals(ids);
    if (result.status !== 'ok') throw new Error('expected available AllocationTotals');
    return result.data;
  }

  describe(`AllocationTotals contract (${label})`, () => {
    it('answers an empty request with an empty list', async () => {
      expect(await totalsFor()).toEqual([]);
    });

    it('returns nothing for an unknown employee', async () => {
      expect(await totalsFor('ghost')).toEqual([]);
    });

    it('returns only the requested employees', async () => {
      const totals = await totalsFor('emp-003');
      expect(totals.length).toBeGreaterThan(0);
      expect(new Set(totals.map((t) => t.employeeId))).toEqual(new Set(['emp-003']));
    });

    it('returns well-formed entries, one per person and month', async () => {
      const totals = await totalsFor('emp-003', 'emp-001');
      const keys = totals.map((t) => `${t.employeeId}|${t.month}`);
      expect(new Set(keys).size).toBe(keys.length);
      for (const total of totals) {
        expect(total.month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
        expect(Number.isFinite(total.allocatedPM)).toBe(true);
        expect(total.allocatedPM).toBeGreaterThanOrEqual(0);
      }
    });

    it('sums across projects: Milan Brandt carries 1.18 person-months in June 2026', async () => {
      const june = (await totalsFor('emp-003')).find((t) => t.month === '2026-06');
      expect(june?.allocatedPM).toBeCloseTo(1.18, 9);
    });

    it('lets People call that month oversubscribed, and a normal month not', async () => {
      const totals = await totalsFor('emp-003');
      const june = totals.find((t) => t.month === '2026-06');
      expect(june && isOversubscribed(june.allocatedPM)).toBe(true);
      const calm = totals.filter((t) => t.month !== '2026-06');
      expect(calm.some((t) => isOversubscribed(t.allocatedPM))).toBe(false);
    });

    it('batches several people in one call', async () => {
      const totals = await totalsFor('emp-001', 'emp-003', 'emp-023');
      expect(new Set(totals.map((t) => t.employeeId))).toEqual(
        new Set(['emp-001', 'emp-003', 'emp-023']),
      );
    });
  });
}
