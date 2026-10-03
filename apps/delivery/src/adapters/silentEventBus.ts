import type { DeliveryEventBus } from '../ports/eventBus';

/**
 * Standalone mode has no shell and no other app, so nothing publishes the events Delivery
 * listens for and nobody listens for the ones it publishes. The bus is a null object.
 */
export const silentEventBus: DeliveryEventBus = {
  publish: () => undefined,
  subscribe: () => () => undefined,
};
