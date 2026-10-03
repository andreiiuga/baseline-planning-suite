// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFixtureAllocationTotals } from '../../src/adapters/fixtureDelivery';
import { createMemoryPeopleRepository } from '../../src/adapters/memory/memoryPeopleRepository';
import totalsFixture from '../../src/adapters/seed/allocation-totals-fixture.json';
import peopleSeed from '../../src/adapters/seed/people-seed.json';
import type { PeopleSeed } from '../../src/adapters/seed/types';
import type { AllocationChanged, PeopleEventBus, RateChanged } from '../../src/ports/eventBus';
import type { AllocationTotals } from '../../src/ports/allocationTotals';
import type { PeopleAppProps } from '../../src/AppProps';
import { PeopleApp } from '../../src/ui/PeopleApp';

const seed: PeopleSeed = peopleSeed;

function createTestBus() {
  const published: RateChanged[] = [];
  const handlers = new Set<(event: AllocationChanged) => void>();
  const bus: PeopleEventBus = {
    publish: (event) => void published.push(event),
    subscribe: (_type, handler) => {
      handlers.add(handler);
      return () => void handlers.delete(handler);
    },
  };
  return {
    bus,
    published,
    emit: (event: AllocationChanged) => handlers.forEach((handler) => handler(event)),
  };
}

async function setup(overrides: Partial<PeopleAppProps> = {}) {
  const repository = createMemoryPeopleRepository(seed);
  const testBus = createTestBus();
  let nextId = 0;
  render(
    <PeopleApp
      repository={repository}
      allocationTotals={createFixtureAllocationTotals(totalsFixture)}
      bus={testBus.bus}
      currency={{ code: 'EUR', perEur: 1 }}
      activeUser={{ id: 'u', name: 'Tester' }}
      createId={() => `new-${(nextId += 1)}`}
      {...overrides}
    />,
  );
  await screen.findByRole('region', { name: 'Employees' }); // employees have loaded
  return { user: userEvent.setup(), repository, ...testBus };
}

const register = () => screen.getByRole('region', { name: 'Employees' });
const rateTable = () => screen.getByRole('table', { name: /Hourly cost rates/ });

async function openEmployee(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await within(register()).findByRole('button', { name: new RegExp(name) }));
  await screen.findByRole('table', { name: /Hourly cost rates/ });
}

async function fillRateForm(
  user: ReturnType<typeof userEvent.setup>,
  validFrom: string,
  hourlyCost: string,
) {
  const from = screen.getByLabelText(/Valid from/);
  const cost = screen.getByLabelText(/Hourly cost/);
  await user.clear(from);
  await user.clear(cost);
  if (validFrom) await user.type(from, validFrom);
  if (hourlyCost) await user.type(cost, hourlyCost);
}

describe('employee register', () => {
  it('lists all 60 people and filters as you type', async () => {
    const { user } = await setup();
    await within(register()).findByRole('button', { name: /Adaeze Okafor/ });
    expect(within(register()).getAllByRole('listitem')).toHaveLength(60);
    await user.type(screen.getByLabelText(/Search by name or role/), 'okafor');
    const items = within(register()).getAllByRole('listitem');
    expect(items.length).toBeLessThan(60);
    expect(within(items[0] as HTMLElement).getByText('Adaeze Okafor')).toBeTruthy();
  });

  it('says so when nobody matches', async () => {
    const { user } = await setup();
    await within(register()).findByRole('button', { name: /Adaeze Okafor/ });
    await user.type(screen.getByLabelText(/Search by name or role/), 'zzzqq');
    expect(screen.getByText(/No employees match/)).toBeTruthy();
    expect(within(register()).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('shows the selected person rate history with end dates and an open-ended last rate', async () => {
    const { user } = await setup();
    await openEmployee(user, 'Adaeze Okafor');
    const rows = within(rateTable()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText('2025-01-01')).toBeTruthy();
    expect(within(rows[0] as HTMLElement).getByText('2026-03-12')).toBeTruthy();
    expect(within(rows[0] as HTMLElement).getByText('80.00')).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText('open-ended')).toBeTruthy();
  });
});

describe('editing rate history', () => {
  it('adds a rate, persists it, and announces exactly one rate:changed', async () => {
    const { user, repository, published } = await setup();
    await openEmployee(user, 'Adaeze Okafor');
    await fillRateForm(user, '2026-09-01', '100');
    await user.click(screen.getByRole('button', { name: 'Add rate' }));
    await waitFor(() => expect(within(rateTable()).getAllByRole('row')).toHaveLength(4));
    expect(published).toEqual([{ type: 'rate:changed', employeeId: 'emp-001' }]);
    const stored = (await repository.getRates(['emp-001']))['emp-001'] ?? [];
    expect(stored.map((r) => r.validFrom)).toEqual(['2025-01-01', '2026-03-12', '2026-09-01']);
  });

  it('adds a retroactive rate before the first record', async () => {
    const { user } = await setup();
    await openEmployee(user, 'Adaeze Okafor');
    await fillRateForm(user, '2024-06-15', '70.5');
    await user.click(screen.getByRole('button', { name: 'Add rate' }));
    await waitFor(() => expect(within(rateTable()).getAllByRole('row')).toHaveLength(4));
    const first = within(rateTable()).getAllByRole('row')[1] as HTMLElement;
    expect(within(first).getByText('2024-06-15')).toBeTruthy();
  });

  it('refuses a duplicate date with a message, saves nothing and announces nothing', async () => {
    const { user, published } = await setup();
    await openEmployee(user, 'Adaeze Okafor');
    await fillRateForm(user, '2026-03-12', '99');
    await user.click(screen.getByRole('button', { name: 'Add rate' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/already has a rate starting/);
    expect(within(rateTable()).getAllByRole('row')).toHaveLength(3);
    expect(published).toEqual([]);
  });

  it.each([
    ['2026-02-30', '90', /real date/],
    ['', '90', /Enter the date/],
    ['2026-05-01', '', /Enter an hourly cost/],
    ['2026-05-01', '0', /greater than zero/],
    ['2026-05-01', '95.555', /at most 2 decimal/],
    ['2026-05-01', 'abc', /plain number/],
  ])('shows an inline message for %j / %j', async (date, cost, message) => {
    const { user, published } = await setup();
    await openEmployee(user, 'Adaeze Okafor');
    await fillRateForm(user, date, cost);
    await user.click(screen.getByRole('button', { name: 'Add rate' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => message.test(a.textContent ?? ''))).toBe(true);
    expect(published).toEqual([]);
  });

  it('marks the offending field invalid for assistive technology', async () => {
    const { user } = await setup();
    await openEmployee(user, 'Adaeze Okafor');
    await fillRateForm(user, '2026-02-30', '90');
    await user.click(screen.getByRole('button', { name: 'Add rate' }));
    const from = screen.getByLabelText(/Valid from/);
    expect(from.getAttribute('aria-invalid')).toBe('true');
    expect(from.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('corrects an existing rate in place', async () => {
    const { user, repository, published } = await setup();
    await openEmployee(user, 'Adaeze Okafor');
    await user.click(screen.getByRole('button', { name: 'Edit 2026-03-12' }));
    expect(screen.getByRole('button', { name: 'Save rate' })).toBeTruthy();
    await fillRateForm(user, '2026-03-12', '96');
    await user.click(screen.getByRole('button', { name: 'Save rate' }));
    await waitFor(() => expect(published).toHaveLength(1));
    const stored = (await repository.getRates(['emp-001']))['emp-001'] ?? [];
    expect(stored.map((r) => r.hourlyCost)).toEqual([80, 96]);
  });

  it('asks before removing, then removes and announces', async () => {
    const { user, repository, published } = await setup();
    await openEmployee(user, 'Adaeze Okafor');
    await user.click(screen.getByRole('button', { name: 'Remove 2026-03-12' }));
    expect((await repository.getRates(['emp-001']))['emp-001']).toHaveLength(2);
    expect(published).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Confirm remove 2026-03-12' }));
    await waitFor(() => expect(published).toHaveLength(1));
    expect((await repository.getRates(['emp-001']))['emp-001']).toHaveLength(1);
  });

  it('lets the last rate be removed and explains what that means', async () => {
    const { user } = await setup();
    await openEmployee(user, 'Adaeze Okafor');
    for (const date of ['2026-03-12', '2025-01-01']) {
      await user.click(screen.getByRole('button', { name: `Remove ${date}` }));
      await user.click(screen.getByRole('button', { name: `Confirm remove ${date}` }));
    }
    expect(await screen.findByText(/costs nothing until a rate is added/)).toBeTruthy();
  });

  it('shows read-only converted values when a non-EUR currency is selected', async () => {
    const { user } = await setup({ currency: { code: 'USD', perEur: 1.08 } });
    await openEmployee(user, 'Adaeze Okafor');
    expect(within(rateTable()).getByRole('columnheader', { name: 'USD / h' })).toBeTruthy();
    expect(within(rateTable()).getByText('86.40')).toBeTruthy(); // 80 x 1.08
    expect(within(rateTable()).getByText('102.60')).toBeTruthy(); // 95 x 1.08
  });
});

describe('oversubscription', () => {
  it('flags Milan Brandt, who is over capacity in June 2026, in the register and the detail', async () => {
    const { user } = await setup();
    const brandt = await within(register()).findByRole('button', { name: /Milan Brandt/ });
    await waitFor(() => expect(within(brandt).getByText('Oversubscribed')).toBeTruthy());
    await user.click(brandt);
    expect((await screen.findByText(/Oversubscribed in 2026-06/)).textContent).toContain('2026-06');
  });

  it('does not flag someone within capacity', async () => {
    await setup();
    const okafor = await within(register()).findByRole('button', { name: /Adaeze Okafor/ });
    await waitFor(() => expect(within(register()).getAllByText('Oversubscribed').length).toBe(6));
    expect(within(okafor).queryByText('Oversubscribed')).toBeNull();
  });

  it('says capacity is unavailable, and flags nobody, when Delivery is not loaded', async () => {
    await setup({ allocationTotals: null });
    expect(await screen.findByText(/Capacity data is unavailable/)).toBeTruthy();
    expect(screen.queryByText('Oversubscribed')).toBeNull();
  });

  it('re-reads totals when Delivery announces a change', async () => {
    let over = false;
    const totals: AllocationTotals = {
      getMonthlyTotals: (ids) =>
        Promise.resolve({
          status: 'ok',
          data: ids.includes('emp-001')
            ? [{ employeeId: 'emp-001', month: '2026-04', allocatedPM: over ? 1.4 : 0.5 }]
            : [],
        }),
    };
    const { emit } = await setup({ allocationTotals: totals });
    const okafor = await within(register()).findByRole('button', { name: /Adaeze Okafor/ });
    expect(within(okafor).queryByText('Oversubscribed')).toBeNull();
    over = true;
    act(() => emit({ type: 'allocation:changed', employeeId: 'emp-001', month: '2026-04' }));
    await waitFor(() => expect(within(okafor).getByText('Oversubscribed')).toBeTruthy());
  });
});
