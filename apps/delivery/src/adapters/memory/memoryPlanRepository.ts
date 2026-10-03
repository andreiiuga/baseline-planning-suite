import type { TreeState } from '../../domain/breakdown';
import type { Allocation, BreakdownItem } from '../../domain/model';
import type { AllocationCell, PlanRepository } from '../../ports/planRepository';
import type { DeliverySeed } from '../seed/types';
import { assertValidAmount, newAllocationId, sameCell } from '../allocationCells';

export function createMemoryPlanRepository(seed: DeliverySeed): PlanRepository {
  let items: BreakdownItem[] = [];
  let allocations: Allocation[] = [];
  let lastSeq = 0;

  const restore = (): void => {
    items = structuredClone([...seed.breakdownItems]);
    allocations = structuredClone([...seed.allocations]);
    lastSeq = allocations.reduce((max, a) => Math.max(max, a.seq), 0);
  };
  restore();

  return {
    load: () =>
      Promise.resolve({
        projects: structuredClone([...seed.projects]),
        items: structuredClone(items),
        allocations: structuredClone(allocations),
      }),

    saveTree(next: TreeState) {
      items = structuredClone([...next.items]);
      allocations = structuredClone([...next.allocations]);
      return Promise.resolve();
    },

    // async so a guard failure is a rejected promise, as in every other adapter
    async setAllocationAmount(cell: AllocationCell, amount: number) {
      assertValidAmount(amount);
      lastSeq += 1;
      const existing = allocations.find((a) => sameCell(a, cell));
      const stored: Allocation = existing
        ? { ...existing, amount, seq: lastSeq }
        : { id: newAllocationId(lastSeq), ...cell, amount, seq: lastSeq };
      allocations = existing
        ? allocations.map((a) => (a.id === stored.id ? stored : a))
        : [...allocations, stored];
      return structuredClone(stored);
    },

    listAllocationsForEmployees: (employeeIds) =>
      Promise.resolve(
        structuredClone(allocations.filter((a) => employeeIds.includes(a.employeeId))),
      ),

    reset() {
      restore();
      return Promise.resolve();
    },
  };
}
