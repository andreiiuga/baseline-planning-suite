import {
  createFixtureEmployeeQuery,
  createFixtureRateQuery,
} from '../../src/adapters/fixturePeople';
import {
  unavailableEmployeeQuery,
  unavailableRateQuery,
} from '../../src/adapters/unavailablePeople';
import { silentEventBus } from '../../src/adapters/silentEventBus';
import fixture from '../../src/adapters/seed/people-fixture.json';
import { describe, expect, it } from 'vitest';
import { runEmployeeQueryContract } from './employeeQuery.contract';
import { runRateQueryContract } from './rateQuery.contract';

runRateQueryContract('Delivery fixture adapter', () =>
  Promise.resolve(createFixtureRateQuery(fixture)),
);
runEmployeeQueryContract('Delivery fixture adapter', () =>
  Promise.resolve(createFixtureEmployeeQuery(fixture)),
);

describe('null-object adapters', () => {
  it('the silent event bus accepts publishes and hands back a working unsubscribe', () => {
    const unsubscribe = silentEventBus.subscribe('rate:changed', () => {
      throw new Error('nothing should ever be delivered');
    });
    silentEventBus.publish({ type: 'allocation:changed', employeeId: 'emp-001', month: '2026-03' });
    expect(() => unsubscribe()).not.toThrow();
  });

  it('answer "unavailable" to every question', async () => {
    expect(await unavailableRateQuery.getRates(['emp-001'])).toEqual({ status: 'unavailable' });
    expect(await unavailableEmployeeQuery.listEmployees()).toEqual({ status: 'unavailable' });
  });
});
