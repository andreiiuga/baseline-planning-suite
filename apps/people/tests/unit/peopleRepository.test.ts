import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createMemoryPeopleRepository } from '../../src/adapters/memory/memoryPeopleRepository';
import { openPeopleRepository } from '../../src/adapters/idb/idbPeopleRepository';
import type { PeopleSeed } from '../../src/adapters/seed/types';
import type { RateRecord } from '../../src/domain/model';
import type { PeopleRepository } from '../../src/ports/peopleRepository';
import seedJson from '../../src/adapters/seed/people-seed.json';

const seed: PeopleSeed = seedJson;
let counter = 0;
const freshName = () => `people-test-${(counter += 1)}`;

/** The same behavioural suite runs against every implementation of the port. */
function repositoryContract(
  label: string,
  create: (name: string) => Promise<PeopleRepository>,
): void {
  describe(`PeopleRepository (${label})`, () => {
    it('starts with the seeded employees and rates', async () => {
      const repo = await create(freshName());
      expect(await repo.listEmployees()).toHaveLength(60);
      const rates = await repo.getRates(['emp-001']);
      expect(rates['emp-001']?.map((r) => [r.validFrom, r.hourlyCost])).toEqual([
        ['2025-01-01', 80],
        ['2026-03-12', 95],
      ]);
    });

    it('returns an empty history for an unknown employee', async () => {
      const repo = await create(freshName());
      expect(await repo.getRates(['ghost'])).toEqual({ ghost: [] });
    });

    it('returns histories sorted by validFrom', async () => {
      const repo = await create(freshName());
      const records: RateRecord[] = [
        { id: 'late', employeeId: 'emp-001', validFrom: '2030-01-01', hourlyCost: 1 },
        { id: 'early', employeeId: 'emp-001', validFrom: '2020-01-01', hourlyCost: 2 },
      ];
      await repo.replaceRates('emp-001', records);
      const history = (await repo.getRates(['emp-001']))['emp-001'] ?? [];
      expect(history.map((r) => r.id)).toEqual(['early', 'late']);
    });

    it('replaces one employee history and leaves everyone else alone', async () => {
      const repo = await create(freshName());
      const before = await repo.getRates(['emp-002']);
      await repo.replaceRates('emp-001', [
        { id: 'only', employeeId: 'emp-001', validFrom: '2026-01-01', hourlyCost: 99 },
      ]);
      const after = await repo.getRates(['emp-001', 'emp-002']);
      expect(after['emp-001']?.map((r) => r.id)).toEqual(['only']);
      expect(after['emp-002']).toEqual(before['emp-002']);
    });

    it('can leave an employee with no rates at all', async () => {
      const repo = await create(freshName());
      await repo.replaceRates('emp-001', []);
      expect(await repo.getRates(['emp-001'])).toEqual({ 'emp-001': [] });
    });

    it('refuses records that belong to someone else, writing nothing', async () => {
      const repo = await create(freshName());
      const before = await repo.getRates(['emp-001']);
      await expect(
        repo.replaceRates('emp-001', [
          { id: 'x', employeeId: 'emp-002', validFrom: '2026-01-01', hourlyCost: 1 },
        ]),
      ).rejects.toThrow(RangeError);
      expect(await repo.getRates(['emp-001'])).toEqual(before);
    });

    it('does not let callers mutate stored data through returned objects', async () => {
      const repo = await create(freshName());
      const first = await repo.getRates(['emp-001']);
      first['emp-001']?.splice(0);
      expect((await repo.getRates(['emp-001']))['emp-001']).toHaveLength(2);
    });

    it('restores the seed on reset', async () => {
      const repo = await create(freshName());
      await repo.replaceRates('emp-001', []);
      await repo.reset();
      expect((await repo.getRates(['emp-001']))['emp-001']).toHaveLength(2);
    });
  });
}

repositoryContract('in memory', () => Promise.resolve(createMemoryPeopleRepository(seed)));
repositoryContract('IndexedDB', (name) => openPeopleRepository(seed, name));

describe('PeopleRepository (IndexedDB) persistence', () => {
  it('keeps edits across a reload (reopening the same database)', async () => {
    const name = freshName();
    const first = await openPeopleRepository(seed, name);
    await first.replaceRates('emp-001', [
      { id: 'kept', employeeId: 'emp-001', validFrom: '2026-02-02', hourlyCost: 77 },
    ]);
    const second = await openPeopleRepository(seed, name);
    expect((await second.getRates(['emp-001']))['emp-001']?.map((r) => r.id)).toEqual(['kept']);
  });

  it('reseeds when the shipped seedVersion changes', async () => {
    const name = freshName();
    const first = await openPeopleRepository(seed, name);
    await first.replaceRates('emp-001', []);
    const second = await openPeopleRepository({ ...seed, seedVersion: seed.seedVersion + 1 }, name);
    expect((await second.getRates(['emp-001']))['emp-001']).toHaveLength(2);
  });
});
