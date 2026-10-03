/**
 * The shell's generic bus has to satisfy both apps' narrower bus ports. These assignments are
 * compile-time checks; the runtime assertions show an event crossing from one app to the other.
 */
import { describe, expect, it, vi } from 'vitest';
import type { DeliveryEventBus } from '../../apps/delivery/src/ports/eventBus';
import type { PeopleEventBus } from '../../apps/people/src/ports/eventBus';
import { createEventBus } from '../../apps/shell/src/bus/eventBus';

describe('the shell bus between People and Delivery', () => {
  const bus = createEventBus();
  const peopleSide: PeopleEventBus = bus;
  const deliverySide: DeliveryEventBus = bus;

  it('carries rate:changed from People to Delivery', () => {
    const onRateChanged = vi.fn();
    deliverySide.subscribe('rate:changed', onRateChanged);
    peopleSide.publish({ type: 'rate:changed', employeeId: 'emp-001' });
    expect(onRateChanged).toHaveBeenCalledWith({ type: 'rate:changed', employeeId: 'emp-001' });
  });

  it('carries allocation:changed from Delivery to People', () => {
    const onAllocationChanged = vi.fn();
    peopleSide.subscribe('allocation:changed', onAllocationChanged);
    deliverySide.publish({ type: 'allocation:changed', employeeId: 'emp-003', month: '2026-06' });
    expect(onAllocationChanged).toHaveBeenCalledWith({
      type: 'allocation:changed',
      employeeId: 'emp-003',
      month: '2026-06',
    });
  });

  it('does not echo an app its own events', () => {
    const own = vi.fn();
    const peopleOnly = createEventBus();
    peopleOnly.subscribe('allocation:changed', own);
    peopleOnly.publish({ type: 'rate:changed', employeeId: 'emp-001' });
    expect(own).not.toHaveBeenCalled();
  });
});
