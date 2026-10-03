import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPeopleModel, type PeopleModel } from '../domain/staffing';
import type { Employee } from '../domain/model';
import type { RateRecord } from '../domain/rates';
import { unavailableEmployeeQuery, unavailableRateQuery } from '../adapters/unavailablePeople';
import type { DeliveryEventBus } from '../ports/eventBus';
import type { EmployeeQuery, RateQuery } from '../ports/peopleQueries';

export type PeopleState =
  | { readonly status: 'checking' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'ok'; readonly model: PeopleModel };

type Loaded = {
  readonly employees: readonly Employee[];
  readonly rates: Readonly<Record<string, readonly RateRecord[]>>;
};

/**
 * Delivery's read model of People: who they are and what they cost. Loaded on mount (also
 * the safety net if an event was missed) and refreshed for one person whenever People says
 * that person's rates changed. The event carries only an id; the rates are re-read through
 * the port, so a stale or reordered event cannot make Delivery price with old numbers.
 */
export function usePeopleModel(
  employeeQuery: EmployeeQuery | null,
  rateQuery: RateQuery | null,
  bus: DeliveryEventBus,
): PeopleState {
  const [loaded, setLoaded] = useState<Loaded | 'checking' | 'unavailable'>('checking');
  const latestRefresh = useRef(new Map<string, number>());

  useEffect(() => {
    let mounted = true;
    let initialLoadDone = false;
    const missedWhileLoading = new Set<string>();
    const employees = employeeQuery ?? unavailableEmployeeQuery;
    const rates = rateQuery ?? unavailableRateQuery;
    setLoaded('checking');

    /** Re-reads rates for several people in one call. */
    const refreshRates = async (employeeIds: readonly string[]): Promise<void> => {
      const sequences = new Map<string, number>();
      for (const id of employeeIds) {
        const sequence = (latestRefresh.current.get(id) ?? 0) + 1;
        latestRefresh.current.set(id, sequence);
        sequences.set(id, sequence);
      }
      const result = await rates.getRates(employeeIds);
      if (!mounted || result.status !== 'ok') return;
      // Ignore answers overtaken by a newer event for the same person.
      const fresh = employeeIds.filter((id) => latestRefresh.current.get(id) === sequences.get(id));
      if (fresh.length === 0) return;
      setLoaded((current) =>
        typeof current === 'string'
          ? current
          : {
              ...current,
              rates: {
                ...current.rates,
                ...Object.fromEntries(fresh.map((id) => [id, result.data[id] ?? []])),
              },
            },
      );
    };

    // A burst of events (a reset, a bulk edit) collapses into one batched re-read.
    const queued = new Set<string>();
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const queueRefresh = (employeeId: string): void => {
      queued.add(employeeId);
      clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        const ids = [...queued];
        queued.clear();
        void refreshRates(ids);
      }, 0);
    };

    const unsubscribe = bus.subscribe('rate:changed', ({ employeeId }) => {
      if (initialLoadDone) queueRefresh(employeeId);
      else missedWhileLoading.add(employeeId); // the initial read may predate this change
    });

    void (async () => {
      const people = await employees.listEmployees();
      const priced =
        people.status === 'ok' ? await rates.getRates(people.data.map((e) => e.id)) : null;
      if (!mounted) return;
      setLoaded(
        people.status === 'ok' && priced?.status === 'ok'
          ? { employees: people.data, rates: priced.data }
          : 'unavailable',
      );
      initialLoadDone = true;
      if (missedWhileLoading.size > 0) void refreshRates([...missedWhileLoading]);
    })();

    return () => {
      mounted = false;
      clearTimeout(flushTimer);
      unsubscribe();
    };
  }, [employeeQuery, rateQuery, bus]);

  return useMemo<PeopleState>(
    () =>
      typeof loaded === 'string'
        ? { status: loaded }
        : { status: 'ok', model: buildPeopleModel(loaded.employees, loaded.rates) },
    [loaded],
  );
}
