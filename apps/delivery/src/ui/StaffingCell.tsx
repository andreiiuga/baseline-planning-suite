import { AmountInput } from './AmountInput';

export interface CellFlags {
  /** This person is allocated beyond capacity in this month (across all projects). */
  readonly over: boolean;
  /** Names the allocation that caused it. */
  readonly overNote: string | null;
  /** This very allocation is the most recently edited one. */
  readonly culprit: boolean;
  /** Part or all of the month has no rate, so some or all of its cost is zero. */
  readonly coverage: 'partial' | 'none' | null;
  /** Why this cell cannot be edited in the current unit, if it cannot. */
  readonly disabledReason: string | null;
}

interface Props {
  readonly text: string;
  readonly label: string;
  readonly flags: CellFlags;
  readonly onCommit: (draft: string) => void | Promise<void>;
}

const COVERAGE_NOTES = {
  none: 'No rate covers this month: the cost is zero.',
  partial: 'A rate starts mid-month: working days before it cost nothing.',
} as const;

/** Moves focus to the same column of the previous or next person row. */
function focusNeighbour(input: HTMLInputElement, direction: 'up' | 'down'): void {
  const cell = input.closest('td');
  const row = cell?.parentElement;
  if (!cell || !row) return;
  const column = [...row.children].indexOf(cell);
  const step = (element: Element | null) =>
    direction === 'up'
      ? (element?.previousElementSibling ?? null)
      : (element?.nextElementSibling ?? null);
  for (let sibling = step(row); sibling; sibling = step(sibling)) {
    const target = sibling.children[column]?.querySelector('input');
    if (target) {
      target.focus();
      return;
    }
  }
}

/** One editable cell. Typing and committing live in `AmountInput`; this adds the flags. */
export function StaffingCell({ text, label, flags, onCommit }: Props) {
  const notes = [
    flags.over ? `Over capacity. ${flags.overNote ?? ''}` : null,
    flags.coverage ? COVERAGE_NOTES[flags.coverage] : null,
    flags.disabledReason,
  ].filter(Boolean);

  return (
    <td
      className="num cell"
      data-over={flags.over || undefined}
      data-culprit={flags.culprit || undefined}
      data-coverage={flags.coverage ?? undefined}
      title={notes.join(' ') || undefined}
    >
      <AmountInput
        text={text}
        label={label}
        disabled={flags.disabledReason !== null}
        onCommit={onCommit}
        onArrow={focusNeighbour}
      />
      {flags.over ? (
        <span
          className="flag"
          aria-label={`Over capacity${flags.culprit ? ', most recently edited' : ''}`}
        >
          †
        </span>
      ) : null}
      {flags.coverage ? (
        <span className="flag" aria-label={COVERAGE_NOTES[flags.coverage]}>
          {flags.coverage === 'none' ? 'no rate' : 'part'}
        </span>
      ) : null}
    </td>
  );
}
