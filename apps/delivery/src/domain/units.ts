import { workingDaysInMonth, type YearMonth } from './dates';
import { sliceMonth, type MonthSlicing, type RateSchedule } from './rates';

/** The four ways a cell can be read and edited. Allocations are stored in person-months only. */
export const UNITS = ['pm', 'hours', 'pct', 'eur'] as const;
export type Unit = (typeof UNITS)[number];

/**
 * Everything needed to convert one person's cell for one month. One person-month is
 * `weeklyHours x (working days / 5)`, so it differs by person and by month.
 */
export interface CellContext {
  readonly month: YearMonth;
  readonly weeklyHours: number;
  readonly workingDays: number;
  /** Hours in one person-month for this person in this month. */
  readonly personMonthHours: number;
  readonly slicing: MonthSlicing;
  /** Sum over slices of (working days x hourly cost). Uncovered days contribute nothing. */
  readonly pricedRateDays: number;
  /**
   * Cost per hour averaged over the month's working days, zero-cost days included:
   * cost / hours. Zero when nothing is covered.
   */
  readonly blendedRate: number;
}

export function cellContext(
  weeklyHours: number,
  month: YearMonth,
  schedule: RateSchedule,
): CellContext {
  const workingDays = workingDaysInMonth(month);
  const slicing = sliceMonth(schedule, month);
  const pricedRateDays = slicing.slices.reduce((sum, s) => sum + s.workingDays * s.hourlyCost, 0);
  return {
    month,
    weeklyHours,
    workingDays,
    personMonthHours: (weeklyHours * workingDays) / 5,
    slicing,
    pricedRateDays,
    blendedRate: pricedRateDays / workingDays,
  };
}

export type UnitInputFailure =
  | 'invalid-number'
  | 'negative'
  | 'no-rate-coverage'
  /** Hours and cost need People's data and there is none to convert with. */
  | 'people-unavailable';

export type UnitToPm =
  | { readonly ok: true; readonly pm: number }
  | { readonly ok: false; readonly reason: UnitInputFailure };

interface UnitConverter {
  readonly fromPm: (pm: number, ctx: CellContext) => number;
  /** Receives a validated, non-negative, finite value. */
  readonly toPm: (value: number, ctx: CellContext) => UnitToPm;
}

const ok = (pm: number): UnitToPm => ({ ok: true, pm });

const CONVERTERS: Readonly<Record<Unit, UnitConverter>> = {
  pm: {
    fromPm: (pm) => pm,
    toPm: ok,
  },
  hours: {
    fromPm: (pm, ctx) => pm * ctx.personMonthHours,
    toPm: (hours, ctx) => ok(hours / ctx.personMonthHours),
  },
  pct: {
    fromPm: (pm) => pm * 100,
    toPm: (pct) => ok(pct / 100),
  },
  eur: {
    // cost = hours per working day x sum(days x rate) = hours x blended rate
    fromPm: (pm, ctx) => (pm * ctx.personMonthHours * ctx.pricedRateDays) / ctx.workingDays,
    toPm: (eur, ctx) => {
      if (ctx.blendedRate === 0) return { ok: false, reason: 'no-rate-coverage' };
      return ok(eur / ctx.blendedRate / ctx.personMonthHours);
    },
  },
};

export function pmToUnit(pm: number, unit: Unit, ctx: CellContext): number {
  return CONVERTERS[unit].fromPm(pm, ctx);
}

/**
 * Converts something a user typed (already parsed to a number) into person-months. `ctx` is
 * null while People's data is unavailable: person-months and percent still convert, hours
 * and cost are refused.
 */
export function unitToPm(value: number, unit: Unit, ctx: CellContext | null): UnitToPm {
  if (!Number.isFinite(value)) return { ok: false, reason: 'invalid-number' };
  if (value < 0) return { ok: false, reason: 'negative' };
  if (unit === 'pm') return ok(value);
  if (unit === 'pct') return ok(value / 100);
  if (ctx === null) return { ok: false, reason: 'people-unavailable' };
  return CONVERTERS[unit].toPm(value, ctx);
}
