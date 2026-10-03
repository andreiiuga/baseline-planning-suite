import { useId, useMemo, useState } from 'react';
import { parseAmountInput } from '../domain/amountInput';
import { buildCapacityIndex } from '../domain/capacity';
import { formatYearMonth, parseYearMonth, type YearMonth } from '../domain/dates';
import { formatUnit, monthLabel } from '../domain/display';
import type { Allocation, BreakdownItem, Project } from '../domain/model';
import {
  buildStaffingGrid,
  contextFor,
  describeCulprit,
  itemPath,
  type Currency,
  type PeopleModel,
} from '../domain/staffing';
import { unitToPm, type Unit, type UnitInputFailure } from '../domain/units';
import type { AllocationCell } from '../ports/planRepository';
import { StaffingCell, type CellFlags } from './StaffingCell';

interface Props {
  readonly projectItems: readonly BreakdownItem[];
  /** Every project's items and allocations: capacity and culprit names are cross-project. */
  readonly allItems: readonly BreakdownItem[];
  readonly projects: readonly Project[];
  readonly allocations: readonly Allocation[];
  readonly months: readonly YearMonth[];
  readonly unit: Unit;
  readonly currency: Currency;
  /** Null while People is unavailable. */
  readonly people: PeopleModel | null;
  readonly onEdit: (cell: AllocationCell, amountPm: number) => Promise<Allocation>;
}

type Message = { readonly kind: 'info' | 'error' | 'warning'; readonly text: string };

const FAILURES: Record<UnitInputFailure, string> = {
  'invalid-number': 'That is not a usable number.',
  negative: 'Amounts cannot be negative.',
  'no-rate-coverage':
    'No rate covers this month, so cost cannot be entered here. Switch to hours, person-months or percent.',
  'people-unavailable': 'People is not available, so hours and cost cannot be converted.',
};

const cellKey = (itemId: string, employeeId: string, month: string): string =>
  `${itemId}|${employeeId}|${month}`;

export function StaffingGrid({
  projectItems,
  allItems,
  projects,
  allocations,
  months,
  unit,
  currency,
  people,
  onEdit,
}: Props) {
  const captionId = useId();
  const [message, setMessage] = useState<Message | null>(null);
  const [adding, setAdding] = useState<Readonly<Record<string, string>>>({});

  const grid = useMemo(
    () => buildStaffingGrid({ items: projectItems, allocations, months, unit, currency, people }),
    [projectItems, allocations, months, unit, currency, people],
  );
  const capacity = useMemo(() => buildCapacityIndex(allocations), [allocations]);
  const byCell = useMemo(
    () => new Map(allocations.map((a) => [cellKey(a.breakdownItemId, a.employeeId, a.month), a])),
    [allocations],
  );
  const monthKeys = useMemo(() => months.map(formatYearMonth), [months]);
  // Slicing a month by rate is not free and every cell needs it: compute each context once
  // per (people, months) rather than on every render.
  const contexts = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof contextFor>>();
    return (employeeId: string, month: YearMonth) => {
      if (!people) return null;
      const key = `${employeeId}|${formatYearMonth(month)}`;
      if (!cache.has(key)) cache.set(key, contextFor(people, employeeId, month));
      return cache.get(key) ?? null;
    };
  }, [people]);

  const rows = useMemo(() => {
    const out: { id: string; depth: number }[] = [];
    const walk = (id: string, depth: number) => {
      out.push({ id, depth });
      for (const childId of grid.items.get(id)?.childIds ?? []) walk(childId, depth + 1);
    };
    for (const rootId of grid.rootIds) walk(rootId, 0);
    return out;
  }, [grid]);

  const nameOf = (employeeId: string): string =>
    people?.employees.get(employeeId)?.name ?? employeeId;
  const itemName = (id: string): string => projectItems.find((i) => i.id === id)?.name ?? id;

  const overInView = useMemo(() => {
    const employeesHere = new Set(
      allocations
        .filter((a) => projectItems.some((i) => i.id === a.breakdownItemId))
        .map((a) => a.employeeId),
    );
    return capacity
      .overCapacity()
      .filter((load) => employeesHere.has(load.employeeId) && monthKeys.includes(load.month))
      .sort((a, b) => a.month.localeCompare(b.month) || a.employeeId.localeCompare(b.employeeId));
  }, [capacity, allocations, projectItems, monthKeys]);

  const commit = async (
    cell: AllocationCell,
    month: YearMonth,
    draft: string,
    shownText: string,
  ): Promise<void> => {
    // Unchanged text never writes: switching units back and forth cannot alter a stored value.
    if (draft.trim() === shownText) return;
    const typed = parseAmountInput(draft);
    if (typed === null) {
      setMessage({
        kind: 'error',
        text: `“${draft.trim()}” is not an amount. Enter a number such as 0.50.`,
      });
      return;
    }
    const context = contexts(cell.employeeId, month);
    // Cost is shown in the display currency but converted from EUR, the stored basis.
    const value = unit === 'eur' ? typed / currency.perEur : typed;
    const result = unitToPm(value, unit, context);
    if (!result.ok) {
      setMessage({ kind: 'error', text: FAILURES[result.reason] });
      return;
    }
    try {
      const stored = await onEdit(cell, result.pm);
      const after = allocations.some((a) => a.id === stored.id)
        ? allocations.map((a) => (a.id === stored.id ? stored : a))
        : [...allocations, stored];
      const load = buildCapacityIndex(after).get(cell.employeeId, cell.month);
      const saved = `Saved ${nameOf(cell.employeeId)}, ${itemName(cell.breakdownItemId)}, ${monthLabel(month)}.`;
      setMessage(
        load?.over
          ? {
              kind: 'warning',
              // Flagged, never blocked: the edit has been saved.
              text: `${saved} ${nameOf(cell.employeeId)} is over capacity in ${monthLabel(month)}. ${describeCulprit(load, allItems, projects)}`,
            }
          : { kind: 'info', text: saved },
      );
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'The edit could not be saved.',
      });
    }
  };

  const addPerson = async (itemId: string): Promise<void> => {
    const employeeId = adding[itemId];
    const firstMonth = months[0];
    if (!employeeId || !firstMonth) return;
    try {
      await onEdit({ breakdownItemId: itemId, employeeId, month: formatYearMonth(firstMonth) }, 0);
      setAdding((current) => ({ ...current, [itemId]: '' }));
      setMessage({ kind: 'info', text: `Added ${nameOf(employeeId)} to ${itemName(itemId)}.` });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not add the person.',
      });
    }
  };

  const flagsFor = (
    itemId: string,
    employeeId: string,
    monthText: string,
    month: YearMonth,
  ): CellFlags => {
    const allocation = byCell.get(cellKey(itemId, employeeId, monthText));
    const load = capacity.get(employeeId, monthText);
    const context = contexts(employeeId, month);
    const priced = allocation !== undefined && allocation.amount > 0;
    const coverage = context?.slicing.coverage ?? 'full';
    return {
      over: load?.over ?? false,
      overNote: load?.over ? describeCulprit(load, allItems, projects) : null,
      culprit: Boolean(
        load?.over && load.culprit && allocation && load.culprit.id === allocation.id,
      ),
      coverage: priced && coverage !== 'full' ? coverage : null,
      disabledReason:
        (unit === 'hours' || unit === 'eur') && !context
          ? 'Needs People data'
          : unit === 'eur' && coverage === 'none'
            ? 'No rate covers this month, so cost cannot be entered'
            : null,
    };
  };

  return (
    <section aria-labelledby={`${captionId}-title`} className="staffing">
      <h2 id={`${captionId}-title`}>Staffing</h2>
      <div className="grid-scroll">
        <table>
          <caption className="visually-hidden">
            Staffing by work item and person, month by month, in{' '}
            {unit === 'eur'
              ? currency.code
              : unit === 'pm'
                ? 'person-months'
                : unit === 'pct'
                  ? 'percent of capacity'
                  : 'hours'}
          </caption>
          <thead>
            <tr>
              <th scope="col">Work package / person</th>
              {months.map((month) => (
                <th key={formatYearMonth(month)} scope="col" className="num">
                  {monthLabel(month)}
                </th>
              ))}
              <th scope="col" className="num">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, depth }) => {
              const row = grid.items.get(id);
              const item = projectItems.find((i) => i.id === id);
              if (!row || !item) return null;
              const isLeaf = row.childIds.length === 0;
              const pickable = people
                ? [...people.employees.values()].filter(
                    (e) => !row.people.some((p) => p.employeeId === e.id),
                  )
                : [];
              return (
                <GridRowGroup key={id}>
                  <tr data-kind={isLeaf ? 'leaf' : 'parent'} data-item={id}>
                    <th scope="row" style={{ paddingLeft: `${0.5 + depth * 1}rem` }}>
                      {item.name} <span className="tag">derived</span>
                    </th>
                    {row.cells.map((cell, c) => (
                      <td key={monthKeys[c]} className="num derived">
                        {formatUnit(cell, unit)}
                      </td>
                    ))}
                    <td className="num derived total">{formatUnit(row.total, unit)}</td>
                  </tr>
                  {row.people.map((person) => (
                    <tr
                      key={person.employeeId}
                      data-kind="person"
                      data-item={id}
                      data-person={person.employeeId}
                    >
                      <th scope="row" style={{ paddingLeft: `${1.5 + depth * 1}rem` }}>
                        {nameOf(person.employeeId)}
                      </th>
                      {person.cells.map((scaled, c) => {
                        const month = months[c];
                        const monthText = monthKeys[c];
                        if (!month || !monthText) return null;
                        const shown = formatUnit(scaled, unit);
                        return (
                          <StaffingCell
                            key={monthText}
                            text={shown}
                            label={`${nameOf(person.employeeId)}, ${itemPath(allItems, id)}, ${monthLabel(month)}`}
                            flags={flagsFor(id, person.employeeId, monthText, month)}
                            onCommit={(draft) =>
                              commit(
                                {
                                  breakdownItemId: id,
                                  employeeId: person.employeeId,
                                  month: monthText,
                                },
                                parseYearMonth(monthText),
                                draft,
                                shown,
                              )
                            }
                          />
                        );
                      })}
                      <td className="num total">{formatUnit(person.total, unit)}</td>
                    </tr>
                  ))}
                  {isLeaf && people ? (
                    <tr data-kind="add-person" data-item={id}>
                      <td
                        colSpan={months.length + 2}
                        style={{ paddingLeft: `${1.5 + depth * 1}rem` }}
                      >
                        <label>
                          Add person to {item.name}{' '}
                          <select
                            value={adding[id] ?? ''}
                            onChange={(event) =>
                              setAdding((current) => ({ ...current, [id]: event.target.value }))
                            }
                          >
                            <option value="">Choose…</option>
                            {pickable.map((employee) => (
                              <option key={employee.id} value={employee.id}>
                                {employee.name}
                              </option>
                            ))}
                          </select>
                        </label>{' '}
                        <button
                          type="button"
                          disabled={!adding[id]}
                          onClick={() => void addPerson(id)}
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  ) : null}
                </GridRowGroup>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {grid.footer.cells.map((cell, c) => (
                <td key={monthKeys[c]} className="num">
                  {formatUnit(cell, unit)}
                </td>
              ))}
              <td className="num total">{formatUnit(grid.footer.total, unit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {message ? (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind}>
          {message.text}
        </p>
      ) : (
        <p role="status" className="visually-hidden" />
      )}

      {overInView.length > 0 ? (
        <section aria-label="Over capacity" className="over-list">
          <h3>Over capacity</h3>
          <ul>
            {overInView.map((load) => (
              <li key={`${load.employeeId}|${load.month}`}>
                <strong>{nameOf(load.employeeId)}</strong>, {monthLabel(parseYearMonth(load.month))}
                : {describeCulprit(load, allItems, projects)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

/** Groups the rows of one work item without adding a DOM node, which a table would not allow. */
function GridRowGroup({ children }: { readonly children: React.ReactNode }) {
  return <>{children}</>;
}
