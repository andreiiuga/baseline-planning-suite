import { describe, expect, it } from 'vitest';
import {
  createItem,
  deleteItem,
  moveItem,
  previewDelete,
  renameItem,
  type TreeResult,
  type TreeState,
} from '../../src/domain/breakdown';
import type { Allocation } from '../../src/domain/model';
import { allocations, breakdownItems } from '../support/seed';

const seedState: TreeState = { items: breakdownItems, allocations };
const totalPm = (state: TreeState, itemIds?: Set<string>): number =>
  state.allocations
    .filter((a) => !itemIds || itemIds.has(a.breakdownItemId))
    .reduce((sum, a) => sum + a.amount, 0);

function expectOk(result: TreeResult): Extract<TreeResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected success, got ${result.reason}: ${result.message}`);
  return result;
}
function expectRefused(result: TreeResult, reason: string): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.reason).toBe(reason);
}

describe('adding a child under an allocated leaf (wbs-012, level 3 in prj-1)', () => {
  const onLeaf = allocations.filter((a) => a.breakdownItemId === 'wbs-012');

  it('has allocations in the fixtures, including alloc-001', () => {
    expect(onLeaf.map((a) => a.id)).toContain('alloc-001');
  });

  const result = expectOk(
    createItem(seedState, {
      id: 'wbs-new',
      name: '  Wireframes  ',
      placement: { kind: 'child', parentId: 'wbs-012' },
    }),
  );

  it('moves every allocation of the leaf onto the new child and reports it', () => {
    expect(result.moved).toEqual({
      fromItemId: 'wbs-012',
      toItemId: 'wbs-new',
      count: onLeaf.length,
    });
    expect(result.state.allocations.filter((a) => a.breakdownItemId === 'wbs-012')).toEqual([]);
    expect(result.state.allocations.filter((a) => a.breakdownItemId === 'wbs-new')).toHaveLength(
      onLeaf.length,
    );
  });

  it('loses nothing: allocation count and total person-months are unchanged', () => {
    expect(result.state.allocations).toHaveLength(seedState.allocations.length);
    expect(totalPm(result.state)).toBeCloseTo(totalPm(seedState), 10);
  });

  it('leaves seq and every other field of the moved allocations untouched', () => {
    for (const before of onLeaf) {
      const after = result.state.allocations.find((a) => a.id === before.id) as Allocation;
      expect(after).toEqual({ ...before, breakdownItemId: 'wbs-new' });
    }
  });

  it('trims the name and inherits the parent project', () => {
    const created = result.state.items.find((i) => i.id === 'wbs-new');
    expect(created).toEqual({
      id: 'wbs-new',
      projectId: 'prj-1',
      parentId: 'wbs-012',
      name: 'Wireframes',
    });
  });

  it('does not touch the original state', () => {
    expect(seedState.items).toBe(breakdownItems);
    expect(seedState.allocations).toBe(allocations);
  });

  it('moves nothing when a second child is added to the now-parent', () => {
    const second = expectOk(
      createItem(result.state, {
        id: 'wbs-new-2',
        name: 'Prototype',
        placement: { kind: 'child', parentId: 'wbs-012' },
      }),
    );
    expect(second.moved).toBeNull();
    expect(second.state.allocations).toEqual(result.state.allocations);
  });
});

describe('createItem', () => {
  it('adds a root item to a project', () => {
    const result = expectOk(
      createItem(seedState, {
        id: 'r',
        name: 'Cutover',
        placement: { kind: 'root', projectId: 'prj-2' },
      }),
    );
    expect(result.state.items.at(-1)).toEqual({
      id: 'r',
      projectId: 'prj-2',
      parentId: null,
      name: 'Cutover',
    });
    expect(result.moved).toBeNull();
  });

  it('adds a child to a leaf without allocations without moving anything', () => {
    const state: TreeState = {
      items: [{ id: 'leaf', projectId: 'p', parentId: null, name: 'Leaf' }],
      allocations: [],
    };
    const result = expectOk(
      createItem(state, { id: 'n', name: 'x', placement: { kind: 'child', parentId: 'leaf' } }),
    );
    expect(result.moved).toBeNull();
    expect(result.state.items).toHaveLength(2);
  });

  it('refuses empty names, duplicate ids and unknown parents', () => {
    expectRefused(
      createItem(seedState, {
        id: 'a',
        name: '   ',
        placement: { kind: 'root', projectId: 'prj-1' },
      }),
      'empty-name',
    );
    expectRefused(
      createItem(seedState, {
        id: 'wbs-001',
        name: 'x',
        placement: { kind: 'root', projectId: 'prj-1' },
      }),
      'duplicate-id',
    );
    expectRefused(
      createItem(seedState, {
        id: 'a',
        name: 'x',
        placement: { kind: 'child', parentId: 'ghost' },
      }),
      'unknown-parent',
    );
  });
});

describe('renameItem', () => {
  it('renames and trims', () => {
    const result = expectOk(renameItem(seedState, 'wbs-012', '  Detailed design '));
    expect(result.state.items.find((i) => i.id === 'wbs-012')?.name).toBe('Detailed design');
    expect(result.state.allocations).toBe(seedState.allocations);
  });

  it('refuses empty names and unknown items', () => {
    expectRefused(renameItem(seedState, 'wbs-012', ''), 'empty-name');
    expectRefused(renameItem(seedState, 'ghost', 'x'), 'unknown-item');
  });
});

describe('moveItem', () => {
  const rootId = breakdownItems.find((i) => i.parentId === null && i.projectId === 'prj-1')
    ?.id as string;
  const childOfRoot = breakdownItems.find(
    (i) => i.parentId === rootId,
  ) as (typeof breakdownItems)[number];
  const grandchild = breakdownItems.find(
    (i) => i.parentId === childOfRoot.id,
  ) as (typeof breakdownItems)[number];

  it('refuses a move under the item itself or any descendant', () => {
    expectRefused(moveItem(seedState, rootId, rootId), 'into-own-descendant');
    expectRefused(moveItem(seedState, rootId, childOfRoot.id), 'into-own-descendant');
    expectRefused(moveItem(seedState, rootId, grandchild.id), 'into-own-descendant');
  });

  it('refuses a move into another project', () => {
    const otherProjectItem = breakdownItems.find(
      (i) => i.projectId !== childOfRoot.projectId,
    ) as (typeof breakdownItems)[number];
    expectRefused(moveItem(seedState, childOfRoot.id, otherProjectItem.id), 'other-project');
  });

  it('refuses unknown items and parents', () => {
    expectRefused(moveItem(seedState, 'ghost', null), 'unknown-item');
    expectRefused(moveItem(seedState, childOfRoot.id, 'ghost'), 'unknown-parent');
  });

  it('moves a subtree to the root and back without touching allocations', () => {
    const toRoot = expectOk(moveItem(seedState, childOfRoot.id, null));
    expect(toRoot.state.items.find((i) => i.id === childOfRoot.id)?.parentId).toBeNull();
    expect(toRoot.state.allocations).toBe(seedState.allocations);
    const back = expectOk(moveItem(toRoot.state, childOfRoot.id, rootId));
    expect(back.state.items.find((i) => i.id === childOfRoot.id)?.parentId).toBe(rootId);
  });

  it('moves a node under a parent that already has children without moving allocations', () => {
    const result = expectOk(moveItem(seedState, grandchild.id, rootId));
    expect(result.moved).toBeNull();
    expect(result.state.allocations).toBe(seedState.allocations);
  });

  describe('under an allocated leaf', () => {
    const base: TreeState = {
      items: [
        { id: 'root', projectId: 'p', parentId: null, name: 'Root' },
        { id: 'target', projectId: 'p', parentId: 'root', name: 'Target' },
        { id: 'empty-leaf', projectId: 'p', parentId: 'root', name: 'Empty leaf' },
        { id: 'busy-leaf', projectId: 'p', parentId: 'root', name: 'Busy leaf' },
        { id: 'branch', projectId: 'p', parentId: 'root', name: 'Branch' },
        { id: 'branch-leaf', projectId: 'p', parentId: 'branch', name: 'Branch leaf' },
      ],
      allocations: [
        {
          id: 'a1',
          breakdownItemId: 'target',
          employeeId: 'e1',
          month: '2026-04',
          amount: 0.5,
          seq: 7,
        },
        {
          id: 'a2',
          breakdownItemId: 'busy-leaf',
          employeeId: 'e1',
          month: '2026-05',
          amount: 0.25,
          seq: 8,
        },
      ],
    };

    it('hands the target allocations to an empty leaf that moves in', () => {
      const result = expectOk(moveItem(base, 'empty-leaf', 'target'));
      expect(result.moved).toEqual({ fromItemId: 'target', toItemId: 'empty-leaf', count: 1 });
      expect(result.state.allocations.find((a) => a.id === 'a1')).toMatchObject({
        breakdownItemId: 'empty-leaf',
        seq: 7,
      });
      expect(totalPm(result.state)).toBeCloseTo(totalPm(base), 10);
    });

    it('refuses when the moving item is a leaf with allocations of its own', () => {
      expectRefused(moveItem(base, 'busy-leaf', 'target'), 'target-has-allocations');
    });

    it('refuses when the moving item is a parent', () => {
      expectRefused(moveItem(base, 'branch', 'target'), 'target-has-allocations');
    });
  });
});

describe('deleteItem', () => {
  const parent = breakdownItems.find(
    (i) => i.parentId === null && i.projectId === 'prj-1',
  ) as (typeof breakdownItems)[number];

  it('reports the subtree and the allocations that would go, without changing anything', () => {
    const impact = previewDelete(seedState, parent.id);
    expect(impact?.itemIds).toContain(parent.id);
    expect(impact?.itemIds.length).toBeGreaterThan(1);
    const ids = new Set(impact?.itemIds);
    expect(impact?.allocations.every((a) => ids.has(a.breakdownItemId))).toBe(true);
    expect(impact?.totalPm).toBeCloseTo(totalPm(seedState, ids), 10);
  });

  it('removes the subtree and exactly its allocations', () => {
    const result = deleteItem(seedState, parent.id);
    if (!result.ok) throw new Error('delete refused');
    const gone = new Set(result.impact.itemIds);
    expect(result.state.items.some((i) => gone.has(i.id))).toBe(false);
    expect(result.state.items).toHaveLength(seedState.items.length - gone.size);
    expect(result.state.allocations).toHaveLength(
      seedState.allocations.length - result.impact.allocations.length,
    );
    expect(totalPm(result.state) + result.impact.totalPm).toBeCloseTo(totalPm(seedState), 10);
  });

  it('deletes a single leaf', () => {
    const leaf = allocations.find((a) => a.breakdownItemId === 'wbs-012');
    const result = deleteItem(seedState, 'wbs-012');
    if (!result.ok) throw new Error('delete refused');
    expect(result.impact.itemIds).toEqual(['wbs-012']);
    expect(leaf && result.impact.allocations.map((a) => a.id)).toContain('alloc-001');
  });

  it('refuses an unknown item', () => {
    expect(deleteItem(seedState, 'ghost').ok).toBe(false);
    expect(previewDelete(seedState, 'ghost')).toBeNull();
  });
});
