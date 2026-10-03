import type { PeopleEventBus } from '../ports/eventBus';

/**
 * Standalone mode has no shell and no other app, so nothing publishes the events People
 * listens for and nobody listens for the ones it publishes. The bus is a null object.
 */
export const silentEventBus: PeopleEventBus = {
  publish: () => undefined,
  subscribe: () => () => undefined,
};
