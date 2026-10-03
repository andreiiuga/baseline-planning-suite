import { describe, expect, it } from 'vitest';
import {
  addMonths,
  calendarDate,
  compareDates,
  compareYearMonths,
  daysInMonth,
  dayOfWeek,
  firstDayOf,
  formatIsoDate,
  formatYearMonth,
  isLeapYear,
  monthRange,
  parseIsoDate,
  parseYearMonth,
  workingDaysBetween,
  workingDaysInMonth,
  yearMonth,
} from '../../src/domain/dates';

const ym = parseYearMonth;
const date = parseIsoDate;

describe('calendar basics', () => {
  it.each([
    [2024, true],
    [2028, true],
    [2026, false],
    [1900, false],
    [2000, true],
  ])('isLeapYear(%i) = %s', (year, expected) => {
    expect(isLeapYear(year)).toBe(expected);
  });

  it.each([
    [2026, 2, 28],
    [2028, 2, 29],
    [2026, 4, 30],
    [2026, 12, 31],
  ])('daysInMonth(%i-%i) = %i', (y, m, expected) => {
    expect(daysInMonth(yearMonth(y, m))).toBe(expected);
  });

  it('computes weekdays without the host time zone (0 = Sunday)', () => {
    expect(dayOfWeek(date('1970-01-01'))).toBe(4); // Thursday
    expect(dayOfWeek(date('2026-03-12'))).toBe(4); // Thursday
    expect(dayOfWeek(date('2026-03-01'))).toBe(0); // Sunday
    expect(dayOfWeek(date('2028-02-29'))).toBe(2); // Tuesday
    expect(dayOfWeek(date('1969-12-31'))).toBe(3); // Wednesday, before the epoch
  });
});

describe('parsing and formatting', () => {
  it('round-trips ISO dates and year-months', () => {
    expect(formatIsoDate(date('2026-03-12'))).toBe('2026-03-12');
    expect(formatYearMonth(ym('2026-03'))).toBe('2026-03');
  });

  it.each(['2026-02-29', '2026-13-01', '2026-00-10', '2026-03-00', '26-03-12', '2026-3-12', ''])(
    'rejects invalid ISO date %j',
    (text) => {
      expect(() => parseIsoDate(text)).toThrow(RangeError);
    },
  );

  it.each(['2026-13', '2026-00', '2026-3', 'march'])('rejects invalid year-month %j', (text) => {
    expect(() => parseYearMonth(text)).toThrow(RangeError);
  });

  it('rejects impossible components in constructors', () => {
    expect(() => calendarDate(2026, 2, 30)).toThrow(RangeError);
    expect(() => yearMonth(2026, 0)).toThrow(RangeError);
  });
});

describe('ordering and month arithmetic', () => {
  it('compares dates and year-months chronologically', () => {
    expect(compareDates(date('2026-03-11'), date('2026-03-12'))).toBeLessThan(0);
    expect(compareDates(date('2026-03-12'), date('2026-03-12'))).toBe(0);
    expect(compareDates(date('2027-01-01'), date('2026-12-31'))).toBeGreaterThan(0);
    expect(compareYearMonths(ym('2026-12'), ym('2027-01'))).toBeLessThan(0);
  });

  it('adds months across year boundaries in both directions', () => {
    expect(formatYearMonth(addMonths(ym('2026-11'), 3))).toBe('2027-02');
    expect(formatYearMonth(addMonths(ym('2026-04'), -4))).toBe('2025-12');
    expect(formatYearMonth(addMonths(ym('2026-04'), 0))).toBe('2026-04');
  });

  it('lists an inclusive month range', () => {
    const months = monthRange(ym('2026-04'), ym('2027-03')).map(formatYearMonth);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-04');
    expect(months[11]).toBe('2027-03');
    expect(monthRange(ym('2026-05'), ym('2026-04'))).toEqual([]);
  });

  it('returns the first day of a month', () => {
    expect(formatIsoDate(firstDayOf(ym('2026-03')))).toBe('2026-03-01');
  });
});

describe('workingDaysInMonth (Monday to Friday, holidays ignored)', () => {
  it.each([
    ['2026-03', 22],
    ['2026-02', 20], // starts on a Sunday
    ['2026-08', 21], // starts on a Saturday
    ['2026-05', 21], // starts on a Friday
    ['2028-02', 21], // leap February
    ['2026-12', 23], // Christmas is not a holiday here
  ])('%s has %i working days', (month, expected) => {
    expect(workingDaysInMonth(ym(month))).toBe(expected);
  });
});

describe('workingDaysBetween [from, to)', () => {
  it('splits March 2026 at the 12th into 8 and 14 (reference calculation)', () => {
    const start = date('2026-03-01');
    const change = date('2026-03-12');
    const next = date('2026-04-01');
    expect(workingDaysBetween(start, change)).toBe(8);
    expect(workingDaysBetween(change, next)).toBe(14);
  });

  it('is empty when from equals to or from is later', () => {
    expect(workingDaysBetween(date('2026-03-12'), date('2026-03-12'))).toBe(0);
    expect(workingDaysBetween(date('2026-03-13'), date('2026-03-12'))).toBe(0);
  });

  it('counts a range that starts and ends on weekends', () => {
    // Sat 2026-03-07 to Sun 2026-03-15 exclusive: Mon 9 to Fri 13
    expect(workingDaysBetween(date('2026-03-07'), date('2026-03-15'))).toBe(5);
  });

  it('counts a single weekday and ignores a single weekend day', () => {
    expect(workingDaysBetween(date('2026-03-12'), date('2026-03-13'))).toBe(1);
    expect(workingDaysBetween(date('2026-03-14'), date('2026-03-15'))).toBe(0);
  });

  it('agrees with workingDaysInMonth over a whole month', () => {
    expect(workingDaysBetween(date('2026-03-01'), date('2026-04-01'))).toBe(22);
  });

  it('handles ranges spanning many weeks and a year boundary', () => {
    // 2026-12-28 (Mon) to 2027-01-04 (Mon) exclusive: 5 weekdays + nothing extra
    expect(workingDaysBetween(date('2026-12-28'), date('2027-01-04'))).toBe(5);
    // A full year, 2026: 261 weekdays
    expect(workingDaysBetween(date('2026-01-01'), date('2027-01-01'))).toBe(261);
  });
});
