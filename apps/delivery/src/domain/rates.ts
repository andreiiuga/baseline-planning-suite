import {
  addMonths,
  compareDates,
  firstDayOf,
  parseIsoDate,
  workingDaysBetween,
  workingDaysInMonth,
  type CalendarDate,
  type YearMonth,
} from './dates';

/** A cost-rate record as delivered by People (dates are ISO strings on the wire). */
export interface RateRecord {
  readonly id: string;
  readonly employeeId: string;
  /** Inclusive. The rate applies until the next record's validFrom, or forever if last. */
  readonly validFrom: string;
  readonly hourlyCost: number;
}

interface DatedRate {
  readonly validFrom: CalendarDate;
  readonly hourlyCost: number;
}

/** One person's rates, parsed and sorted once so months can be sliced repeatedly. */
export interface RateSchedule {
  readonly rates: readonly DatedRate[];
}

/** A stretch of one month priced at a single rate. `to` is exclusive. */
export interface RateSlice {
  readonly from: CalendarDate;
  readonly to: CalendarDate;
  readonly workingDays: number;
  readonly hourlyCost: number;
}

/**
 * How much of a month's working days have a rate.
 * - full: every working day is priced
 * - partial: the first rate starts mid-month, earlier working days cost zero
 * - none: no working day is priced
 */
export type Coverage = 'full' | 'partial' | 'none';

export interface MonthSlicing {
  readonly slices: readonly RateSlice[];
  readonly coverage: Coverage;
}

/** Parses and sorts defensively: callers need not pass records in order. */
export function buildRateSchedule(records: readonly RateRecord[]): RateSchedule {
  const rates = records
    .map((record) => ({
      validFrom: parseIsoDate(record.validFrom),
      hourlyCost: record.hourlyCost,
    }))
    .sort((a, b) => compareDates(a.validFrom, b.validFrom));
  return { rates };
}

function laterOf(a: CalendarDate, b: CalendarDate): CalendarDate {
  return compareDates(a, b) >= 0 ? a : b;
}

function earlierOf(a: CalendarDate, b: CalendarDate): CalendarDate {
  return compareDates(a, b) <= 0 ? a : b;
}

/**
 * Splits a month at every rate change. A rate runs from its validFrom (inclusive) to the
 * next record's validFrom, so the day of a change is priced at the new rate. Slices with no
 * working days (a change on a weekend) are dropped, so every returned slice carries cost.
 */
export function sliceMonth(schedule: RateSchedule, month: YearMonth): MonthSlicing {
  const monthStart = firstDayOf(month);
  const monthEnd = firstDayOf(addMonths(month, 1));
  const slices: RateSlice[] = [];

  schedule.rates.forEach((rate, index) => {
    const next = schedule.rates[index + 1];
    const from = laterOf(rate.validFrom, monthStart);
    const to = next ? earlierOf(next.validFrom, monthEnd) : monthEnd;
    const workingDays = workingDaysBetween(from, to);
    if (workingDays > 0) {
      slices.push({ from, to, workingDays, hourlyCost: rate.hourlyCost });
    }
  });

  const covered = slices.reduce((sum, slice) => sum + slice.workingDays, 0);
  const coverage: Coverage =
    covered === 0 ? 'none' : covered === workingDaysInMonth(month) ? 'full' : 'partial';
  return { slices, coverage };
}
