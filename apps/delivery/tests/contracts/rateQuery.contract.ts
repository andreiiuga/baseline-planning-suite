/**
 * Delivery's expectations of whatever answers `RateQuery`. Written once as a function over
 * the port: Delivery runs it against its own fixture adapter, and the integration suite runs
 * it against People's real adapter. If People's output drifts, this is what fails.
 */
import { describe, expect, it } from 'vitest';
import { formatIsoDate, parseIsoDate, parseYearMonth } from '../../src/domain/dates';
import { buildRateSchedule, sliceMonth, type RateRecord } from '../../src/domain/rates';
import type { RateQuery } from '../../src/ports/peopleQueries';

export function runRateQueryContract(label: string, create: () => Promise<RateQuery>): void {
  async function ratesFor(...ids: string[]): Promise<Record<string, RateRecord[]>> {
    const result = await (await create()).getRates(ids);
    if (result.status !== 'ok') throw new Error('expected an available RateQuery');
    return result.data;
  }

  describe(`RateQuery contract (${label})`, () => {
    it('answers with one entry per requested employee', async () => {
      const rates = await ratesFor('emp-001', 'emp-002');
      expect(Object.keys(rates).sort()).toEqual(['emp-001', 'emp-002']);
    });

    it('maps an unknown employee to an empty list instead of failing', async () => {
      expect(await ratesFor('ghost')).toEqual({ ghost: [] });
    });

    it('answers an empty request with an empty result', async () => {
      expect(await ratesFor()).toEqual({});
    });

    it('returns well-formed records that belong to the key they sit under', async () => {
      const rates = await ratesFor('emp-001', 'emp-007');
      for (const [employeeId, records] of Object.entries(rates)) {
        expect(records.length).toBeGreaterThan(0);
        for (const record of records) {
          expect(typeof record.id).toBe('string');
          expect(record.employeeId).toBe(employeeId);
          expect(formatIsoDate(parseIsoDate(record.validFrom))).toBe(record.validFrom);
          expect(Number.isFinite(record.hourlyCost)).toBe(true);
          expect(record.hourlyCost).toBeGreaterThan(0);
        }
      }
    });

    it('exposes A. Okafor rates of EUR 80 from 2025-01-01 and EUR 95 from 2026-03-12', async () => {
      const records = (await ratesFor('emp-001'))['emp-001'] ?? [];
      expect(
        records
          .map((r) => [r.validFrom, r.hourlyCost])
          .sort(([a], [b]) => String(a).localeCompare(String(b))),
      ).toEqual([
        ['2025-01-01', 80],
        ['2026-03-12', 95],
      ]);
    });

    describe('what Delivery relies on when it prices a month from these records', () => {
      it('validFrom is inclusive: 12 March is priced at the new rate (8 days old, 14 days new)', async () => {
        const schedule = buildRateSchedule((await ratesFor('emp-001'))['emp-001'] ?? []);
        const { slices, coverage } = sliceMonth(schedule, parseYearMonth('2026-03'));
        expect(coverage).toBe('full');
        expect(slices.map((s) => [s.workingDays, s.hourlyCost])).toEqual([
          [8, 80],
          [14, 95],
        ]);
      });

      it('the last rate is open-ended: it still applies a year later', async () => {
        const schedule = buildRateSchedule((await ratesFor('emp-001'))['emp-001'] ?? []);
        const { slices } = sliceMonth(schedule, parseYearMonth('2027-03'));
        expect(slices.map((s) => s.hourlyCost)).toEqual([95]);
      });
    });
  });
}
