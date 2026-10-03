import type { PeopleRepository } from '../../ports/peopleRepository';
import seedJson from '../seed/people-seed.json';
import type { PeopleSeed } from '../seed/types';
import { openPeopleRepository } from './idbPeopleRepository';

const seed: PeopleSeed = seedJson;
let opening: Promise<PeopleRepository> | undefined;

/**
 * One repository per page load, shared by this app's UI and the queries it exposes to other
 * apps. Both live in the same federated container, so they get the same module instance.
 */
export function getPeopleRepository(): Promise<PeopleRepository> {
  opening ??= openPeopleRepository(seed);
  return opening;
}
