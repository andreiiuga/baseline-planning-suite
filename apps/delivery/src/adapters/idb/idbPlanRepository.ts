import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { TreeState } from '../../domain/breakdown';
import type { Allocation, BreakdownItem, Project } from '../../domain/model';
import type { AllocationCell, PlanRepository } from '../../ports/planRepository';
import { assertValidAmount, newAllocationId, sameCell } from '../allocationCells';
import type { DeliverySeed } from '../seed/types';

const DELIVERY_DB_NAME = 'baseline-delivery';
const SCHEMA_VERSION = 1;

interface DeliveryDb extends DBSchema {
  projects: { key: string; value: Project };
  breakdownItems: { key: string; value: BreakdownItem; indexes: { byProject: string } };
  allocations: {
    key: string;
    value: Allocation;
    /** Powers the cross-project capacity sum: all of a person's cells, any project. */
    indexes: { byEmployeeMonth: [string, string]; byCell: [string, string, string] };
  };
  /** seedVersion and the last issued seq. */
  meta: { key: string; value: number };
}

type Db = IDBPDatabase<DeliveryDb>;

async function writeSeed(db: Db, seed: DeliverySeed): Promise<void> {
  const tx = db.transaction(['projects', 'breakdownItems', 'allocations', 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('projects').clear(),
    tx.objectStore('breakdownItems').clear(),
    tx.objectStore('allocations').clear(),
  ]);
  await Promise.all([
    ...seed.projects.map((p) => tx.objectStore('projects').put(p)),
    ...seed.breakdownItems.map((i) => tx.objectStore('breakdownItems').put(i)),
    ...seed.allocations.map((a) => tx.objectStore('allocations').put(a)),
    tx.objectStore('meta').put(seed.seedVersion, 'seedVersion'),
    tx.objectStore('meta').put(
      seed.allocations.reduce((max, a) => Math.max(max, a.seq), 0),
      'lastSeq',
    ),
  ]);
  await tx.done;
}

/**
 * Opens (creating and seeding on first use) Delivery's database. The seed is written only
 * when the stored seedVersion differs from the shipped one, so a reload keeps edits.
 */
export async function openPlanRepository(
  seed: DeliverySeed,
  databaseName: string = DELIVERY_DB_NAME,
): Promise<PlanRepository> {
  const db = await openDB<DeliveryDb>(databaseName, SCHEMA_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('projects', { keyPath: 'id' });
        database
          .createObjectStore('breakdownItems', { keyPath: 'id' })
          .createIndex('byProject', 'projectId');
        const allocations = database.createObjectStore('allocations', { keyPath: 'id' });
        allocations.createIndex('byEmployeeMonth', ['employeeId', 'month']);
        allocations.createIndex('byCell', ['breakdownItemId', 'employeeId', 'month']);
        database.createObjectStore('meta');
      }
    },
  });

  if ((await db.get('meta', 'seedVersion')) !== seed.seedVersion) await writeSeed(db, seed);

  return {
    async load() {
      const [projects, items, allocations] = await Promise.all([
        db.getAll('projects'),
        db.getAll('breakdownItems'),
        db.getAll('allocations'),
      ]);
      return { projects, items, allocations };
    },

    async saveTree(next: TreeState) {
      const tx = db.transaction(['breakdownItems', 'allocations'], 'readwrite');
      const itemStore = tx.objectStore('breakdownItems');
      const allocationStore = tx.objectStore('allocations');
      const [storedItems, storedAllocations] = await Promise.all([
        itemStore.getAll(),
        allocationStore.getAll(),
      ]);
      const nextItemIds = new Set(next.items.map((i) => i.id));
      const nextAllocationIds = new Set(next.allocations.map((a) => a.id));
      const storedItemJson = new Map(storedItems.map((i) => [i.id, JSON.stringify(i)]));
      const storedAllocationJson = new Map(storedAllocations.map((a) => [a.id, JSON.stringify(a)]));
      await Promise.all([
        ...storedItems.filter((i) => !nextItemIds.has(i.id)).map((i) => itemStore.delete(i.id)),
        ...storedAllocations
          .filter((a) => !nextAllocationIds.has(a.id))
          .map((a) => allocationStore.delete(a.id)),
        ...next.items
          .filter((i) => storedItemJson.get(i.id) !== JSON.stringify(i))
          .map((i) => itemStore.put(i)),
        ...next.allocations
          .filter((a) => storedAllocationJson.get(a.id) !== JSON.stringify(a))
          .map((a) => allocationStore.put(a)),
      ]);
      await tx.done;
    },

    async setAllocationAmount(cell: AllocationCell, amount: number) {
      assertValidAmount(amount);
      const tx = db.transaction(['allocations', 'meta'], 'readwrite');
      const allocationStore = tx.objectStore('allocations');
      const metaStore = tx.objectStore('meta');
      const seq = ((await metaStore.get('lastSeq')) ?? 0) + 1;
      const existing = await allocationStore
        .index('byCell')
        .get([cell.breakdownItemId, cell.employeeId, cell.month]);
      const stored: Allocation =
        existing && sameCell(existing, cell)
          ? { ...existing, amount, seq }
          : { id: newAllocationId(seq), ...cell, amount, seq };
      await Promise.all([allocationStore.put(stored), metaStore.put(seq, 'lastSeq')]);
      await tx.done;
      return stored;
    },

    async listAllocationsForEmployees(employeeIds) {
      const perPerson = await Promise.all(
        employeeIds.map((id) =>
          db.getAllFromIndex(
            'allocations',
            'byEmployeeMonth',
            IDBKeyRange.bound([id, ''], [id, '￿']),
          ),
        ),
      );
      return perPerson.flat();
    },

    reset: () => writeSeed(db, seed),
  };
}
