/**
 * Date-only arithmetic. Nothing here touches `Date`, so results never depend on the
 * host time zone (`new Date('2026-03-12')` parses as UTC but reads back in local time).
 */

export interface CalendarDate {
  readonly y: number;
  /** 1 to 12 */
  readonly m: number;
  /** 1 to 31 */
  readonly d: number;
}

export interface YearMonth {
  readonly y: number;
  /** 1 to 12 */
  readonly m: number;
}

/** 0 = Sunday ... 6 = Saturday */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function daysInMonth({ y, m }: YearMonth): number {
  const days = MONTH_LENGTHS[m - 1];
  if (days === undefined) throw new RangeError(`Invalid month: ${m}`);
  return m === 2 && isLeapYear(y) ? 29 : days;
}

export function yearMonth(y: number, m: number): YearMonth {
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    throw new RangeError(`Invalid year-month: ${y}-${m}`);
  }
  return { y, m };
}

export function calendarDate(y: number, m: number, d: number): CalendarDate {
  const month = yearMonth(y, m);
  if (!Number.isInteger(d) || d < 1 || d > daysInMonth(month)) {
    throw new RangeError(`Invalid date: ${y}-${m}-${d}`);
  }
  return { y, m, d };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

export function parseIsoDate(text: string): CalendarDate {
  const match = ISO_DATE.exec(text);
  if (!match) throw new RangeError(`Not an ISO date (YYYY-MM-DD): ${JSON.stringify(text)}`);
  return calendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function parseYearMonth(text: string): YearMonth {
  const match = ISO_MONTH.exec(text);
  if (!match) throw new RangeError(`Not a year-month (YYYY-MM): ${JSON.stringify(text)}`);
  return yearMonth(Number(match[1]), Number(match[2]));
}

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

export function formatIsoDate({ y, m, d }: CalendarDate): string {
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

export function formatYearMonth({ y, m }: YearMonth): string {
  return `${pad(y, 4)}-${pad(m, 2)}`;
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

export function compareYearMonths(a: YearMonth, b: YearMonth): number {
  return a.y - b.y || a.m - b.m;
}

export function firstDayOf({ y, m }: YearMonth): CalendarDate {
  return { y, m, d: 1 };
}

export function addMonths({ y, m }: YearMonth, delta: number): YearMonth {
  const index = y * 12 + (m - 1) + delta;
  return { y: Math.floor(index / 12), m: (((index % 12) + 12) % 12) + 1 };
}

/** Inclusive on both ends; empty when `to` is before `from`. */
export function monthRange(from: YearMonth, to: YearMonth): YearMonth[] {
  const months: YearMonth[] = [];
  for (let cursor = from; compareYearMonths(cursor, to) <= 0; cursor = addMonths(cursor, 1)) {
    months.push(cursor);
  }
  return months;
}

/** Days since 1970-01-01 in the proleptic Gregorian calendar (Howard Hinnant's algorithm). */
function epochDay({ y, m, d }: CalendarDate): number {
  const shiftedYear = m <= 2 ? y - 1 : y;
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const dayOfYear = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

export function dayOfWeek(date: CalendarDate): Weekday {
  // 1970-01-01 was a Thursday (4).
  return ((((epochDay(date) + 4) % 7) + 7) % 7) as Weekday;
}

function isWeekday(weekday: Weekday): boolean {
  return weekday !== 0 && weekday !== 6;
}

/**
 * Monday-to-Friday days in the half-open range [from, to). Public holidays are ignored.
 * Half-open so that adjacent slices (before / from a rate change) never share a day.
 */
export function workingDaysBetween(from: CalendarDate, to: CalendarDate): number {
  const start = epochDay(from);
  const end = epochDay(to);
  if (end <= start) return 0;
  const length = end - start;
  const fullWeeks = Math.floor(length / 7);
  let count = fullWeeks * 5;
  for (let offset = fullWeeks * 7; offset < length; offset += 1) {
    if (isWeekday(((((start + offset + 4) % 7) + 7) % 7) as Weekday)) count += 1;
  }
  return count;
}

export function workingDaysInMonth(month: YearMonth): number {
  const first = firstDayOf(month);
  const next = firstDayOf(addMonths(month, 1));
  return workingDaysBetween(first, next);
}
