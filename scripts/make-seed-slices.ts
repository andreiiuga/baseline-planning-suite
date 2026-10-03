import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSlices, type RawSeed } from './seed-slices';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Where each generated slice is committed. Each app owns only its own folder. */
export const SLICE_PATHS = {
  people: 'apps/people/src/adapters/seed/people-seed.json',
  peopleAllocationTotals: 'apps/people/src/adapters/seed/allocation-totals-fixture.json',
  delivery: 'apps/delivery/src/adapters/seed/delivery-seed.json',
  deliveryPeopleFixture: 'apps/delivery/src/adapters/seed/people-fixture.json',
} as const;

export const SEED_PATH = 'docs/baseline-seed.json';

export function renderSlices(): Record<keyof typeof SLICE_PATHS, string> {
  const raw = JSON.parse(readFileSync(resolve(root, SEED_PATH), 'utf8')) as RawSeed;
  const slices = buildSlices(raw);
  const render = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
  return {
    people: render(slices.people),
    peopleAllocationTotals: render(slices.peopleAllocationTotals),
    delivery: render(slices.delivery),
    deliveryPeopleFixture: render(slices.deliveryPeopleFixture),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rendered = renderSlices();
  for (const key of Object.keys(SLICE_PATHS) as (keyof typeof SLICE_PATHS)[]) {
    const target = resolve(root, SLICE_PATHS[key]);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, rendered[key]);
    console.log(`wrote ${SLICE_PATHS[key]}`);
  }
}
