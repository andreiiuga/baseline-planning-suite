export type Unsubscribe = () => void;

/** Owned by Delivery: published after any allocation change, so People can re-read totals. */
export interface AllocationChanged {
  readonly type: 'allocation:changed';
  readonly employeeId: string;
  /** YYYY-MM */
  readonly month: string;
}

/** Owned by People. Delivery only needs to know which employee to re-read. */
export interface RateChanged {
  readonly type: 'rate:changed';
  readonly employeeId: string;
}

/** Delivery's view of the bus the shell provides. Events are notifications, never data. */
export interface DeliveryEventBus {
  publish(event: AllocationChanged): void;
  subscribe(type: RateChanged['type'], handler: (event: RateChanged) => void): Unsubscribe;
}
