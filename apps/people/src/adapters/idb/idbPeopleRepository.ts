import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { sortedHistory } from '../../domain/rateHistory';
import type { Employee, RateRecord } from '../../domain/model';
import type { PeopleRepository } from '../../ports/peopleRepository';
import { assertOwnedBy } from '../assertOwnedBy';
import type { PeopleSeed } from '../seed/types';

const PEOPLE_DB_NAME = 'baseline-people';
const SCHEMA_VERSION = 1;

interface PeopleDb extends DBSchema {
  employees: { key: string; value: Employee };
  rateRecords: { key: string; value: RateRecord; indexes: { byEmployee: string } };
  meta: { key: string; value: number };
}

type Db = IDBPDatabase<PeopleDb>;

async function writeSeed(db: Db, seed: PeopleSeed): Promise<void> {
  const tx = db.transaction(['employees', 'rateRecords', 'meta'], 'readwrite');
  await Promise.all([tx.objectStore('employees').clear(), tx.objectStore('rateRecords').clear()]);
  await Promise.all([
    ...seed.employees.map((e) => tx.objectStore('employees').put(e)),
    ...seed.rateRecords.map((r) => tx.objectStore('rateRecords').put(r)),
    tx.objectStore('meta').put(seed.seedVersion, 'seedVersion'),
  ]);
  await tx.done;
}

/**
 * Opens (creating and seeding on first use) People's database. A reload keeps edits: the
 * seed is only written when the stored seedVersion differs from the one shipped.
 */
export async function openPeopleRepository(
  seed: PeopleSeed,
  databaseName: string = PEOPLE_DB_NAME,
): Promise<PeopleRepository> {
  const db = await openDB<PeopleDb>(databaseName, SCHEMA_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('employees', { keyPath: 'id' });
        database
          .createObjectStore('rateRecords', { keyPath: 'id' })
          .createIndex('byEmployee', 'employeeId');
        database.createObjectStore('meta');
      }
    },
  });

  if ((await db.get('meta', 'seedVersion')) !== seed.seedVersion) await writeSeed(db, seed);

  return {
    listEmployees: () => db.getAll('employees'),

    async getRates(employeeIds) {
      const entries = await Promise.all(
        employeeIds.map(
          async (id) =>
            [id, sortedHistory(await db.getAllFromIndex('rateRecords', 'byEmployee', id))] as const,
        ),
      );
      return Object.fromEntries(entries);
    },

    async replaceRates(employeeId, records) {
      assertOwnedBy(employeeId, records);
      const tx = db.transaction('rateRecords', 'readwrite');
      const store = tx.objectStore('rateRecords');
      const existing = await store.index('byEmployee').getAllKeys(employeeId);
      await Promise.all([
        ...existing.map((key) => store.delete(key)),
        ...records.map((record) => store.put(record)),
      ]);
      await tx.done;
    },

    reset: () => writeSeed(db, seed),
  };
}
