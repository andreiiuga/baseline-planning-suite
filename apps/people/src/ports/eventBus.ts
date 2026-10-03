export type Unsubscribe = () => void;

/** Owned by People: published after every successful rate save so Delivery can re-read. */
export interface RateChanged {
  readonly type: 'rate:changed';
  readonly employeeId: string;
}

/** Owned by Delivery. People only needs to know which person's totals to re-read. */
export interface AllocationChanged {
  readonly type: 'allocation:changed';
  readonly employeeId: string;
  /** YYYY-MM */
  readonly month: string;
}

/** People's view of the bus the shell provides. Events are notifications, never data. */
export interface PeopleEventBus {
  publish(event: RateChanged): void;
  subscribe(
    type: AllocationChanged['type'],
    handler: (event: AllocationChanged) => void,
  ): Unsubscribe;
}
