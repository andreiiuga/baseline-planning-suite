import { isValidIsoDate } from './isoDate';
import type { RateRecord } from './model';

/** What the form hands over: raw text, validated here rather than in the UI. */
export interface RateInput {
  readonly validFrom: string;
  readonly hourlyCost: string;
}

export type RateErrorCode =
  | 'date-required'
  | 'date-invalid'
  | 'date-duplicate'
  | 'cost-required'
  | 'cost-invalid'
  | 'cost-not-positive'
  | 'cost-too-precise';

export interface RateFieldErrors {
  readonly validFrom?: RateErrorCode;
  readonly hourlyCost?: RateErrorCode;
}

export const RATE_ERROR_MESSAGES: Readonly<Record<RateErrorCode, string>> = {
  'date-required': 'Enter the date the rate starts.',
  'date-invalid': 'Enter a real date as YYYY-MM-DD.',
  'date-duplicate': 'This employee already has a rate starting on that date.',
  'cost-required': 'Enter an hourly cost.',
  'cost-invalid': 'Enter a plain number such as 95 or 95.50.',
  'cost-not-positive': 'The hourly cost must be greater than zero.',
  'cost-too-precise': 'Use at most 2 decimal places.',
};

export type RateHistoryResult =
  | { readonly ok: true; readonly history: readonly RateRecord[] }
  | { readonly ok: false; readonly errors: RateFieldErrors };

export const byValidFrom = (a: RateRecord, b: RateRecord): number =>
  a.validFrom < b.validFrom ? -1 : a.validFrom > b.validFrom ? 1 : 0;

/** ISO dates sort lexicographically, so no date arithmetic is needed. */
export const sortedHistory = (history: readonly RateRecord[]): RateRecord[] =>
  [...history].sort(byValidFrom);

type CostParse = { readonly cost: number } | { readonly error: RateErrorCode };

function parseCost(text: string): CostParse {
  const trimmed = text.trim();
  if (trimmed === '') return { error: 'cost-required' };
  if (!/^\d+(\.\d*)?$/.test(trimmed)) return { error: 'cost-invalid' };
  const decimals = trimmed.split('.')[1] ?? '';
  if (decimals.length > 2) return { error: 'cost-too-precise' };
  const cost = Number(trimmed);
  if (!Number.isFinite(cost)) return { error: 'cost-invalid' };
  if (cost <= 0) return { error: 'cost-not-positive' };
  return { cost };
}

interface Validated {
  readonly validFrom: string;
  readonly hourlyCost: number;
}

function validate(
  history: readonly RateRecord[],
  input: RateInput,
  ignoreId: string | null,
): { readonly value: Validated } | { readonly errors: RateFieldErrors } {
  const validFrom = input.validFrom.trim();
  const cost = parseCost(input.hourlyCost);
  let dateError: RateErrorCode | undefined;
  if (validFrom === '') dateError = 'date-required';
  else if (!isValidIsoDate(validFrom)) dateError = 'date-invalid';
  else if (history.some((r) => r.id !== ignoreId && r.validFrom === validFrom)) {
    dateError = 'date-duplicate';
  }
  if (dateError === undefined && !('error' in cost)) {
    return { value: { validFrom, hourlyCost: cost.cost } };
  }
  return {
    errors: {
      ...(dateError !== undefined ? { validFrom: dateError } : {}),
      ...('error' in cost ? { hourlyCost: cost.error } : {}),
    },
  };
}

/** Adds a rate anywhere in the history, including before the first one (retroactive). */
export function addRate(
  history: readonly RateRecord[],
  input: RateInput & { readonly id: string; readonly employeeId: string },
): RateHistoryResult {
  const checked = validate(history, input, null);
  if ('errors' in checked) return { ok: false, errors: checked.errors };
  const record: RateRecord = {
    id: input.id,
    employeeId: input.employeeId,
    validFrom: checked.value.validFrom,
    hourlyCost: checked.value.hourlyCost,
  };
  return { ok: true, history: sortedHistory([...history, record]) };
}

/** Corrects the date and/or cost of an existing record. The date may move anywhere. */
export function correctRate(
  history: readonly RateRecord[],
  id: string,
  input: RateInput,
): RateHistoryResult {
  if (!history.some((r) => r.id === id)) throw new RangeError(`No rate record ${id}`);
  const checked = validate(history, input, id);
  if ('errors' in checked) return { ok: false, errors: checked.errors };
  return {
    ok: true,
    history: sortedHistory(history.map((r) => (r.id === id ? { ...r, ...checked.value } : r))),
  };
}

/**
 * Removes a record, including the first or only one. Delivery then costs the uncovered
 * months at zero and marks them, which is the specified behaviour.
 */
export function removeRate(history: readonly RateRecord[], id: string): readonly RateRecord[] {
  return sortedHistory(history.filter((r) => r.id !== id));
}

export interface RateTimelineRow extends RateRecord {
  /** The day the next record takes over (exclusive end), or null for the open-ended last rate. */
  readonly validUntil: string | null;
}

export function rateTimeline(history: readonly RateRecord[]): RateTimelineRow[] {
  const sorted = sortedHistory(history);
  return sorted.map((record, index) => ({
    ...record,
    validUntil: sorted[index + 1]?.validFrom ?? null,
  }));
}
