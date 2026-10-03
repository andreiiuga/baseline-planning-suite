/**
 * Each app publishes an adapter; each consumer owns a contract suite for it. Here the real
 * adapters (over real IndexedDB storage, via fake-indexeddb) are run against the other app's
 * suite. This is what stands in for "the teams ship independently": if People changes what
 * it publishes, Delivery's suite fails here, before release.
 *
 * The assignments below are compile-time checks too: a provider is only accepted if it
 * structurally satisfies the consumer's port, with no import in either direction.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openPlanRepository } from '../../apps/delivery/src/adapters/idb/idbPlanRepository';
import deliverySeed from '../../apps/delivery/src/adapters/seed/delivery-seed.json';
import type { DeliverySeed } from '../../apps/delivery/src/adapters/seed/types';
import { isOverCapacity } from '../../apps/delivery/src/domain/capacity';
import { allocationTotalsFor } from '../../apps/delivery/src/exposed/totals';
import type { EmployeeQuery, RateQuery } from '../../apps/delivery/src/ports/peopleQueries';
import { runEmployeeQueryContract } from '../../apps/delivery/tests/contracts/employeeQuery.contract';
import { runRateQueryContract } from '../../apps/delivery/tests/contracts/rateQuery.contract';
import { openPeopleRepository } from '../../apps/people/src/adapters/idb/idbPeopleRepository';
import peopleSeed from '../../apps/people/src/adapters/seed/people-seed.json';
import type { PeopleSeed } from '../../apps/people/src/adapters/seed/types';
import { isOversubscribed } from '../../apps/people/src/domain/capacity';
import { employeeQueryFor, rateQueryFor } from '../../apps/people/src/exposed/queries';
import type { AllocationTotals } from '../../apps/people/src/ports/allocationTotals';
import { runAllocationTotalsContract } from '../../apps/people/tests/contracts/allocationTotals.contract';

afterEach(() => vi.restoreAllMocks());

const people: PeopleSeed = peopleSeed;
const delivery: DeliverySeed = deliverySeed;
let counter = 0;
const freshName = (prefix: string) => `${prefix}-${(counter += 1)}`;

const peopleRepository = () => openPeopleRepository(people, freshName('people-int'));
const planRepository = () => openPlanRepository(delivery, freshName('delivery-int'));

async function peopleRateQuery(): Promise<RateQuery> {
  const repo = await peopleRepository();
  return rateQueryFor(() => Promise.resolve(repo));
}
async function peopleEmployeeQuery(): Promise<EmployeeQuery> {
  const repo = await peopleRepository();
  return employeeQueryFor(() => Promise.resolve(repo));
}
async function deliveryTotals(): Promise<AllocationTotals> {
  const repo = await planRepository();
  return allocationTotalsFor(() => Promise.resolve(repo));
}

// People's real adapter, run against Delivery's contract suites
runRateQueryContract("People's real adapter", peopleRateQuery);
runEmployeeQueryContract("People's real adapter", peopleEmployeeQuery);

// Delivery's real adapter, run against People's contract suite
runAllocationTotalsContract("Delivery's real adapter", deliveryTotals);

describe('what People publishes follows People edits', () => {
  it('reflects a rate change made through the repository', async () => {
    const repo = await peopleRepository();
    const query = rateQueryFor(() => Promise.resolve(repo));
    await repo.replaceRates('emp-001', [
      { id: 'rate-new', employeeId: 'emp-001', validFrom: '2026-06-01', hourlyCost: 120 },
    ]);
    const result = await query.getRates(['emp-001']);
    expect(result).toEqual({
      status: 'ok',
      data: {
        'emp-001': [
          { id: 'rate-new', employeeId: 'emp-001', validFrom: '2026-06-01', hourlyCost: 120 },
        ],
      },
    });
  });

  it('answers "unavailable" instead of throwing when storage fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = rateQueryFor(() => Promise.reject(new Error('disk on fire')));
    expect(await broken.getRates(['emp-001'])).toEqual({ status: 'unavailable' });
    const brokenEmployees = employeeQueryFor(() => Promise.reject(new Error('disk on fire')));
    expect(await brokenEmployees.listEmployees()).toEqual({ status: 'unavailable' });
  });
});

describe('what Delivery publishes follows Delivery edits', () => {
  it('reflects a cell edit and keeps counting across projects', async () => {
    const repo = await planRepository();
    const totals = allocationTotalsFor(() => Promise.resolve(repo));
    await repo.setAllocationAmount(
      { breakdownItemId: 'wbs-012', employeeId: 'emp-001', month: '2026-03' },
      0.9,
    );
    const result = await totals.getMonthlyTotals(['emp-001']);
    if (result.status !== 'ok') throw new Error('unavailable');
    expect(result.data.find((t) => t.month === '2026-03')?.allocatedPM).toBeGreaterThanOrEqual(0.9);
  });

  it('answers "unavailable" instead of throwing when storage fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = allocationTotalsFor(() => Promise.reject(new Error('disk on fire')));
    expect(await broken.getMonthlyTotals(['emp-001'])).toEqual({ status: 'unavailable' });
  });
});

describe('both apps agree on when someone is over capacity', () => {
  const totals = [
    0,
    0.5,
    0.99,
    1,
    1 + 1e-10,
    1 + 5e-10,
    1 + 2e-9,
    1.01,
    1.18,
    0.1 + 0.7 + 0.2,
    0.1 + 0.2 + 0.7,
    0.3 + 0.3 + 0.4,
    1.0000000001,
  ];

  it.each(totals)('%d', (total) => {
    expect(isOversubscribed(total)).toBe(isOverCapacity(total));
  });
});
