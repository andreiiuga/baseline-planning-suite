import { useState } from 'react';

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

/** One editable cell. Text is held as a draft while editing so live updates cannot clobber typing. */
export function StaffingCell({ text, label, flags, onCommit }: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  const finish = () => {
    const pending = draft;
    setDraft(null);
    if (pending !== null) void onCommit(pending);
  };

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
      <input
        value={draft ?? text}
        aria-label={label}
        inputMode="decimal"
        disabled={flags.disabledReason !== null}
        onFocus={(event) => {
          setDraft(text);
          event.currentTarget.select();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === 'Enter') finish();
          if (event.key === 'Escape') setDraft(null);
        }}
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
