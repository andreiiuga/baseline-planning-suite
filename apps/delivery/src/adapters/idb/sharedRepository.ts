import type { PlanRepository } from '../../ports/planRepository';
import seedJson from '../seed/delivery-seed.json';
import type { DeliverySeed } from '../seed/types';
import { openPlanRepository } from './idbPlanRepository';

const seed: DeliverySeed = seedJson;
let opening: Promise<PlanRepository> | undefined;

/**
 * One repository per page load, shared by this app's UI and the totals it exposes to other
 * apps. Both live in the same federated container, so they get the same module instance.
 */
export function getPlanRepository(): Promise<PlanRepository> {
  opening ??= openPlanRepository(seed);
  return opening;
}
