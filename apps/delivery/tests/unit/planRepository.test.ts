import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createItem, deleteItem, type TreeState } from '../../src/domain/breakdown';
import { openPlanRepository } from '../../src/adapters/idb/idbPlanRepository';
import { createMemoryPlanRepository } from '../../src/adapters/memory/memoryPlanRepository';
import type { DeliverySeed } from '../../src/adapters/seed/types';
import type { PlanRepository } from '../../src/ports/planRepository';
import seedJson from '../../src/adapters/seed/delivery-seed.json';

const seed: DeliverySeed = seedJson;
let counter = 0;
const freshName = () => `delivery-test-${(counter += 1)}`;
const treeOf = async (repo: PlanRepository): Promise<TreeState> => {
  const { items, allocations } = await repo.load();
  return { items, allocations };
};
const totalPm = (state: TreeState) => state.allocations.reduce((sum, a) => sum + a.amount, 0);

const okafor = { breakdownItemId: 'wbs-012', employeeId: 'emp-001', month: '2026-03' };

/** The same behavioural suite runs against every implementation of the port. */
function repositoryContract(
  label: string,
  create: (name: string) => Promise<PlanRepository>,
): void {
  describe(`PlanRepository (${label})`, () => {
    it('starts with the seeded plan', async () => {
      const snapshot = await (await create(freshName())).load();
      expect([
        snapshot.projects.length,
        snapshot.items.length,
        snapshot.allocations.length,
      ]).toEqual([4, 90, 720]);
    });

    describe('setAllocationAmount', () => {
      it('updates an existing cell in place and stamps the next seq', async () => {
        const repo = await create(freshName());
        const updated = await repo.setAllocationAmount(okafor, 0.75);
        expect(updated).toMatchObject({ id: 'alloc-001', amount: 0.75, seq: 721 });
        const { allocations } = await repo.load();
        expect(allocations).toHaveLength(720);
        expect(allocations.find((a) => a.id === 'alloc-001')?.amount).toBe(0.75);
      });

      it('creates the allocation when the cell had none', async () => {
        const repo = await create(freshName());
        const cell = { breakdownItemId: 'wbs-012', employeeId: 'emp-060', month: '2027-03' };
        const created = await repo.setAllocationAmount(cell, 0.4);
        expect(created).toMatchObject({ ...cell, amount: 0.4, seq: 721 });
        expect((await repo.load()).allocations).toHaveLength(721);
      });

      it('makes each edit the most recent one', async () => {
        const repo = await create(freshName());
        const first = await repo.setAllocationAmount(okafor, 0.6);
        const second = await repo.setAllocationAmount({ ...okafor, month: '2026-04' }, 0.2);
        expect(second.seq).toBe(first.seq + 1);
        const again = await repo.setAllocationAmount(okafor, 0.7);
        expect(again.seq).toBe(second.seq + 1);
      });

      it('keeps zero as a real value instead of deleting the cell', async () => {
        const repo = await create(freshName());
        await repo.setAllocationAmount(okafor, 0);
        const { allocations } = await repo.load();
        expect(allocations.find((a) => a.id === 'alloc-001')?.amount).toBe(0);
      });

      it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', async (amount) => {
        const repo = await create(freshName());
        await expect(repo.setAllocationAmount(okafor, amount)).rejects.toThrow(RangeError);
        expect((await repo.load()).allocations.find((a) => a.id === 'alloc-001')?.amount).toBe(0.5);
      });
    });

    describe('saveTree', () => {
      it('persists a child added under an allocated leaf, with its allocations moved', async () => {
        const repo = await create(freshName());
        const before = await treeOf(repo);
        const result = createItem(before, {
          id: 'wbs-new',
          name: 'Wireframes',
          placement: { kind: 'child', parentId: 'wbs-012' },
        });
        if (!result.ok) throw new Error('create refused');
        await repo.saveTree(result.state);
        const after = await treeOf(repo);
        expect(after.items.find((i) => i.id === 'wbs-new')?.parentId).toBe('wbs-012');
        expect(after.allocations.filter((a) => a.breakdownItemId === 'wbs-012')).toEqual([]);
        expect(after.allocations).toHaveLength(720);
        expect(totalPm(after)).toBeCloseTo(totalPm(before), 10);
        // moving does not change who edited last
        expect(after.allocations.find((a) => a.id === 'alloc-001')?.seq).toBe(1);
      });

      it('persists a deleted subtree together with its allocations', async () => {
        const repo = await create(freshName());
        const before = await treeOf(repo);
        const result = deleteItem(before, 'wbs-001');
        if (!result.ok) throw new Error('delete refused');
        await repo.saveTree(result.state);
        const after = await treeOf(repo);
        expect(after.items).toHaveLength(before.items.length - result.impact.itemIds.length);
        expect(after.allocations).toHaveLength(
          before.allocations.length - result.impact.allocations.length,
        );
      });

      it('does not touch amounts or seq of allocations it did not change', async () => {
        const repo = await create(freshName());
        const edited = await repo.setAllocationAmount(okafor, 0.9);
        await repo.saveTree(await treeOf(repo));
        expect((await repo.load()).allocations.find((a) => a.id === edited.id)).toEqual(edited);
      });
    });

    describe('listAllocationsForEmployees', () => {
      it('returns a person cells across every project', async () => {
        const repo = await create(freshName());
        const found = await repo.listAllocationsForEmployees(['emp-003']);
        const expected = (await repo.load()).allocations.filter((a) => a.employeeId === 'emp-003');
        expect(found.map((a) => a.id).sort()).toEqual(expected.map((a) => a.id).sort());
        expect(found.length).toBeGreaterThan(0);
      });

      it('handles several people and unknown ids', async () => {
        const repo = await create(freshName());
        const found = await repo.listAllocationsForEmployees(['emp-003', 'emp-001', 'ghost']);
        expect(new Set(found.map((a) => a.employeeId))).toEqual(new Set(['emp-003', 'emp-001']));
        expect(await repo.listAllocationsForEmployees([])).toEqual([]);
      });
    });

    it('restores the seed on reset', async () => {
      const repo = await create(freshName());
      await repo.setAllocationAmount(okafor, 0.99);
      await repo.saveTree({ items: [], allocations: [] });
      await repo.reset();
      const snapshot = await repo.load();
      expect(snapshot.items).toHaveLength(90);
      expect(snapshot.allocations.find((a) => a.id === 'alloc-001')).toMatchObject({
        amount: 0.5,
        seq: 1,
      });
      expect((await repo.setAllocationAmount(okafor, 0.1)).seq).toBe(721);
    });

    it('does not let callers mutate stored data through returned objects', async () => {
      const repo = await create(freshName());
      const snapshot = await repo.load();
      (snapshot.allocations as unknown[]).splice(0);
      expect((await repo.load()).allocations).toHaveLength(720);
    });
  });
}

repositoryContract('in memory', () => Promise.resolve(createMemoryPlanRepository(seed)));
repositoryContract('IndexedDB', (name) => openPlanRepository(seed, name));

describe('PlanRepository (IndexedDB) persistence', () => {
  it('keeps edits and the seq counter across a reload', async () => {
    const name = freshName();
    const first = await openPlanRepository(seed, name);
    await first.setAllocationAmount(okafor, 0.8);
    const second = await openPlanRepository(seed, name);
    expect((await second.load()).allocations.find((a) => a.id === 'alloc-001')).toMatchObject({
      amount: 0.8,
      seq: 721,
    });
    expect((await second.setAllocationAmount(okafor, 0.9)).seq).toBe(722);
  });

  it('reseeds when the shipped seedVersion changes', async () => {
    const name = freshName();
    const first = await openPlanRepository(seed, name);
    await first.setAllocationAmount(okafor, 0.8);
    const second = await openPlanRepository({ ...seed, seedVersion: seed.seedVersion + 1 }, name);
    expect((await second.load()).allocations.find((a) => a.id === 'alloc-001')?.amount).toBe(0.5);
  });
});
