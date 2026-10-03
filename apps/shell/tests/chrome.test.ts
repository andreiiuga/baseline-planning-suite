import { describe, expect, it } from 'vitest';
import { CURRENCIES, currencyByCode, DEFAULT_CURRENCY } from '../src/chrome/currency';
import { DEFAULT_USER, USERS, userById } from '../src/chrome/session';
import type { RemoteName } from '../src/config';
import { markVisited } from '../src/navigation';

describe('currencyByCode', () => {
  it('offers EUR, USD and GBP, with amounts stored in EUR', () => {
    expect(CURRENCIES.map((c) => c.code)).toEqual(['EUR', 'USD', 'GBP']);
    expect(currencyByCode('EUR').perEur).toBe(1);
  });

  it('finds a known currency', () => {
    expect(currencyByCode('USD')).toEqual({ code: 'USD', perEur: 1.08 });
  });

  it.each([null, '', 'JPY', 'usd'])('falls back to EUR for %j', (stored) => {
    expect(currencyByCode(stored)).toEqual(DEFAULT_CURRENCY);
  });
});

describe('userById', () => {
  it('finds each listed user', () => {
    for (const user of USERS) expect(userById(user.id)).toEqual(user);
  });

  it.each([null, '', 'user-99'])('falls back to the default user for %j', (stored) => {
    expect(userById(stored)).toEqual(DEFAULT_USER);
  });

  it('has a default that is one of the listed users', () => {
    expect(USERS).toContainEqual(DEFAULT_USER);
  });
});

describe('markVisited', () => {
  it('adds a panel the first time it is shown', () => {
    const visited = markVisited(new Set<RemoteName>(['people']), 'delivery');
    expect([...visited].sort()).toEqual(['delivery', 'people']);
  });

  it('keeps visited panels mounted when switching back', () => {
    const afterBoth = markVisited(
      markVisited(new Set<RemoteName>(['people']), 'delivery'),
      'people',
    );
    expect(afterBoth.has('delivery')).toBe(true);
  });

  it('returns the same set when nothing changes, so React does not re-render', () => {
    const visited = new Set<RemoteName>(['people']);
    expect(markVisited(visited, 'people')).toBe(visited);
  });

  it('never mutates its input', () => {
    const visited = new Set<RemoteName>(['people']);
    markVisited(visited, 'delivery');
    expect([...visited]).toEqual(['people']);
  });
});
