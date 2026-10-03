// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DeliveryAppProps } from '../../src/AppProps';
import {
  createFixtureEmployeeQuery,
  createFixtureRateQuery,
  type PeopleFixture,
} from '../../src/adapters/fixturePeople';
import { createMemoryPlanRepository } from '../../src/adapters/memory/memoryPlanRepository';
import deliverySeed from '../../src/adapters/seed/delivery-seed.json';
import peopleFixtureJson from '../../src/adapters/seed/people-fixture.json';
import type { DeliverySeed } from '../../src/adapters/seed/types';
import type { AllocationChanged, DeliveryEventBus, RateChanged } from '../../src/ports/eventBus';
import type { RateQuery } from '../../src/ports/peopleQueries';
import type { PlanRepository } from '../../src/ports/planRepository';
import { DeliveryApp } from '../../src/ui/DeliveryApp';

const seed: DeliverySeed = deliverySeed;
const peopleFixture: PeopleFixture = peopleFixtureJson;

function createTestBus() {
  const published: AllocationChanged[] = [];
  const handlers = new Set<(event: RateChanged) => void>();
  const bus: DeliveryEventBus = {
    publish: (event) => void published.push(event),
    subscribe: (_type, handler) => {
      handlers.add(handler);
      return () => void handlers.delete(handler);
    },
  };
  return { bus, published, emit: (event: RateChanged) => handlers.forEach((h) => h(event)) };
}

interface SetupOptions {
  readonly props?: Partial<DeliveryAppProps>;
  readonly repository?: PlanRepository;
}

async function setup({
  props = {},
  repository = createMemoryPlanRepository(seed),
}: SetupOptions = {}) {
  const testBus = createTestBus();
  render(
    <DeliveryApp
      repository={repository}
      employeeQuery={createFixtureEmployeeQuery(peopleFixture)}
      rateQuery={createFixtureRateQuery(peopleFixture)}
      bus={testBus.bus}
      currency={{ code: 'EUR', perEur: 1 }}
      activeUser={{ id: 'u', name: 'Tester' }}
      {...props}
    />,
  );
  await screen.findByRole('table');
  return { user: userEvent.setup(), repository, ...testBus };
}

const grid = () => screen.getByRole('table');
const personRow = (person: string, itemId = 'wbs-012') =>
  grid().querySelector(`tr[data-person="emp-${person}"][data-item="${itemId}"]`) as HTMLElement;
/** The input in column `index` (0 = first month shown) of a person row. */
const cell = (row: HTMLElement, index: number) =>
  within(row).getAllByRole('textbox')[index] as HTMLInputElement;
const unit = (name: string | RegExp) => screen.getByRole('radio', { name });

async function showMarch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Earlier/ }));
  expect(screen.getByText(/Mar 26 – Feb 27/)).toBeTruthy();
}

describe('the reference cell, A. Okafor in March 2026', () => {
  it('is out of the default window (Apr 26 – Mar 27) and reachable one month earlier', async () => {
    const { user } = await setup();
    expect(screen.getByText(/Apr 26 – Mar 27/)).toBeTruthy();
    await showMarch(user);
    expect(cell(personRow('001'), 0).value).toBe('0.50');
  });

  it('shows 0.50 PM, 88.00 h, 50.0 % and 7,880.00 EUR in each unit', async () => {
    const { user } = await setup();
    await showMarch(user);
    const row = personRow('001');
    expect(cell(row, 0).value).toBe('0.50');
    await user.click(unit('Hours'));
    expect(cell(row, 0).value).toBe('88.00');
    await user.click(unit('% of capacity'));
    expect(cell(row, 0).value).toBe('50.0');
    await user.click(unit(/Cost \(EUR\)/));
    expect(cell(row, 0).value).toBe('7,880.00');
  });

  it('switching units ten times, then back, leaves the stored value untouched and writes nothing', async () => {
    const repository = createMemoryPlanRepository(seed);
    const write = vi.spyOn(repository, 'setAllocationAmount');
    const { user } = await setup({ repository });
    await showMarch(user);
    for (let i = 0; i < 10; i += 1) {
      for (const name of [/Cost/, 'Hours', '% of capacity', 'Person-months'])
        await user.click(unit(name));
    }
    expect(cell(personRow('001'), 0).value).toBe('0.50');
    expect(write).not.toHaveBeenCalled();
    const stored = (await repository.load()).allocations.find((a) => a.id === 'alloc-001');
    expect(stored).toMatchObject({ amount: 0.5, seq: 1 });
  });

  it('typing 7,880.00 in the cost view leaves it at 0.50 person-months and writes nothing', async () => {
    const repository = createMemoryPlanRepository(seed);
    const write = vi.spyOn(repository, 'setAllocationAmount');
    const { user } = await setup({ repository });
    await showMarch(user);
    await user.click(unit(/Cost/));
    const input = cell(personRow('001'), 0);
    await user.click(input);
    await user.clear(input);
    await user.type(input, '7,880.00');
    await user.tab();
    expect(write).not.toHaveBeenCalled();
    await user.click(unit('Person-months'));
    expect(cell(personRow('001'), 0).value).toBe('0.50');
  });

  it('typing 7880 (different text, same money) keeps it at 0.50 within rounding', async () => {
    const repository = createMemoryPlanRepository(seed);
    const { user } = await setup({ repository });
    await showMarch(user);
    await user.click(unit(/Cost/));
    const input = cell(personRow('001'), 0);
    await user.click(input);
    await user.clear(input);
    await user.type(input, '7880');
    await user.tab();
    await waitFor(async () =>
      expect(
        (await repository.load()).allocations.find((a) => a.id === 'alloc-001')?.seq,
      ).toBeGreaterThan(720),
    );
    const stored = (await repository.load()).allocations.find((a) => a.id === 'alloc-001');
    expect(stored?.amount).toBeCloseTo(0.5, 10);
    await user.click(unit('Person-months'));
    expect(cell(personRow('001'), 0).value).toBe('0.50');
  });

  it('turns a cost edit into person-months through the blended rate: EUR 3,940.00 is 0.25 PM', async () => {
    const repository = createMemoryPlanRepository(seed);
    const { user } = await setup({ repository });
    await showMarch(user);
    await user.click(unit(/Cost/));
    const input = cell(personRow('001'), 0);
    await user.click(input);
    await user.clear(input);
    await user.type(input, '3,940.00');
    await user.tab();
    await waitFor(async () =>
      expect(
        (await repository.load()).allocations.find((a) => a.id === 'alloc-001')?.amount,
      ).toBeCloseTo(0.25, 10),
    );
  });
});

describe('editing', () => {
  it('saves a person-month edit, announces it, and reflects it in derived rows and totals', async () => {
    const { user, published, repository } = await setup();
    const input = cell(personRow('016'), 1); // emp-016, May 26 (second month shown)
    const before = input.value;
    await user.click(input);
    await user.clear(input);
    await user.type(input, '0.9');
    await user.tab();
    await waitFor(() => expect(published).toHaveLength(1));
    expect(published[0]).toMatchObject({
      type: 'allocation:changed',
      employeeId: 'emp-016',
      month: '2026-05',
    });
    expect(cell(personRow('016'), 1).value).toBe('0.90');
    expect(before).not.toBe('0.90');
    const stored = (await repository.load()).allocations.find(
      (a) => a.employeeId === 'emp-016' && a.month === '2026-05' && a.breakdownItemId === 'wbs-012',
    );
    expect(stored?.amount).toBeCloseTo(0.9, 10);
    expect(stored?.seq).toBeGreaterThan(720);
  });

  it.each(['abc', '-1', '1e3', ''])(
    'refuses %j with a message and writes nothing',
    async (typed) => {
      const repository = createMemoryPlanRepository(seed);
      const write = vi.spyOn(repository, 'setAllocationAmount');
      const { user } = await setup({ repository });
      const input = cell(personRow('016'), 1);
      await user.click(input);
      await user.clear(input);
      if (typed) await user.type(input, typed);
      await user.tab();
      expect((await screen.findByRole('alert')).textContent).toMatch(/not an amount/);
      expect(write).not.toHaveBeenCalled();
    },
  );

  it('makes parent rows derived and read-only, with inputs only on person cells', async () => {
    await setup();
    const parentRow = grid().querySelector('tr[data-kind="parent"]') as HTMLElement;
    expect(within(parentRow).queryAllByRole('textbox')).toHaveLength(0);
    const leafRow = grid().querySelector('tr[data-kind="leaf"]') as HTMLElement;
    expect(within(leafRow).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(parentRow).getByText('derived')).toBeTruthy();
  });

  it('adds a person to a leaf, who then gets an editable row', async () => {
    const { user } = await setup();
    const addRow = grid().querySelector(
      'tr[data-kind="add-person"][data-item="wbs-013"]',
    ) as HTMLElement; // an empty leaf
    await user.selectOptions(within(addRow).getByRole('combobox'), 'emp-060');
    await user.click(within(addRow).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(personRow('060', 'wbs-013')).toBeTruthy());
    expect(cell(personRow('060', 'wbs-013'), 0).value).toBe('0.00');
  });
});

describe('over capacity (Milan Brandt, June 2026)', () => {
  const brandtJune = 2; // Apr, May, Jun

  it('flags his cell and names the most recently edited allocation, which is in another project', async () => {
    await setup();
    const june = cell(personRow('003'), brandtJune).closest('td') as HTMLElement;
    expect(june.getAttribute('data-over')).toBe('true');
    expect(june.textContent).toContain('†');
    const list = screen.getByRole('region', { name: 'Over capacity' });
    const entry = within(list)
      .getByText(/Milan Brandt/)
      .closest('li') as HTMLElement;
    expect(entry.textContent).toContain('1.18 person-months');
    expect(entry.textContent).toContain(
      'Client Portal Rebuild › Account management › Core build › Implementation', // alloc-073, the later seq
    );
  });

  it('does not block the edit: it saves and warns, naming the culprit', async () => {
    const { user, repository } = await setup();
    const input = cell(personRow('003'), 0); // Brandt, April, no other load there
    await user.click(input);
    await user.clear(input);
    await user.type(input, '1.5');
    await user.tab();
    const status = await screen.findByText(/over capacity in Apr 26/);
    expect(status.textContent).toContain('Saved');
    expect(status.textContent).toContain('Most recently edited');
    const stored = (await repository.load()).allocations.find(
      (a) => a.employeeId === 'emp-003' && a.month === '2026-04' && a.breakdownItemId === 'wbs-012',
    );
    expect(stored?.amount).toBeCloseTo(1.5, 10);
  });

  it('changes the named culprit when the other allocation is edited afterwards', async () => {
    const { user } = await setup();
    const list = () => screen.getByRole('region', { name: 'Over capacity' });
    expect(
      within(list())
        .getByText(/Milan Brandt/)
        .closest('li')?.textContent,
    ).toContain('Client Portal Rebuild');
    const input = cell(personRow('003'), brandtJune); // alloc-050, in this project
    await user.click(input);
    await user.clear(input);
    await user.type(input, '0.60');
    await user.tab();
    await waitFor(() =>
      expect(
        within(list())
          .getByText(/Milan Brandt/)
          .closest('li')?.textContent,
      ).toContain('Ledger Consolidation › Ledger migration › Discovery › Design'),
    );
    const june = cell(personRow('003'), brandtJune).closest('td') as HTMLElement;
    expect(june.getAttribute('data-culprit')).toBe('true');
  });

  it('clears the flag when the total comes back within capacity', async () => {
    const { user } = await setup();
    const input = cell(personRow('003'), brandtJune);
    await user.click(input);
    await user.clear(input);
    await user.type(input, '0.30');
    await user.tab();
    await waitFor(() =>
      expect(
        cell(personRow('003'), brandtJune).closest('td')?.getAttribute('data-over'),
      ).toBeNull(),
    );
  });
});

describe('totals reconcile in every unit', () => {
  const numbers = (row: Element): number[] =>
    [...row.querySelectorAll('td')].map((td) => {
      const input = td.querySelector('input');
      return Number((input ? input.value : (td.textContent ?? '')).replace(/[^0-9.-]/g, ''));
    });

  it.each([
    ['Person-months', 100],
    ['Hours', 100],
    ['% of capacity', 10],
    [/Cost/, 100],
  ] as const)('every row total equals the sum of its shown cells in %s', async (name, scale) => {
    const { user } = await setup();
    await user.click(unit(name));
    const rows = [
      ...grid().querySelectorAll(
        'tbody tr[data-kind="person"], tbody tr[data-kind="leaf"], tbody tr[data-kind="parent"]',
      ),
    ];
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      const values = numbers(row);
      const total = values.at(-1) ?? 0;
      const cells = values.slice(0, -1);
      const sum = cells.reduce((a, b) => a + Math.round(b * scale), 0);
      expect(Math.round(total * scale), row.textContent ?? '').toBe(sum);
    }
    const footer = grid().querySelector('tfoot tr') as HTMLElement;
    const values = numbers(footer);
    expect(Math.round((values.at(-1) ?? 0) * scale)).toBe(
      values.slice(0, -1).reduce((a, b) => a + Math.round(b * scale), 0),
    );
  });
});

describe('People availability and live rates', () => {
  it('disables hours and cost, and says why, when People is unavailable; person-months still edit', async () => {
    const repository = createMemoryPlanRepository(seed);
    const { user } = await setup({ repository, props: { employeeQuery: null, rateQuery: null } });
    expect(await screen.findByText(/People is not available/)).toBeTruthy();
    expect((unit('Hours') as HTMLInputElement).disabled).toBe(true);
    expect((unit(/Cost/) as HTMLInputElement).disabled).toBe(true);
    expect((unit('% of capacity') as HTMLInputElement).disabled).toBe(false);
    const input = cell(personRow('016'), 1);
    await user.click(input);
    await user.clear(input);
    await user.type(input, '0.4');
    await user.tab();
    await waitFor(() => expect(input.value).toBe('0.40'));
  });

  it('prices from rates it re-reads when People announces a change, with no reload', async () => {
    const fixture: PeopleFixture = structuredClone(peopleFixture);
    const live: RateQuery = createFixtureRateQuery(fixture);
    let rateOverride = 95;
    const rateQuery: RateQuery = {
      getRates: async (ids) => {
        const result = await live.getRates(ids);
        if (result.status !== 'ok') return result;
        const edited = Object.fromEntries(
          Object.entries(result.data).map(([id, records]) => [
            id,
            records.map((r) =>
              r.employeeId === 'emp-001' && r.validFrom === '2026-03-12'
                ? { ...r, hourlyCost: rateOverride }
                : r,
            ),
          ]),
        );
        return { status: 'ok', data: edited };
      },
    };
    const { user, emit } = await setup({ props: { rateQuery } });
    await showMarch(user);
    await user.click(unit(/Cost/));
    expect(cell(personRow('001'), 0).value).toBe('7,880.00'); // 8 x 4 x 80 + 14 x 4 x 95

    rateOverride = 100; // People edits the 12 March rate to 100 and announces it
    act(() => emit({ type: 'rate:changed', employeeId: 'emp-001' }));
    await waitFor(() => expect(cell(personRow('001'), 0).value).toBe('8,160.00')); // 2,560 + 14 x 4 x 100 = 8,160
    expect(unit(/Cost/)).toBeTruthy(); // still on the same screen
  });

  it('marks a month with no covering rate, and refuses cost entry there', async () => {
    const fixture: PeopleFixture = {
      ...peopleFixture,
      rateRecords: peopleFixture.rateRecords.filter((r) => r.employeeId !== 'emp-001'),
    };
    const { user } = await setup({
      props: {
        employeeQuery: createFixtureEmployeeQuery(fixture),
        rateQuery: createFixtureRateQuery(fixture),
      },
    });
    await showMarch(user);
    await user.click(unit(/Cost/));
    const td = cell(personRow('001'), 0).closest('td') as HTMLElement;
    expect(td.getAttribute('data-coverage')).toBe('none');
    expect(cell(personRow('001'), 0).disabled).toBe(true);
    expect(cell(personRow('001'), 0).value).toBe('0.00');
    await user.click(unit('Person-months')); // other units still work
    expect(cell(personRow('001'), 0).disabled).toBe(false);
  });

  it('shows cost in the selected display currency', async () => {
    const { user } = await setup({ props: { currency: { code: 'USD', perEur: 1.08 } } });
    await showMarch(user);
    await user.click(unit(/Cost \(USD\)/));
    expect(cell(personRow('001'), 0).value).toBe('8,510.40'); // 7,880 x 1.08
  });
});

describe('reset demo data', () => {
  it('restores the shipped plan after confirmation and tells People which person-months may have changed', async () => {
    const { user, published, repository } = await setup();
    const input = cell(personRow('016'), 1);
    await user.click(input);
    await user.clear(input);
    await user.type(input, '0.9');
    await user.tab();
    await waitFor(() => expect(cell(personRow('016'), 1).value).toBe('0.90'));
    published.length = 0;

    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    expect(screen.getByText(/Your edits will be lost/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Yes, reset' }));
    await waitFor(() => expect(cell(personRow('016'), 1).value).toBe('0.20'));
    expect(published.length).toBeGreaterThan(0);
    const restored = (await repository.load()).allocations;
    expect(restored).toHaveLength(720);
    expect(restored.every((a) => a.seq <= 720)).toBe(true);
  });

  it('keeps everything if the confirmation is declined', async () => {
    const { user, published } = await setup();
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    await user.click(screen.getByRole('button', { name: 'Keep my data' }));
    expect(published).toEqual([]);
    expect(screen.getByRole('button', { name: 'Reset demo data' })).toBeTruthy();
  });
});

describe('bursts of events', () => {
  it('collapses many rate:changed events into one batched read of rates', async () => {
    const inner = createFixtureRateQuery(peopleFixture);
    const calls: (readonly string[])[] = [];
    const rateQuery: RateQuery = {
      getRates: (ids) => {
        calls.push(ids);
        return inner.getRates(ids);
      },
    };
    const { emit } = await setup({ props: { rateQuery } });
    await waitFor(() => expect(calls).toHaveLength(1)); // the full read on mount
    expect(calls[0]).toHaveLength(60);
    act(() => {
      for (let i = 1; i <= 40; i += 1) {
        emit({ type: 'rate:changed', employeeId: `emp-${String(i).padStart(3, '0')}` });
      }
    });
    await waitFor(() => expect(calls).toHaveLength(2));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toHaveLength(2);
    expect(calls[1]).toHaveLength(40);
  });
});
