import { useCallback, useEffect, useState } from 'react';
import type { TreeState } from '../domain/breakdown';
import type { Allocation } from '../domain/model';
import type { DeliveryEventBus } from '../ports/eventBus';
import type { AllocationCell, PlanRepository, PlanSnapshot } from '../ports/planRepository';

export interface PlanActions {
  /**
   * Persists the outcome of a tree operation. `removed` are allocations that disappeared
   * with a deleted subtree: People is told about every person-month they touched.
   */
  readonly applyTree: (next: TreeState, removed?: readonly Allocation[]) => Promise<void>;
  readonly editCell: (cell: AllocationCell, amountPm: number) => Promise<Allocation>;
}

export type PlanState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly snapshot: PlanSnapshot };

/** Delivery's own data, kept in memory and written through the repository on every change. */
export function usePlan(
  repository: PlanRepository,
  bus: DeliveryEventBus,
): { state: PlanState; actions: PlanActions } {
  const [state, setState] = useState<PlanState>({ status: 'loading' });

  useEffect(() => {
    let mounted = true;
    repository.load().then(
      (snapshot) => mounted && setState({ status: 'ready', snapshot }),
      (error: unknown) =>
        mounted &&
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not load the plan',
        }),
    );
    return () => {
      mounted = false;
    };
  }, [repository]);

  const announce = useCallback(
    (allocations: readonly Allocation[]) => {
      const seen = new Set<string>();
      for (const { employeeId, month } of allocations) {
        const key = `${employeeId}|${month}`;
        if (seen.has(key)) continue;
        seen.add(key);
        bus.publish({ type: 'allocation:changed', employeeId, month });
      }
    },
    [bus],
  );

  const applyTree = useCallback<PlanActions['applyTree']>(
    async (next, removed = []) => {
      await repository.saveTree(next);
      setState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              snapshot: { ...current.snapshot, items: next.items, allocations: next.allocations },
            }
          : current,
      );
      announce(removed);
    },
    [repository, announce],
  );

  const editCell = useCallback<PlanActions['editCell']>(
    async (cell, amountPm) => {
      const stored = await repository.setAllocationAmount(cell, amountPm);
      setState((current) => {
        if (current.status !== 'ready') return current;
        const exists = current.snapshot.allocations.some((a) => a.id === stored.id);
        const allocations = exists
          ? current.snapshot.allocations.map((a) => (a.id === stored.id ? stored : a))
          : [...current.snapshot.allocations, stored];
        return { status: 'ready', snapshot: { ...current.snapshot, allocations } };
      });
      announce([stored]);
      return stored;
    },
    [repository, announce],
  );

  return { state, actions: { applyTree, editCell } };
}
