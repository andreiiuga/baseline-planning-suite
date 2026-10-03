/**
 * The reference calculation from the case study (section 3.3, figure 4).
 * If this file fails, stop and fix it before anything else.
 *
 * A. Okafor, 40 h/week, EUR 80/h from 2025-01-01 and EUR 95/h from 2026-03-12,
 * one leaf cell of 0.50 person-months in March 2026 (alloc-001).
 */
import { describe, expect, it } from 'vitest';
import { parseYearMonth } from '../../src/domain/dates';
import { buildRateSchedule } from '../../src/domain/rates';
import { cellContext, pmToUnit } from '../../src/domain/units';
import seed from '../../../../docs/baseline-seed.json';

const okafor = seed.employees.find((e) => e.id === 'emp-001');
const allocation = seed.allocations.find((a) => a.id === 'alloc-001');
if (!okafor || !allocation) throw new Error('Seed is missing emp-001 or alloc-001');

const march = parseYearMonth(allocation.month);
const ctx = cellContext(
  okafor.weeklyHours,
  march,
  buildRateSchedule(seed.rateRecords.filter((r) => r.employeeId === okafor.id)),
);
const pm = allocation.amount;

describe('golden reference: A. Okafor, March 2026, 0.50 person-months', () => {
  it('starts from the seeded inputs', () => {
    expect(okafor.weeklyHours).toBe(40);
    expect(allocation.month).toBe('2026-03');
    expect(pm).toBe(0.5);
  });

  it('has 22 working days, split 8 before and 14 from the 12th', () => {
    expect(ctx.workingDays).toBe(22);
    expect(ctx.slicing.slices.map((s) => s.workingDays)).toEqual([8, 14]);
    expect(ctx.slicing.coverage).toBe('full');
  });

  it('has one person-month of 40 x 22 / 5 = 176.00 h', () => {
    expect(ctx.personMonthHours).toBe(176);
  });

  it('is 88.00 h, which is 4.00 h per working day', () => {
    expect(pmToUnit(pm, 'hours', ctx)).toBe(88);
    expect(pmToUnit(pm, 'hours', ctx) / ctx.workingDays).toBe(4);
  });

  it('costs 8 x 4 x 80 + 14 x 4 x 95 = EUR 7,880.00', () => {
    expect(pmToUnit(pm, 'eur', ctx)).toBeCloseTo(7880, 8);
  });

  it('is 50.0% of capacity', () => {
    expect(pmToUnit(pm, 'pct', ctx)).toBe(50);
  });

  it('implies a blended rate of EUR 89.5455/h', () => {
    expect(ctx.blendedRate).toBeCloseTo(89.5455, 4);
    expect(pmToUnit(pm, 'eur', ctx) / pmToUnit(pm, 'hours', ctx)).toBeCloseTo(89.5455, 4);
  });
});
