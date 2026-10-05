import { useMemo, useState } from 'react';
import { parseAmountInput } from '../domain/amountInput';
import {
  amountThatFits,
  buildCapacityIndex,
  excessPm,
  type PersonMonthLoad,
} from '../domain/capacity';
import { parseYearMonth } from '../domain/dates';
import { formatUnit, monthLabel } from '../domain/display';
import type { Allocation, BreakdownItem, Project } from '../domain/model';
import { toScaled } from '../domain/rounding';
import { itemPath, type PeopleModel } from '../domain/staffing';
import { unitToPm } from '../domain/units';
import type { AllocationCell } from '../ports/planRepository';
import { AmountInput } from './AmountInput';

interface Props {
  /** Every project's allocations: capacity is counted across all of them. */
  readonly allocations: readonly Allocation[];
  readonly items: readonly BreakdownItem[];
  readonly projects: readonly Project[];
  /** Null while People is unavailable: people are then shown by id. */
  readonly people: PeopleModel | null;
  readonly onEdit: (cell: AllocationCell, amountPm: number) => Promise<Allocation>;
}

type Message = { readonly kind: 'info' | 'warning' | 'error'; readonly text: string };

const pm = (amount: number): string => formatUnit(toScaled(amount, 2), 'pm');

/** "0.18", or "<0.01" so a tiny excess is not shown as a misleading 0.00. */
const excessText = (excess: number): string => (excess < 0.005 ? '<0.01' : pm(excess));

/**
 * Who is over capacity, and why: every allocation that makes up each over-capacity
 * person-month, across all projects, with its amount editable in place. Edits are saved
 * immediately and never blocked, like everywhere else. A row leaves the list once the person
 * is back within capacity.
 */
export function OverCapacityView({ allocations, items, projects, people, onEdit }: Props) {
  const [message, setMessage] = useState<Message | null>(null);
  const nameOf = (employeeId: string): string =>
    people?.employees.get(employeeId)?.name ?? employeeId;
  const projectOf = (itemId: string): string =>
    projects.find((p) => p.id === items.find((i) => i.id === itemId)?.projectId)?.name ?? '';

  const loads = useMemo(() => {
    const name = (employeeId: string) => people?.employees.get(employeeId)?.name ?? employeeId;
    return [...buildCapacityIndex(allocations).overCapacity()].sort(
      (a, b) =>
        a.month.localeCompare(b.month) || name(a.employeeId).localeCompare(name(b.employeeId)),
    );
  }, [allocations, people]);

  const save = async (
    allocation: Allocation,
    amountPm: number,
    load: PersonMonthLoad,
  ): Promise<void> => {
    try {
      const stored = await onEdit(
        {
          breakdownItemId: allocation.breakdownItemId,
          employeeId: allocation.employeeId,
          month: allocation.month,
        },
        amountPm,
      );
      const after = allocations.map((a) => (a.id === stored.id ? stored : a));
      const now = buildCapacityIndex(after).get(load.employeeId, load.month);
      const who = `${nameOf(load.employeeId)}, ${monthLabel(parseYearMonth(load.month))}`;
      setMessage(
        now?.over
          ? {
              kind: 'warning',
              text: `Saved. ${who} is still over capacity, by ${excessText(excessPm(now))} person-months.`,
            }
          : { kind: 'info', text: `Saved. ${who} is now within capacity.` },
      );
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'The edit could not be saved.',
      });
    }
  };

  const commit = (allocation: Allocation, load: PersonMonthLoad, draft: string): void => {
    // Unchanged text never writes, so tabbing through a field cannot alter a stored amount.
    if (draft.trim() === pm(allocation.amount)) return;
    const typed = parseAmountInput(draft);
    if (typed === null) {
      setMessage({
        kind: 'error',
        text: `“${draft.trim()}” is not an amount. Enter a number such as 0.40.`,
      });
      return;
    }
    const result = unitToPm(typed, 'pm', null);
    if (!result.ok) {
      setMessage({ kind: 'error', text: 'Amounts cannot be negative.' });
      return;
    }
    void save(allocation, result.pm, load);
  };

  return (
    <section aria-labelledby="over-capacity-title" className="over-capacity">
      <h2 id="over-capacity-title">Over capacity</h2>
      <p className="muted">
        Each person-month below is allocated beyond one person-month, counted across every project.
        Correct the amounts that make it up; a row disappears once the person is back within
        capacity.
      </p>

      {message ? (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind}>
          {message.text}
        </p>
      ) : (
        <p role="status" className="visually-hidden" />
      )}

      {loads.length === 0 ? (
        <p>Nobody is over capacity.</p>
      ) : (
        <ul className="over-rows">
          {loads.map((load) => {
            const month = monthLabel(parseYearMonth(load.month));
            const excess = excessPm(load);
            return (
              <li
                key={`${load.employeeId}|${load.month}`}
                data-employee={load.employeeId}
                data-month={load.month}
              >
                <h3>
                  {nameOf(load.employeeId)} · {month}
                </h3>
                <p>
                  {pm(load.totalPm)} person-months allocated, over by{' '}
                  <strong>{excessText(excess)}</strong>.
                </p>
                <table>
                  <caption className="visually-hidden">
                    Allocations making up {nameOf(load.employeeId)}’s {month}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Project</th>
                      <th scope="col">Work item</th>
                      <th scope="col" className="num">
                        Person-months
                      </th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {load.contributors.map((allocation, index) => {
                      const fit = amountThatFits(allocation, load);
                      const where = itemPath(items, allocation.breakdownItemId);
                      return (
                        <tr key={allocation.id} data-allocation={allocation.id}>
                          <th scope="row">{projectOf(allocation.breakdownItemId)}</th>
                          <td>
                            {where}
                            {index === 0 ? (
                              <span className="tag latest"> most recently edited</span>
                            ) : null}
                          </td>
                          <td className="num">
                            <AmountInput
                              className="amount"
                              text={pm(allocation.amount)}
                              label={`${nameOf(load.employeeId)}, ${where}, ${month}`}
                              onCommit={(draft) => commit(allocation, load, draft)}
                            />
                          </td>
                          <td>
                            <button type="button" onClick={() => void save(allocation, fit, load)}>
                              Reduce to {pm(fit)}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
