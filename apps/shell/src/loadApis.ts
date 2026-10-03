import { loadRemote } from '@module-federation/runtime';
import type { DeliveryApi, PeopleApi } from './contracts';
import { withTimeout } from './timeout';

const API_TIMEOUT_MS = 5000;

export interface LoadedApis {
  readonly people: PeopleApi | null;
  readonly delivery: DeliveryApi | null;
}

type ModuleLoader = <T>(id: string) => Promise<T | null | undefined>;

const loadFromFederation: ModuleLoader = (id) => loadRemote(id);

/**
 * Loads each remote's `api` module eagerly and independently. A failure becomes null, never a
 * rejection: the shell must stay alive when a remote is down.
 */
export async function loadApis(load: ModuleLoader = loadFromFederation): Promise<LoadedApis> {
  const attempt = async <T>(name: string): Promise<T | null> => {
    try {
      return (await withTimeout(load<T>(`${name}/api`), API_TIMEOUT_MS, `${name}/api`)) ?? null;
    } catch (error) {
      console.warn(`[shell] ${name}/api is unavailable`, error);
      return null;
    }
  };
  const [people, delivery] = await Promise.all([
    attempt<PeopleApi>('people'),
    attempt<DeliveryApi>('delivery'),
  ]);
  return { people, delivery };
}
