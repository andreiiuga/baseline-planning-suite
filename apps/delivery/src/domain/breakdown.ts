import type { Allocation, BreakdownItem } from './model';

/**
 * Work breakdown operations. Pure and immutable: every operation returns a new state or a
 * typed refusal, never mutates, and never loses an allocation silently.
 *
 * Invariant: allocations sit on leaves only. When an operation would turn an allocated leaf
 * into a parent, its allocations move onto the new child (seq untouched, the edit history
 * does not change) or the operation is refused.
 */

export interface TreeState {
  readonly items: readonly BreakdownItem[];
  readonly allocations: readonly Allocation[];
}

export type TreeRefusal =
  | 'empty-name'
  | 'duplicate-id'
  | 'unknown-item'
  | 'unknown-parent'
  | 'into-own-descendant'
  | 'other-project'
  | 'target-has-allocations';

export interface MovedAllocations {
  readonly fromItemId: string;
  readonly toItemId: string;
  readonly count: number;
}

export type TreeResult =
  | {
      readonly ok: true;
      readonly state: TreeState;
      /** Set when allocations had to follow a leaf that gained a child. */
      readonly moved: MovedAllocations | null;
    }
  | { readonly ok: false; readonly reason: TreeRefusal; readonly message: string };

const refuse = (reason: TreeRefusal, message: string): TreeResult => ({
  ok: false,
  reason,
  message,
});

export type Placement =
  | { readonly kind: 'root'; readonly projectId: string }
  | { readonly kind: 'child'; readonly parentId: string };

const findItem = (state: TreeState, id: string): BreakdownItem | undefined =>
  state.items.find((item) => item.id === id);

const childrenOf = (state: TreeState, id: string): BreakdownItem[] =>
  state.items.filter((item) => item.parentId === id);

const allocationsOn = (state: TreeState, itemId: string): Allocation[] =>
  state.allocations.filter((a) => a.breakdownItemId === itemId);

/** The item and everything beneath it. */
function subtreeIds(state: TreeState, rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  const queue = [rootId];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    for (const child of childrenOf(state, id)) {
      if (!ids.has(child.id)) {
        ids.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return ids;
}

/** Re-points allocations of one leaf onto another item, keeping everything else (incl. seq). */
function moveAllocations(
  state: TreeState,
  fromItemId: string,
  toItemId: string,
): { allocations: Allocation[]; moved: MovedAllocations | null } {
  let count = 0;
  const allocations = state.allocations.map((a) => {
    if (a.breakdownItemId !== fromItemId) return a;
    count += 1;
    return { ...a, breakdownItemId: toItemId };
  });
  return { allocations, moved: count > 0 ? { fromItemId, toItemId, count } : null };
}

export function createItem(
  state: TreeState,
  input: { readonly id: string; readonly name: string; readonly placement: Placement },
): TreeResult {
  const name = input.name.trim();
  if (name === '') return refuse('empty-name', 'A work item needs a name.');
  if (findItem(state, input.id)) return refuse('duplicate-id', `Item ${input.id} already exists.`);

  if (input.placement.kind === 'root') {
    const item: BreakdownItem = {
      id: input.id,
      projectId: input.placement.projectId,
      parentId: null,
      name,
    };
    return { ok: true, state: { ...state, items: [...state.items, item] }, moved: null };
  }

  const parent = findItem(state, input.placement.parentId);
  if (!parent)
    return refuse('unknown-parent', `Parent ${input.placement.parentId} does not exist.`);
  const item: BreakdownItem = {
    id: input.id,
    projectId: parent.projectId,
    parentId: parent.id,
    name,
  };
  const items = [...state.items, item];

  // A leaf that gains its first child stops being a leaf: its allocations follow the child.
  const parentWasLeaf = childrenOf(state, parent.id).length === 0;
  if (!parentWasLeaf) return { ok: true, state: { ...state, items }, moved: null };
  const { allocations, moved } = moveAllocations(state, parent.id, item.id);
  return { ok: true, state: { items, allocations }, moved };
}

export function renameItem(state: TreeState, id: string, name: string): TreeResult {
  const trimmed = name.trim();
  if (trimmed === '') return refuse('empty-name', 'A work item needs a name.');
  if (!findItem(state, id)) return refuse('unknown-item', `Item ${id} does not exist.`);
  const items = state.items.map((item) => (item.id === id ? { ...item, name: trimmed } : item));
  return { ok: true, state: { ...state, items }, moved: null };
}

/** Moves an item (with its subtree) under a new parent, or to the root of its own project. */
export function moveItem(state: TreeState, id: string, newParentId: string | null): TreeResult {
  const item = findItem(state, id);
  if (!item) return refuse('unknown-item', `Item ${id} does not exist.`);

  if (newParentId === null) {
    const items = state.items.map((i) => (i.id === id ? { ...i, parentId: null } : i));
    return { ok: true, state: { ...state, items }, moved: null };
  }

  const target = findItem(state, newParentId);
  if (!target) return refuse('unknown-parent', `Parent ${newParentId} does not exist.`);
  if (target.projectId !== item.projectId) {
    return refuse('other-project', 'Items can only move within their own project.');
  }
  if (subtreeIds(state, id).has(newParentId)) {
    return refuse(
      'into-own-descendant',
      `${item.name} cannot be moved under itself or its own sub-items.`,
    );
  }

  const items = state.items.map((i) => (i.id === id ? { ...i, parentId: newParentId } : i));
  const targetIsAllocatedLeaf =
    childrenOf(state, target.id).length === 0 && allocationsOn(state, target.id).length > 0;
  if (!targetIsAllocatedLeaf) return { ok: true, state: { ...state, items }, moved: null };

  // The target is about to become a parent, so its allocations need a new home. They can only
  // follow an item that is itself an empty leaf; anything else would be ambiguous or lossy.
  const canAdopt = childrenOf(state, id).length === 0 && allocationsOn(state, id).length === 0;
  if (!canAdopt) {
    return refuse(
      'target-has-allocations',
      `${target.name} has staffing allocations. Move or clear them before placing ${item.name} under it.`,
    );
  }
  const { allocations, moved } = moveAllocations(state, target.id, id);
  return { ok: true, state: { items, allocations }, moved };
}

export interface DeleteImpact {
  readonly itemIds: readonly string[];
  readonly allocations: readonly Allocation[];
  readonly totalPm: number;
}

/** What deleting an item would remove: for the confirmation dialog and for change events. */
export function previewDelete(state: TreeState, id: string): DeleteImpact | null {
  if (!findItem(state, id)) return null;
  const ids = subtreeIds(state, id);
  const allocations = state.allocations.filter((a) => ids.has(a.breakdownItemId));
  return {
    itemIds: [...ids],
    allocations,
    totalPm: allocations.reduce((sum, a) => sum + a.amount, 0),
  };
}

export type DeleteResult =
  | { readonly ok: true; readonly state: TreeState; readonly impact: DeleteImpact }
  | { readonly ok: false; readonly reason: 'unknown-item'; readonly message: string };

/** Deletes an item and its subtree together with their allocations. */
export function deleteItem(state: TreeState, id: string): DeleteResult {
  const impact = previewDelete(state, id);
  if (!impact) return { ok: false, reason: 'unknown-item', message: `Item ${id} does not exist.` };
  const gone = new Set(impact.itemIds);
  return {
    ok: true,
    impact,
    state: {
      items: state.items.filter((item) => !gone.has(item.id)),
      allocations: state.allocations.filter((a) => !gone.has(a.breakdownItemId)),
    },
  };
}
