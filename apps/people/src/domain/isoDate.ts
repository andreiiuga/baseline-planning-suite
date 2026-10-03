const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const isLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** True for a real calendar date in YYYY-MM-DD form. Does not use `Date`, so no time zone. */
export function isValidIsoDate(text: string): boolean {
  const match = ISO_DATE.exec(text);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1) return false;
  const lengths = [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= (lengths[m - 1] ?? 0);
}
