import type { Currency } from '../contracts';

/**
 * Illustrative fixed rates, labelled as such in the README. Amounts are stored in EUR; the
 * shell only chooses how they are shown.
 */
export const CURRENCIES: readonly Currency[] = [
  { code: 'EUR', perEur: 1 },
  { code: 'USD', perEur: 1.08 },
  { code: 'GBP', perEur: 0.85 },
];

export const DEFAULT_CURRENCY: Currency = { code: 'EUR', perEur: 1 };

/** Anything unrecognised (corrupt storage, a removed currency) falls back to EUR. */
export function currencyByCode(code: string | null): Currency {
  return CURRENCIES.find((currency) => currency.code === code) ?? DEFAULT_CURRENCY;
}
