import { describe, expect, it } from 'vitest';
import { createFixtureAllocationTotals } from '../../src/adapters/fixtureDelivery';
import { silentEventBus } from '../../src/adapters/silentEventBus';
import { unavailableAllocationTotals } from '../../src/adapters/unavailableDelivery';
import fixture from '../../src/adapters/seed/allocation-totals-fixture.json';
import { CAPACITY_PM, isOversubscribed } from '../../src/domain/capacity';
import { runAllocationTotalsContract } from './allocationTotals.contract';

runAllocationTotalsContract('People fixture adapter', () =>
  Promise.resolve(createFixtureAllocationTotals(fixture)),
);

describe('null-object adapters', () => {
  it('answer "unavailable" to every question', async () => {
    expect(await unavailableAllocationTotals.getMonthlyTotals(['emp-001'])).toEqual({
      status: 'unavailable',
    });
  });

  it('the silent event bus accepts publishes and hands back a working unsubscribe', () => {
    const unsubscribe = silentEventBus.subscribe('allocation:changed', () => {
      throw new Error('nothing should ever be delivered');
    });
    silentEventBus.publish({ type: 'rate:changed', employeeId: 'emp-001' });
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe('isOversubscribed', () => {
  it('flags only totals above one person-month', () => {
    expect(CAPACITY_PM).toBe(1);
    expect(isOversubscribed(1)).toBe(false);
    expect(isOversubscribed(1.01)).toBe(true);
    expect(isOversubscribed(0.1 + 0.7 + 0.2)).toBe(false);
  });
});
