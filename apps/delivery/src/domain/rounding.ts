/**
 * Display rounding that reconciles. Values are held as scaled integers (value x 10^decimals)
 * so sums of displayed numbers are exact integer sums, not floating-point approximations.
 */

/** Added before rounding so values like 0.285 * 100 = 28.499999999999996 round as intended. */
const EPSILON = 1e-9;

function assertDisplayable(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Cannot round ${value}: expected a finite, non-negative number`);
  }
}

/** Rounds one value to a scaled integer (half up). */
export function toScaled(value: number, decimals: number): number {
  assertDisplayable(value);
  return Math.floor(value * 10 ** decimals + 0.5 + EPSILON);
}

export interface Apportioned {
  /** Scaled integers, one per input, in input order. */
  readonly cells: readonly number[];
  /** Scaled integer. Always equals the sum of `cells`. */
  readonly total: number;
}

/**
 * Largest-remainder apportionment. The total is the exact sum rounded once; every cell is
 * rounded down, then the units still owed go to the cells with the largest fractional
 * remainder (ties to the earliest index). Each cell ends up within one unit of its exact
 * value and the displayed cells add up to the displayed total.
 */
export function apportion(values: readonly number[], decimals: number): Apportioned {
  const scale = 10 ** decimals;
  const scaledExact = values.map((value) => {
    assertDisplayable(value);
    return value * scale;
  });
  const total = Math.floor(scaledExact.reduce((sum, x) => sum + x, 0) + 0.5 + EPSILON);
  const cells = scaledExact.map(Math.floor);
  const owed = Math.max(0, total - cells.reduce((sum, cell) => sum + cell, 0));

  const byRemainder = scaledExact
    .map((exact, index) => ({ index, remainder: exact - Math.floor(exact) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder.slice(0, owed)) {
    cells[index] = (cells[index] ?? 0) + 1;
  }
  return { cells, total: cells.reduce((sum, cell) => sum + cell, 0) };
}

/** Formats a scaled integer with a fixed number of decimals and thousands separators. */
export function formatScaled(scaled: number, decimals: number): string {
  const digits = String(Math.abs(scaled)).padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = decimals > 0 ? `.${digits.slice(digits.length - decimals)}` : '';
  return `${scaled < 0 ? '-' : ''}${whole}${fraction}`;
}
