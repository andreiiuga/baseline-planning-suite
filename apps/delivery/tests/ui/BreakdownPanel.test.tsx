// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { TreeState } from '../../src/domain/breakdown';
import type { Allocation } from '../../src/domain/model';
import { BreakdownPanel } from '../../src/ui/BreakdownPanel';
import { allocations, breakdownItems } from '../support/seed';

interface Commit {
  readonly next: TreeState;
  readonly removed: readonly Allocation[] | undefined;
}

function setup(initial: TreeState = { items: breakdownItems, allocations }) {
  const commits: Commit[] = [];
  function Harness() {
    const [state, setState] = useState<TreeState>(initial);
    return (
      <BreakdownPanel
        projectId="prj-1"
        state={state}
        createId={() => 'wbs-new'}
        onCommit={(next, removed) => {
          commits.push({ next, removed });
          setState(next);
          return Promise.resolve();
        }}
      />
    );
  }
  render(<Harness />);
  return { user: userEvent.setup(), commits };
}

const projectItems = breakdownItems.filter((i) => i.projectId === 'prj-1');
const ITEM_COUNT = projectItems.length;
const levelOf = (id: string): number => {
  const item = projectItems.find((i) => i.id === id);
  return item?.parentId ? 1 + levelOf(item.parentId) : 1;
};
const totalPm = (state: TreeState) => state.allocations.reduce((sum, a) => sum + a.amount, 0);
const tree = () => screen.getByRole('tree', { name: 'Work breakdown' });
/** Names repeat in the seed ("Design" appears twice), so pick by tree position. */
const node = (name: string, index = 0) =>
  within(tree()).getAllByRole('button', { name })[index] as HTMLElement;

describe('the tree', () => {
  it('shows prj-1 three levels deep with roots first', () => {
    setup();
    const items = within(tree()).getAllByRole('treeitem');
    expect(items).toHaveLength(ITEM_COUNT);
    expect(items.map((item) => item.getAttribute('aria-level'))[0]).toBe('1');
    expect(within(tree()).getByRole('button', { name: 'Ledger migration' })).toBeTruthy();
    expect(
      within(tree())
        .getAllByRole('treeitem')
        .filter((i) => i.getAttribute('aria-level') === '3'),
    ).toHaveLength(projectItems.filter((i) => levelOf(i.id) === 3).length);
  });

  it('collapses and expands a branch with the toggle', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Collapse Ledger migration' }));
    expect(within(tree()).queryByRole('button', { name: 'Migration' })).toBeNull();
    expect(within(tree()).getAllByRole('treeitem')).toHaveLength(ITEM_COUNT - 9);
    await user.click(screen.getByRole('button', { name: 'Expand Ledger migration' }));
    expect(within(tree()).getAllByRole('treeitem')).toHaveLength(ITEM_COUNT);
  });

  it('moves focus with the arrow keys and collapses and expands with left and right', async () => {
    const { user } = setup();
    node('Ledger migration').focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(node('Discovery'));
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(node('Ledger migration'));
    await user.keyboard('{ArrowLeft}'); // collapse
    expect(within(tree()).queryByRole('button', { name: 'Migration' })).toBeNull();
    await user.keyboard('{ArrowRight}'); // expand
    expect(within(tree()).getByRole('button', { name: 'Migration' })).toBeTruthy();
    await user.keyboard('{ArrowRight}'); // into the first child
    expect(document.activeElement).toBe(node('Discovery'));
    await user.keyboard('{ArrowLeft}'); // collapse Discovery
    await user.keyboard('{ArrowLeft}'); // up to the parent
    expect(document.activeElement).toBe(node('Ledger migration'));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(node('Regression', 1)); // last visible row, wbs-025
  });

  it('asks you to select an item before offering item actions', () => {
    setup();
    expect(screen.getByText(/Select an item to rename, move or delete/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: /^Add sub-item/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('adding a sub-item under an allocated leaf', () => {
  it('moves the allocations onto the new item, says so, and changes no totals', async () => {
    const { user, commits } = setup();
    const before = { items: breakdownItems, allocations };
    await user.click(node('Design', 0)); // wbs-012, 18 allocations
    await user.type(screen.getByLabelText('New item name'), 'Wireframes');
    await user.click(screen.getByRole('button', { name: /Add sub-item to “Design”/ }));

    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Added “Wireframes”.');
    expect(status.textContent).toContain(
      'Moved 18 staffing allocations from “Design” to “Wireframes”.',
    );

    expect(commits).toHaveLength(1);
    const { next } = commits[0] as Commit;
    expect(next.allocations).toHaveLength(before.allocations.length);
    expect(totalPm(next)).toBeCloseTo(totalPm(before), 10);
    expect(next.allocations.filter((a) => a.breakdownItemId === 'wbs-012')).toEqual([]);
    expect(next.allocations.filter((a) => a.breakdownItemId === 'wbs-new')).toHaveLength(18);
    expect(commits[0]?.removed).toBeUndefined(); // nothing was lost, so nobody is told to re-read
  });

  it('shows the new child under its parent and selects it', async () => {
    const { user } = setup();
    await user.click(node('Design', 0));
    await user.type(screen.getByLabelText('New item name'), 'Wireframes');
    await user.click(screen.getByRole('button', { name: /Add sub-item/ }));
    await screen.findByRole('button', { name: 'Wireframes' });
    expect(node('Wireframes').getAttribute('aria-current')).toBe('true');
    expect(within(tree()).getAllByRole('treeitem')).toHaveLength(ITEM_COUNT + 1);
  });

  it('does not mention moving when the parent had nothing to move', async () => {
    const { user } = setup();
    await user.click(node('Implementation', 1)); // wbs-013 has no allocations
    await user.type(screen.getByLabelText('New item name'), 'Spike');
    await user.click(screen.getByRole('button', { name: /Add sub-item/ }));
    expect((await screen.findByRole('status')).textContent).toBe('Added “Spike”.');
  });
});

describe('other tree operations', () => {
  it('adds a top-level item without needing a selection', async () => {
    const { user, commits } = setup();
    await user.type(screen.getByLabelText('New item name'), 'Decommissioning');
    await user.click(screen.getByRole('button', { name: 'Add top-level item' }));
    await screen.findByRole('button', { name: 'Decommissioning' });
    expect(commits[0]?.next.items.at(-1)).toMatchObject({ parentId: null, projectId: 'prj-1' });
  });

  it('refuses an empty name with a message and saves nothing', async () => {
    const { user, commits } = setup();
    await user.click(screen.getByRole('button', { name: 'Add top-level item' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/needs a name/);
    expect(commits).toHaveLength(0);
  });

  it('renames the selected item', async () => {
    const { user } = setup();
    await user.click(node('Ledger migration'));
    const field = screen.getByLabelText(/Rename “Ledger migration”/);
    await user.clear(field);
    await user.type(field, 'Ledger move');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    await screen.findByRole('button', { name: 'Ledger move' });
    expect(screen.getByRole('status').textContent).toBe('Renamed to “Ledger move”.');
  });

  it('never offers the item itself or its descendants as a place to move it', async () => {
    const { user } = setup();
    await user.click(node('Ledger migration'));
    const options = within(screen.getByLabelText(/Move “Ledger migration” under/)).getAllByRole(
      'option',
    );
    const labels = options.map((o) => o.textContent?.trim());
    expect(labels).not.toContain('Ledger migration');
    // Its own descendants are not offered...
    expect(labels).not.toContain('Migration');
    expect(labels).not.toContain('Pilot');
    expect(labels).not.toContain('Performance');
    // ...but the unrelated "Discovery" under "Reporting cut-over" is a valid target.
    expect(labels.filter((l) => l === 'Discovery')).toHaveLength(1);
    expect(labels).toContain('Top level');
  });

  it('moves a node to another parent', async () => {
    const { user, commits } = setup();
    await user.click(node('Test data', 0)); // wbs-024 under Hardening
    await user.selectOptions(screen.getByLabelText(/Move “Test data” under/), 'wbs-009');
    await user.click(screen.getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(commits).toHaveLength(1));
    expect(commits[0]?.next.items.find((i) => i.id === 'wbs-024')?.parentId).toBe('wbs-009');
  });

  it('hands allocations over when an empty leaf is moved under an allocated leaf', async () => {
    const { user, commits } = setup();
    await user.click(node('Implementation', 1)); // wbs-013, empty
    await user.selectOptions(screen.getByLabelText(/Move “Implementation” under/), 'wbs-012');
    await user.click(screen.getByRole('button', { name: 'Move' }));
    expect((await screen.findByRole('status')).textContent).toContain(
      'Moved 18 staffing allocations from “Design” to “Implementation”.',
    );
    expect(
      commits[0]?.next.allocations.filter((a) => a.breakdownItemId === 'wbs-013'),
    ).toHaveLength(18);
  });

  it('refuses to move an allocated item under another allocated leaf, with an explanation', async () => {
    const { user, commits } = setup();
    await user.click(node('Rework', 0)); // wbs-020, 6 allocations
    await user.selectOptions(screen.getByLabelText(/Move “Rework” under/), 'wbs-012');
    await user.click(screen.getByRole('button', { name: 'Move' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/has staffing allocations/);
    expect(commits).toHaveLength(0);
  });
});

describe('deleting', () => {
  it('shows what will be removed and does nothing until confirmed', async () => {
    const { user, commits } = setup();
    await user.click(node('Discovery', 0)); // wbs-004 with Design (18) and Rework (6)
    await user.click(screen.getByRole('button', { name: /^Delete “Discovery”/ }));
    const dialog = screen.getByRole('alertdialog', { name: 'Confirm delete' });
    expect(dialog.textContent).toMatch(/removes 2 sub-items and 24 staffing allocations/);
    expect(commits).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Keep' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(commits).toHaveLength(0);
  });

  it('deletes the subtree and reports the removed allocations so People can be told', async () => {
    const { user, commits } = setup();
    await user.click(node('Discovery', 0));
    await user.click(screen.getByRole('button', { name: /^Delete “Discovery”/ }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(commits).toHaveLength(1));
    expect(commits[0]?.removed).toHaveLength(24);
    expect(commits[0]?.next.items.some((i) => i.id === 'wbs-004' || i.id === 'wbs-012')).toBe(
      false,
    );
    expect((await screen.findByRole('status')).textContent).toContain(
      'Deleted “Discovery” and 24 staffing allocations.',
    );
    expect(within(tree()).getAllByRole('treeitem')).toHaveLength(ITEM_COUNT - 3);
  });
});
