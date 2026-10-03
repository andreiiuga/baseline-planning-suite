import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  createItem,
  deleteItem,
  moveItem,
  previewDelete,
  renameItem,
  type TreeResult,
  type TreeState,
} from '../domain/breakdown';
import { newItemId } from '../domain/ids';
import type { Allocation, BreakdownItem } from '../domain/model';

interface Props {
  readonly projectId: string;
  /** The whole plan: operations are checked against it so nothing can be lost silently. */
  readonly state: TreeState;
  readonly onCommit: (next: TreeState, removed?: readonly Allocation[]) => Promise<void>;
  /** Overridable so tests get predictable ids. */
  readonly createId?: () => string;
}

type Message = { readonly kind: 'info' | 'error'; readonly text: string };

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

export function BreakdownPanel({ projectId, state, onCommit, createId = newItemId }: Props) {
  const toolbarId = useId();
  const items = useMemo(
    () => state.items.filter((item) => item.projectId === projectId),
    [state.items, projectId],
  );
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, BreakdownItem[]>();
    for (const item of items) {
      const siblings = map.get(item.parentId) ?? [];
      siblings.push(item);
      map.set(item.parentId, siblings);
    }
    return map;
  }, [items]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState<Message | null>(null);
  const [newName, setNewName] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const selected = items.find((item) => item.id === selectedId) ?? null;

  // Visible rows in display order, for keyboard navigation.
  const visible = useMemo(() => {
    const rows: { item: BreakdownItem; level: number }[] = [];
    const walk = (parentId: string | null, level: number) => {
      for (const item of childrenOf.get(parentId) ?? []) {
        rows.push({ item, level });
        if (!collapsed.has(item.id)) walk(item.id, level + 1);
      }
    };
    walk(null, 1);
    return rows;
  }, [childrenOf, collapsed]);

  const select = (item: BreakdownItem) => {
    setSelectedId(item.id);
    setRenameTo(item.name);
    setMoveTo('');
    setConfirmingDelete(false);
    setMessage(null);
  };

  const focusRow = (id: string | undefined) => {
    if (id) buttons.current.get(id)?.focus();
  };

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const onKeyDown = (event: KeyboardEvent, item: BreakdownItem) => {
    const index = visible.findIndex((row) => row.item.id === item.id);
    const hasChildren = (childrenOf.get(item.id) ?? []).length > 0;
    const keys: Record<string, () => void> = {
      ArrowDown: () => focusRow(visible[index + 1]?.item.id),
      ArrowUp: () => focusRow(visible[index - 1]?.item.id),
      Home: () => focusRow(visible[0]?.item.id),
      End: () => focusRow(visible.at(-1)?.item.id),
      ArrowRight: () => {
        if (!hasChildren) return;
        if (collapsed.has(item.id)) toggle(item.id);
        else focusRow(childrenOf.get(item.id)?.[0]?.id);
      },
      ArrowLeft: () => {
        if (hasChildren && !collapsed.has(item.id)) toggle(item.id);
        else focusRow(item.parentId ?? undefined);
      },
    };
    const handler = keys[event.key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  };

  /** Runs a domain operation, shows its outcome, and persists it when it succeeded. */
  const run = async (
    result: TreeResult,
    describe: (result: Extract<TreeResult, { ok: true }>) => string,
    after?: (result: Extract<TreeResult, { ok: true }>) => void,
  ) => {
    if (!result.ok) {
      setMessage({ kind: 'error', text: result.message });
      return;
    }
    setBusy(true);
    try {
      await onCommit(result.state);
      after?.(result);
      setMessage({ kind: 'info', text: describe(result) });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'The change could not be saved.',
      });
    } finally {
      setBusy(false);
    }
  };

  const movedText = (result: Extract<TreeResult, { ok: true }>): string => {
    const { moved } = result;
    if (!moved) return '';
    const name = (id: string) => result.state.items.find((item) => item.id === id)?.name ?? id;
    return ` Moved ${moved.count} staffing ${plural(moved.count, 'allocation', 'allocations')} from “${name(moved.fromItemId)}” to “${name(moved.toItemId)}”.`;
  };

  const add = (placement: 'child' | 'root') => {
    const id = createId();
    const name = newName.trim();
    const result = createItem(state, {
      id,
      name: newName,
      placement:
        placement === 'child' && selected
          ? { kind: 'child', parentId: selected.id }
          : { kind: 'root', projectId },
    });
    void run(
      result,
      (ok) => `Added “${name}”.${movedText(ok)}`,
      () => {
        setNewName('');
        if (placement === 'child' && selected) {
          setCollapsed((current) => {
            const next = new Set(current);
            next.delete(selected.id);
            return next;
          });
        }
        setSelectedId(id);
        setRenameTo(name);
      },
    );
  };

  const validMoveTargets = useMemo(() => {
    if (!selected) return [];
    const blocked = new Set<string>([selected.id]);
    const queue = [selected.id];
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      for (const child of childrenOf.get(id) ?? []) {
        blocked.add(child.id);
        queue.push(child.id);
      }
    }
    return visibleOrder(childrenOf).filter(({ item }) => !blocked.has(item.id));
  }, [selected, childrenOf]);

  const impact = selected && confirmingDelete ? previewDelete(state, selected.id) : null;

  const renderNodes = (parentId: string | null, level: number) => (
    <ul
      role={level === 1 ? 'tree' : 'group'}
      aria-label={level === 1 ? 'Work breakdown' : undefined}
    >
      {(childrenOf.get(parentId) ?? []).map((item) => {
        const children = childrenOf.get(item.id) ?? [];
        const expanded = !collapsed.has(item.id);
        return (
          <li
            key={item.id}
            role="treeitem"
            aria-level={level}
            aria-expanded={children.length > 0 ? expanded : undefined}
            aria-selected={item.id === selectedId}
          >
            <span className="tree-row">
              {children.length > 0 ? (
                <button
                  type="button"
                  className="tree-toggle"
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.name}`}
                  tabIndex={-1}
                  onClick={() => toggle(item.id)}
                >
                  {expanded ? '▾' : '▸'}
                </button>
              ) : (
                <span className="tree-toggle" aria-hidden="true" />
              )}
              <button
                type="button"
                className="tree-name"
                aria-current={item.id === selectedId ? 'true' : undefined}
                ref={(element) => {
                  if (element) buttons.current.set(item.id, element);
                  else buttons.current.delete(item.id);
                }}
                onClick={() => select(item)}
                onKeyDown={(event) => onKeyDown(event, item)}
              >
                {item.name}
              </button>
            </span>
            {children.length > 0 && expanded ? renderNodes(item.id, level + 1) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <section aria-labelledby={`${toolbarId}-title`} className="breakdown">
      <h2 id={`${toolbarId}-title`}>Work breakdown</h2>
      {items.length === 0 ? (
        <p className="muted">This project has no work items yet.</p>
      ) : (
        renderNodes(null, 1)
      )}

      <div className="tree-tools" role="group" aria-label="Edit work breakdown">
        <div className="field">
          <label htmlFor={`${toolbarId}-new`}>New item name</label>
          <input
            id={`${toolbarId}-new`}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
        </div>
        <div className="actions">
          <button type="button" disabled={busy || !selected} onClick={() => add('child')}>
            Add sub-item{selected ? ` to “${selected.name}”` : ''}
          </button>
          <button type="button" disabled={busy} onClick={() => add('root')}>
            Add top-level item
          </button>
        </div>

        {selected ? (
          <>
            <div className="field">
              <label htmlFor={`${toolbarId}-rename`}>Rename “{selected.name}”</label>
              <input
                id={`${toolbarId}-rename`}
                value={renameTo}
                onChange={(event) => setRenameTo(event.target.value)}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    renameItem(state, selected.id, renameTo),
                    () => `Renamed to “${renameTo.trim()}”.`,
                  )
                }
              >
                Rename
              </button>
            </div>

            <div className="field">
              <label htmlFor={`${toolbarId}-move`}>Move “{selected.name}” under</label>
              <select
                id={`${toolbarId}-move`}
                value={moveTo}
                onChange={(event) => setMoveTo(event.target.value)}
              >
                <option value="">Choose a place…</option>
                <option value="__root__">Top level</option>
                {validMoveTargets.map(({ item, level }) => (
                  <option key={item.id} value={item.id}>
                    {'  '.repeat(level - 1)}
                    {item.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || moveTo === ''}
                onClick={() =>
                  void run(
                    moveItem(state, selected.id, moveTo === '__root__' ? null : moveTo),
                    (ok) => `Moved “${selected.name}”.${movedText(ok)}`,
                    () => setMoveTo(''),
                  )
                }
              >
                Move
              </button>
            </div>

            {confirmingDelete && impact ? (
              <div role="alertdialog" aria-label="Confirm delete" className="confirm">
                <p>
                  Delete “{selected.name}”? This also removes {impact.itemIds.length - 1} sub-
                  {plural(impact.itemIds.length - 1, 'item', 'items')} and{' '}
                  {impact.allocations.length} staffing{' '}
                  {plural(impact.allocations.length, 'allocation', 'allocations')} (
                  {impact.totalPm.toFixed(2)} person-months). This cannot be undone.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const result = deleteItem(state, selected.id);
                    if (!result.ok) {
                      setMessage({ kind: 'error', text: result.message });
                      return;
                    }
                    setBusy(true);
                    onCommit(result.state, result.impact.allocations)
                      .then(
                        () => {
                          setMessage({
                            kind: 'info',
                            text: `Deleted “${selected.name}” and ${result.impact.allocations.length} staffing ${plural(result.impact.allocations.length, 'allocation', 'allocations')}.`,
                          });
                          setSelectedId(null);
                          setConfirmingDelete(false);
                        },
                        (error: unknown) =>
                          setMessage({
                            kind: 'error',
                            text:
                              error instanceof Error
                                ? error.message
                                : 'The delete could not be saved.',
                          }),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)}>
                  Keep
                </button>
              </div>
            ) : (
              <button type="button" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                Delete “{selected.name}”…
              </button>
            )}
          </>
        ) : (
          <p className="muted">
            Select an item to rename, move or delete it, or to add a sub-item.
          </p>
        )}
      </div>

      {message ? (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={message.kind === 'error' ? 'error' : 'info'}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}

/** Items in tree order with their depth, for indenting a select list. */
function visibleOrder(
  childrenOf: ReadonlyMap<string | null, readonly BreakdownItem[]>,
): { item: BreakdownItem; level: number }[] {
  const rows: { item: BreakdownItem; level: number }[] = [];
  const walk = (parentId: string | null, level: number) => {
    for (const item of childrenOf.get(parentId) ?? []) {
      rows.push({ item, level });
      walk(item.id, level + 1);
    }
  };
  walk(null, 1);
  return rows;
}
