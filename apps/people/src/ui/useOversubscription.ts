import { useEffect, useRef, useState } from 'react';
import { unavailableAllocationTotals } from '../adapters/unavailableDelivery';
import { oversubscribedMonths } from '../domain/capacity';
import type { AllocationTotals } from '../ports/allocationTotals';
import type { PeopleEventBus } from '../ports/eventBus';

export type CapacityState =
  | { readonly status: 'checking' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'ok'; readonly byEmployee: ReadonlyMap<string, readonly string[]> };

/**
 * Who is allocated beyond capacity, as reported by Delivery. Read on mount and again every
 * time Delivery announces a change. The event carries no data: the totals are re-read through
 * the port, so a stale or reordered event cannot show old numbers.
 */
export function useOversubscription(
  totals: AllocationTotals | null,
  bus: PeopleEventBus,
  employeeIds: readonly string[],
): CapacityState {
  const [state, setState] = useState<CapacityState>({ status: 'checking' });
  const latestRequest = useRef(0);
  const idsKey = employeeIds.join(',');

  useEffect(() => {
    if (idsKey === '') return;
    const ids = idsKey.split(',');
    const source = totals ?? unavailableAllocationTotals;
    let mounted = true;

    const refresh = async (): Promise<void> => {
      const request = (latestRequest.current += 1);
      const result = await source.getMonthlyTotals(ids);
      // Ignore answers that arrive after a newer request was made.
      if (!mounted || request !== latestRequest.current) return;
      setState(
        result.status === 'ok'
          ? { status: 'ok', byEmployee: oversubscribedMonths(result.data) }
          : { status: 'unavailable' },
      );
    };

    void refresh();
    // A burst of events (a reset, a deleted subtree) collapses into one re-read.
    let pending: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = bus.subscribe('allocation:changed', () => {
      clearTimeout(pending);
      pending = setTimeout(() => void refresh(), 0);
    });
    return () => {
      mounted = false;
      clearTimeout(pending);
      unsubscribe();
    };
  }, [totals, bus, idsKey]);

  return state;
}
