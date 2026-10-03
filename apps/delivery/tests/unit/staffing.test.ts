import { describe, expect, it } from 'vitest';
import { buildCapacityIndex } from '../../src/domain/capacity';
import { addMonths, monthRange, parseYearMonth } from '../../src/domain/dates';
import {
  buildPeopleModel,
  buildStaffingGrid,
  describeCulprit,
  itemPath,
  unitNeedsPeople,
} from '../../src/domain/staffing';
import { UNITS } from '../../src/domain/units';
import {
  allocations,
  breakdownItems,
  employees,
  rateRecords,
  ratesByEmployee,
} from '../support/seed';
import seed from '../../../../docs/baseline-seed.json';

const eur = { code: 'EUR', perEur: 1 };
const people = buildPeopleModel(employees, ratesByEmployee(rateRecords));
const items = breakdownItems.filter((i) => i.projectId === 'prj-1');
const marchWindow = monthRange(parseYearMonth('2026-03'), addMonths(parseYearMonth('2026-03'), 11));

const personLine = (
  grid: ReturnType<typeof buildStaffingGrid>,
  itemId: string,
  employeeId: string,
) => grid.items.get(itemId)?.people.find((p) => p.employeeId === employeeId);

describe('buildStaffingGrid, the reference cell in every unit', () => {
  const gridIn = (unit: (typeof UNITS)[number], currency = eur) =>
    buildStaffingGrid({ items, allocations, months: marchWindow, unit, currency, people });
  const okafor = (unit: (typeof UNITS)[number], currency = eur) =>
    personLine(gridIn(unit, currency), 'wbs-012', 'emp-001')?.cells[0];

  it('shows A. Okafor in March 2026 as 0.50 PM, 88.00 h, 50.0 % and EUR 7,880.00', () => {
    expect(okafor('pm')).toBe(50);
    expect(okafor('hours')).toBe(8800);
    expect(okafor('pct')).toBe(500);
    expect(okafor('eur')).toBe(788000);
  });

  it('shows cost in the selected display currency, converted from EUR', () => {
    expect(okafor('eur', { code: 'USD', perEur: 1.08 })).toBe(851040); // 7,880 x 1.08
  });

  it('needs People only for hours and cost', () => {
    expect(UNITS.filter(unitNeedsPeople)).toEqual(['hours', 'eur']);
  });

  it('still shows person-months and percent when People is unavailable', () => {
    const grid = buildStaffingGrid({
      items,
      allocations,
      months: marchWindow,
      unit: 'pct',
      currency: eur,
      people: null,
    });
    expect(personLine(grid, 'wbs-012', 'emp-001')?.cells[0]).toBe(500);
  });

  it('shows zero rather than a wrong number for units that need People when it is unavailable', () => {
    const grid = buildStaffingGrid({
      items,
      allocations,
      months: marchWindow,
      unit: 'eur',
      currency: eur,
      people: null,
    });
    expect(grid.footer.total).toBe(0);
  });
});

describe('buildStaffingGrid reconciles in every unit', () => {
  it.each(UNITS)('rows and footer add up in %s', (unit) => {
    const grid = buildStaffingGrid({
      items,
      allocations,
      months: marchWindow,
      unit,
      currency: eur,
      people,
    });
    const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(grid.footer.cells)).toBe(grid.footer.total);
    for (const row of grid.items.values()) expect(sum(row.cells)).toBe(row.total);
  });
});

describe('naming', () => {
  it('builds a readable path for an item', () => {
    const path = itemPath(breakdownItems, 'wbs-012');
    expect(path.split(' › ').length).toBe(3);
    expect(path.endsWith('Design')).toBe(true);
  });

  it('describes the culprit by project and path, with the total', () => {
    const load = buildCapacityIndex(allocations).get('emp-003', '2026-06');
    if (!load) throw new Error('missing load');
    const text = describeCulprit(load, breakdownItems, seed.projects);
    expect(text).toContain('1.18 person-months');
    expect(text).toContain('Most recently edited');
    expect(text).toContain(itemPath(breakdownItems, load.culprit?.breakdownItemId ?? ''));
  });
});
