import { describe, expect, it } from 'vitest';
import {
  compareDates,
  formatIsoDate,
  monthRange,
  parseYearMonth,
  workingDaysInMonth,
} from '../../src/domain/dates';
import { buildRateSchedule, sliceMonth, type RateRecord } from '../../src/domain/rates';
import seed from '../../../../docs/baseline-seed.json';

const month = parseYearMonth;
const rate = (validFrom: string, hourlyCost: number, id = `r-${validFrom}`): RateRecord => ({
  id,
  employeeId: 'emp-x',
  validFrom,
  hourlyCost,
});
const seedRates = (employeeId: string): RateRecord[] =>
  seed.rateRecords.filter((r) => r.employeeId === employeeId);

/** Compact view of slices for assertions. */
const view = (records: RateRecord[], ym: string) => {
  const result = sliceMonth(buildRateSchedule(records), month(ym));
  return {
    coverage: result.coverage,
    slices: result.slices.map((s) => ({
      from: formatIsoDate(s.from),
      to: formatIsoDate(s.to),
      days: s.workingDays,
      rate: s.hourlyCost,
    })),
  };
};

describe('sliceMonth with seed data', () => {
  it('splits emp-001 March 2026 into 8 days at EUR 80 and 14 days at EUR 95', () => {
    expect(view(seedRates('emp-001'), '2026-03')).toEqual({
      coverage: 'full',
      slices: [
        { from: '2026-03-01', to: '2026-03-12', days: 8, rate: 80 },
        { from: '2026-03-12', to: '2026-04-01', days: 14, rate: 95 },
      ],
    });
  });

  it('splits emp-007 May 2026 around the rate on the 14th', () => {
    expect(view(seedRates('emp-007'), '2026-05')).toEqual({
      coverage: 'full',
      slices: [
        { from: '2026-05-01', to: '2026-05-14', days: 9, rate: 125 },
        { from: '2026-05-14', to: '2026-06-01', days: 12, rate: 122 },
      ],
    });
  });

  it('splits emp-053 in the last month of the horizon', () => {
    const { slices } = view(seedRates('emp-053'), '2027-03');
    expect(slices.map((s) => s.days)).toEqual([7, 16]);
  });

  it('prices a month with no change as one full slice', () => {
    const { coverage, slices } = view(seedRates('emp-001'), '2026-04');
    expect(coverage).toBe('full');
    expect(slices).toHaveLength(1);
    expect(slices[0]?.rate).toBe(95);
  });
});

describe('sliceMonth edge cases', () => {
  it('treats validFrom as inclusive: the day itself is priced at the new rate', () => {
    const { slices } = view([rate('2026-01-01', 10), rate('2026-03-12', 20)], '2026-03');
    expect(slices[1]?.from).toBe('2026-03-12');
    expect(slices[1]?.rate).toBe(20);
  });

  it('lets a rate that starts exactly on the 1st cover the whole month alone', () => {
    const result = view([rate('2026-01-01', 10), rate('2026-03-01', 20)], '2026-03');
    expect(result.slices).toHaveLength(1);
    expect(result.slices[0]).toMatchObject({ rate: 20, days: 22 });
    expect(result.coverage).toBe('full');
  });

  it('yields more than two slices when several changes fall in one month', () => {
    const records = [
      rate('2026-01-01', 10),
      rate('2026-03-03', 20),
      rate('2026-03-12', 30),
      rate('2026-03-20', 40),
    ];
    const { slices, coverage } = view(records, '2026-03');
    expect(slices.map((s) => [s.days, s.rate])).toEqual([
      [1, 10], // Mon 2 only
      [7, 20], // 3 to 11
      [6, 30], // 12 to 19
      [8, 40], // 20 to 31
    ]);
    expect(slices.reduce((sum, s) => sum + s.days, 0)).toBe(22);
    expect(coverage).toBe('full');
  });

  it('marks a month before the first rate as none, with no slices', () => {
    expect(view([rate('2026-06-01', 10)], '2026-05')).toEqual({ coverage: 'none', slices: [] });
  });

  it('marks a first rate that starts mid-month as partial and leaves earlier days uncovered', () => {
    const result = view([rate('2026-05-14', 10)], '2026-05');
    expect(result.coverage).toBe('partial');
    expect(result.slices).toEqual([{ from: '2026-05-14', to: '2026-06-01', days: 12, rate: 10 }]);
  });

  it('marks an employee with no records as none', () => {
    expect(view([], '2026-03')).toEqual({ coverage: 'none', slices: [] });
  });

  it('is none when the first rate starts after the last working day of the month', () => {
    // Sat 2026-05-30: May 29 (Fri) is the last working day.
    expect(view([rate('2026-05-30', 10)], '2026-05').coverage).toBe('none');
  });

  it('drops a slice that contains only weekend days', () => {
    // 2026-03-07 is a Saturday, 2026-03-09 the next Monday.
    const records = [rate('2026-01-01', 10), rate('2026-03-07', 20), rate('2026-03-09', 30)];
    const { slices } = view(records, '2026-03');
    expect(slices.map((s) => s.rate)).toEqual([10, 30]);
    expect(slices.reduce((sum, s) => sum + s.days, 0)).toBe(22);
  });

  it('sorts unsorted input defensively', () => {
    const sorted = view([rate('2026-01-01', 10), rate('2026-03-12', 20)], '2026-03');
    const shuffled = view([rate('2026-03-12', 20), rate('2026-01-01', 10)], '2026-03');
    expect(shuffled).toEqual(sorted);
  });

  it('does not mutate the input array', () => {
    const records = [rate('2026-03-12', 20), rate('2026-01-01', 10)];
    buildRateSchedule(records);
    expect(records.map((r) => r.validFrom)).toEqual(['2026-03-12', '2026-01-01']);
  });

  it('rejects a record with a malformed date', () => {
    expect(() => buildRateSchedule([rate('2026-02-30', 10)])).toThrow(RangeError);
  });
});

describe('every seeded employee, every month from March 2026 to March 2027', () => {
  const employeeIds = [...new Set(seed.rateRecords.map((r) => r.employeeId))];
  const months = monthRange(month('2026-03'), month('2027-03'));

  it('keeps slices ordered, non-overlapping and priced at a seeded rate', () => {
    for (const employeeId of employeeIds) {
      const records = seedRates(employeeId);
      const schedule = buildRateSchedule(records);
      const rates = new Set(records.map((r) => r.hourlyCost));
      for (const ym of months) {
        const { slices } = sliceMonth(schedule, ym);
        slices.forEach((slice, i) => {
          expect(rates.has(slice.hourlyCost)).toBe(true);
          const previous = slices[i - 1];
          if (previous) expect(compareDates(previous.to, slice.from)).toBeLessThanOrEqual(0);
        });
      }
    }
  });

  it('reports full coverage exactly when the slices add up to the month working days', () => {
    for (const employeeId of employeeIds) {
      const schedule = buildRateSchedule(seedRates(employeeId));
      for (const ym of months) {
        const { slices, coverage } = sliceMonth(schedule, ym);
        const covered = slices.reduce((sum, s) => sum + s.workingDays, 0);
        const expected =
          covered === 0 ? 'none' : covered === workingDaysInMonth(ym) ? 'full' : 'partial';
        expect(coverage).toBe(expected);
      }
    }
  });

  it('has full coverage everywhere because every seeded person has a rate from 2025-01-01', () => {
    for (const employeeId of employeeIds) {
      const schedule = buildRateSchedule(seedRates(employeeId));
      for (const ym of months) expect(sliceMonth(schedule, ym).coverage).toBe('full');
    }
  });
});
