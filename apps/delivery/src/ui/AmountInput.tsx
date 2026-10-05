import { useState } from 'react';

interface Props {
  /** The value as shown, already formatted. */
  readonly text: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onCommit: (draft: string) => void | Promise<void>;
  /** Up and down arrows: commit, then let the caller move focus (a spreadsheet-style grid). */
  readonly onArrow?: (input: HTMLInputElement, direction: 'up' | 'down') => void;
  readonly className?: string;
}

/**
 * A text input for an amount. What is typed is held as a draft, so live updates arriving
 * meanwhile cannot clobber it. Enter or leaving the field commits, Escape abandons.
 * Committing is the caller's decision: it also receives text that did not change, and
 * decides not to write.
 */
export function AmountInput({
  text,
  label,
  disabled = false,
  onCommit,
  onArrow,
  className,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  const finish = () => {
    const pending = draft;
    setDraft(null);
    if (pending !== null) void onCommit(pending);
  };

  return (
    <input
      className={className}
      value={draft ?? text}
      aria-label={label}
      inputMode="decimal"
      disabled={disabled}
      onFocus={(event) => {
        setDraft(text);
        event.currentTarget.select();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={finish}
      onKeyDown={(event) => {
        if (event.key === 'Enter') finish();
        if (event.key === 'Escape') setDraft(null);
        if (onArrow && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          finish();
          onArrow(event.currentTarget, event.key === 'ArrowUp' ? 'up' : 'down');
        }
      }}
    />
  );
}
