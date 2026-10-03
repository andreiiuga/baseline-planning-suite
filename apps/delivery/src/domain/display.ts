import { apportion, formatScaled, toScaled, type Apportioned } from './rounding';
import type { Unit } from './units';

/** Fixed display precision per unit (the brief): hours 2, person-months 2, percent 1, cost 2. */
export const UNIT_DECIMALS: Readonly<Record<Unit, number>> = {
  hours: 2,
  pm: 2,
  pct: 1,
  eur: 2,
};

/** A value ready to show: the scaled integer is what totals are summed from. */
export interface DisplayValue {
  readonly scaled: number;
  readonly text: string;
}

/** Callers convert to the unit on exact values first, then round here. Never the other way. */
export function displayValue(value: number, unit: Unit): DisplayValue {
  const decimals = UNIT_DECIMALS[unit];
  const scaled = toScaled(value, decimals);
  return { scaled, text: formatScaled(scaled, decimals) };
}

export function formatUnit(scaled: number, unit: Unit): string {
  return formatScaled(scaled, UNIT_DECIMALS[unit]);
}

export function apportionUnit(values: readonly number[], unit: Unit): Apportioned {
  return apportion(values, UNIT_DECIMALS[unit]);
}
