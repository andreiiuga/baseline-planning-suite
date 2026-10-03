export type Unsubscribe = () => void;

/** Anything with a literal `type`. Payload shapes belong to the app that publishes the event. */
export interface BusEvent {
  readonly type: string;
}

/**
 * The shell hosts the bus but does not know any app's events: each remote declares the
 * events it publishes and consumes in its own ports, and this generic interface is
 * structurally compatible with all of them. Events are notifications ("a rate changed"),
 * never data transfer: subscribers re-read through a port, so a stale or reordered event
 * cannot make them act on old values.
 */
export interface EventBus {
  publish<E extends BusEvent>(event: E): void;
  subscribe<E extends BusEvent>(type: E['type'], handler: (event: E) => void): Unsubscribe;
}

type ErasedHandler = (event: BusEvent) => void;

export function createEventBus(
  onHandlerError: (type: string, error: unknown) => void = (type, error) => {
    console.error(`[bus] a handler for "${type}" threw`, error);
  },
): EventBus {
  const handlersByType = new Map<string, Set<ErasedHandler>>();

  return {
    publish(event) {
      const handlers = handlersByType.get(event.type);
      if (!handlers) return;
      // Snapshot, so handlers may subscribe or unsubscribe while the event is delivered.
      for (const handler of [...handlers]) {
        if (!handlers.has(handler)) continue; // unsubscribed by an earlier handler
        try {
          handler(event);
        } catch (error) {
          onHandlerError(event.type, error); // one broken subscriber must not stop the others
        }
      }
    },

    subscribe(type, handler) {
      const set = handlersByType.get(type) ?? new Set<ErasedHandler>();
      // The single place type information is erased: the handler is only ever called with
      // events published under the `type` it subscribed to.
      const erased = handler as unknown as ErasedHandler;
      set.add(erased);
      handlersByType.set(type, set);
      return () => void set.delete(erased);
    },
  };
}
