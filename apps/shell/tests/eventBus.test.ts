import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../src/bus/eventBus';

interface RateChanged {
  readonly type: 'rate:changed';
  readonly employeeId: string;
}
interface AllocationChanged {
  readonly type: 'allocation:changed';
  readonly employeeId: string;
  readonly month: string;
}

const rateChanged = (employeeId: string): RateChanged => ({ type: 'rate:changed', employeeId });

describe('createEventBus', () => {
  it('delivers an event to every subscriber of its type', () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe<RateChanged>('rate:changed', a);
    bus.subscribe<RateChanged>('rate:changed', b);
    bus.publish(rateChanged('emp-001'));
    expect(a).toHaveBeenCalledWith(rateChanged('emp-001'));
    expect(b).toHaveBeenCalledOnce();
  });

  it('keeps event types apart', () => {
    const bus = createEventBus();
    const onRate = vi.fn();
    const onAllocation = vi.fn();
    bus.subscribe<RateChanged>('rate:changed', onRate);
    bus.subscribe<AllocationChanged>('allocation:changed', onAllocation);
    bus.publish<AllocationChanged>({
      type: 'allocation:changed',
      employeeId: 'e',
      month: '2026-03',
    });
    expect(onRate).not.toHaveBeenCalled();
    expect(onAllocation).toHaveBeenCalledOnce();
  });

  it('does nothing when nobody is listening', () => {
    expect(() => createEventBus().publish(rateChanged('emp-001'))).not.toThrow();
  });

  it('stops delivering after unsubscribe, and unsubscribing twice is harmless', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe<RateChanged>('rate:changed', handler);
    unsubscribe();
    unsubscribe();
    bus.publish(rateChanged('emp-001'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('isolates a throwing handler: the others still run and the publisher is unaffected', () => {
    const onError = vi.fn();
    const bus = createEventBus(onError);
    const before = vi.fn();
    const after = vi.fn();
    bus.subscribe<RateChanged>('rate:changed', before);
    bus.subscribe<RateChanged>('rate:changed', () => {
      throw new Error('broken subscriber');
    });
    bus.subscribe<RateChanged>('rate:changed', after);
    expect(() => bus.publish(rateChanged('emp-001'))).not.toThrow();
    expect(before).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith('rate:changed', expect.any(Error));
  });

  it('does not deliver the current event to a handler subscribed while it is being delivered', () => {
    const bus = createEventBus();
    const late = vi.fn();
    bus.subscribe<RateChanged>('rate:changed', () => {
      bus.subscribe<RateChanged>('rate:changed', late);
    });
    bus.publish(rateChanged('emp-001'));
    expect(late).not.toHaveBeenCalled();
    bus.publish(rateChanged('emp-001'));
    expect(late).toHaveBeenCalledOnce();
  });

  it('skips a handler that an earlier handler unsubscribed during delivery', () => {
    const bus = createEventBus();
    const victim = vi.fn();
    let unsubscribeVictim: () => void = () => undefined;
    bus.subscribe<RateChanged>('rate:changed', () => unsubscribeVictim());
    unsubscribeVictim = bus.subscribe<RateChanged>('rate:changed', victim);
    bus.publish(rateChanged('emp-001'));
    expect(victim).not.toHaveBeenCalled();
  });

  it('lets one function subscribe twice and treats the subscriptions as one', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.subscribe<RateChanged>('rate:changed', handler);
    bus.subscribe<RateChanged>('rate:changed', handler);
    bus.publish(rateChanged('emp-001'));
    expect(handler).toHaveBeenCalledOnce();
  });
});
