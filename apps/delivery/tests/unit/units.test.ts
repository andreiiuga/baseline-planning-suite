import { describe, expect, it } from 'vitest';
import { monthRange, parseYearMonth } from '../../src/domain/dates';
import { buildRateSchedule, type RateRecord } from '../../src/domain/rates';
import { cellContext, pmToUnit, UNITS, unitToPm, type Unit } from '../../src/domain/units';

const month = parseYearMonth;
const rate = (validFrom: string, hourlyCost: number): RateRecord => ({
  id: `r-${validFrom}`,
  employeeId: 'emp-x',
  validFrom,
  hourlyCost,
});
const schedule = buildRateSchedule([rate('2025-01-01', 80), rate('2026-03-12', 95)]);

describe('one person-month varies by person and by month', () => {
  it.each([
    [40, '2026-03', 176],
    [40, '2026-02', 160],
    [32, '2026-03', 140.8],
    [20, '2026-03', 88],
    [20, '2026-08', 84],
  ])('%i h/week in %s is %d h', (weeklyHours, ym, expected) => {
    expect(cellContext(weeklyHours, month(ym), schedule).personMonthHours).toBeCloseTo(
      expected,
      10,
    );
  });
});

describe('conversions from person-months', () => {
  const ctx = cellContext(32, month('2026-03'), schedule);

  it('converts to hours, percent and cost', () => {
    expect(pmToUnit(1, 'hours', ctx)).toBeCloseTo(140.8, 10);
    expect(pmToUnit(0.25, 'pct', ctx)).toBe(25);
    expect(pmToUnit(1, 'eur', ctx)).toBeCloseTo(140.8 * ctx.blendedRate, 8);
  });

  it('keeps 100% equal to exactly one person-month', () => {
    expect(unitToPm(100, 'pct', ctx)).toEqual({ ok: true, pm: 1 });
  });

  it('is the identity for the canonical unit', () => {
    expect(pmToUnit(0.37, 'pm', ctx)).toBe(0.37);
    expect(unitToPm(0.37, 'pm', ctx)).toEqual({ ok: true, pm: 0.37 });
  });

  it('turns cost into hours via the blended rate, then into person-months', () => {
    // Reference cell: EUR 7,880.00 in March for a 40 h/week employee is 0.50 PM.
    const reference = cellContext(40, month('2026-03'), schedule);
    const result = unitToPm(7880, 'eur', reference);
    expect(result.ok && result.pm).toBeCloseTo(0.5, 10);
  });
});

describe('lossless round trips: PM -> unit -> PM', () => {
  const people: readonly number[] = [40, 32, 20];
  const months = monthRange(month('2026-03'), month('2027-03'));
  const amounts = [0, 0.01, 0.1, 0.25, 0.333333, 0.5, 0.59, 1, 1.18, 2.5];

  it.each(UNITS)('returns the stored value through %s', (unit: Unit) => {
    for (const weeklyHours of people) {
      for (const ym of months) {
        const ctx = cellContext(weeklyHours, ym, schedule);
        for (const pm of amounts) {
          const back = unitToPm(pmToUnit(pm, unit, ctx), unit, ctx);
          expect(back.ok).toBe(true);
          if (back.ok) expect(back.pm).toBeCloseTo(pm, 12);
        }
      }
    }
  });

  it('survives ten switches through every unit in a row', () => {
    const ctx = cellContext(32, month('2026-05'), buildRateSchedule([rate('2026-05-14', 61.5)]));
    let pm = 0.59;
    for (let i = 0; i < 10; i += 1) {
      for (const unit of UNITS) {
        const result = unitToPm(pmToUnit(pm, unit, ctx), unit, ctx);
        if (!result.ok) throw new Error('round trip refused');
        pm = result.pm;
      }
    }
    expect(pm).toBeCloseTo(0.59, 10);
  });
});

describe('partial coverage', () => {
  // First rate on 2026-05-14: 12 of May's 21 working days are priced, 9 cost zero.
  const ctx = cellContext(40, month('2026-05'), buildRateSchedule([rate('2026-05-14', 100)]));

  it('prices only the covered working days', () => {
    expect(ctx.slicing.coverage).toBe('partial');
    const hours = pmToUnit(1, 'hours', ctx);
    expect(pmToUnit(1, 'eur', ctx)).toBeCloseTo((hours / 21) * 12 * 100, 8);
  });

  it('defines the blended rate as cost over hours, zero-cost days included', () => {
    expect(ctx.blendedRate).toBeCloseTo((12 * 100) / 21, 10);
    expect(pmToUnit(1, 'eur', ctx) / pmToUnit(1, 'hours', ctx)).toBeCloseTo(ctx.blendedRate, 10);
  });

  it('still round-trips cost', () => {
    const back = unitToPm(pmToUnit(0.7, 'eur', ctx), 'eur', ctx);
    expect(back.ok && back.pm).toBeCloseTo(0.7, 12);
  });
});

describe('no rate coverage', () => {
  const ctx = cellContext(40, month('2026-05'), buildRateSchedule([rate('2026-06-01', 100)]));

  it('costs zero', () => {
    expect(ctx.slicing.coverage).toBe('none');
    expect(pmToUnit(0.5, 'eur', ctx)).toBe(0);
    expect(ctx.blendedRate).toBe(0);
  });

  it('refuses cost input instead of dividing by zero', () => {
    expect(unitToPm(500, 'eur', ctx)).toEqual({ ok: false, reason: 'no-rate-coverage' });
  });

  it('still accepts the other units', () => {
    expect(unitToPm(50, 'pct', ctx)).toEqual({ ok: true, pm: 0.5 });
  });
});

describe('without People data (no conversion context)', () => {
  it('still converts person-months and percent', () => {
    expect(unitToPm(0.5, 'pm', null)).toEqual({ ok: true, pm: 0.5 });
    expect(unitToPm(50, 'pct', null)).toEqual({ ok: true, pm: 0.5 });
  });

  it.each(['hours', 'eur'] as const)('refuses %s instead of guessing', (unit) => {
    expect(unitToPm(10, unit, null)).toEqual({ ok: false, reason: 'people-unavailable' });
  });

  it('still reports bad input as bad input', () => {
    expect(unitToPm(-1, 'pm', null)).toEqual({ ok: false, reason: 'negative' });
  });
});

describe('input validation', () => {
  const ctx = cellContext(40, month('2026-03'), schedule);

  it.each([
    [Number.NaN, 'invalid-number'],
    [Number.POSITIVE_INFINITY, 'invalid-number'],
    [-1, 'negative'],
  ] as const)('rejects %s', (value, reason) => {
    for (const unit of UNITS) {
      expect(unitToPm(value, unit, ctx)).toEqual({ ok: false, reason });
    }
  });

  it('accepts zero in every unit', () => {
    for (const unit of UNITS) expect(unitToPm(0, unit, ctx)).toEqual({ ok: true, pm: 0 });
  });
});
