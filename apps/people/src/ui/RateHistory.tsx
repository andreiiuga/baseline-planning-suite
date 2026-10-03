import { useId, useState, type FormEvent } from 'react';
import type { Currency } from '../AppProps';
import { formatMoney } from '../domain/money';
import type { Employee, RateRecord } from '../domain/model';
import {
  addRate,
  correctRate,
  RATE_ERROR_MESSAGES,
  rateTimeline,
  removeRate,
  type RateFieldErrors,
} from '../domain/rateHistory';

interface Props {
  readonly employee: Employee;
  readonly history: readonly RateRecord[];
  readonly currency: Currency;
  /** Persist the new history; resolves when saved, rejects with a message-bearing error. */
  readonly onSave: (history: readonly RateRecord[]) => Promise<void>;
  readonly createId: () => string;
  /** Months in which this person is allocated beyond capacity, if Delivery reported any. */
  readonly oversubscribedMonths: readonly string[] | undefined;
}

type Mode = { readonly kind: 'add' } | { readonly kind: 'edit'; readonly id: string };

const EMPTY_FORM = { validFrom: '', hourlyCost: '' };

export function RateHistory({
  employee,
  history,
  currency,
  onSave,
  createId,
  oversubscribedMonths,
}: Props) {
  const formId = useId();
  const [mode, setMode] = useState<Mode>({ kind: 'add' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<RateFieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const timeline = rateTimeline(history);
  const showConverted = currency.code !== 'EUR';

  const reset = () => {
    setMode({ kind: 'add' });
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const persist = async (next: readonly RateRecord[]): Promise<boolean> => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(next);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The change could not be saved.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result =
      mode.kind === 'add'
        ? addRate(history, { id: createId(), employeeId: employee.id, ...form })
        : correctRate(history, mode.id, form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    if (await persist(result.history)) reset();
  };

  const startEdit = (record: RateRecord) => {
    setMode({ kind: 'edit', id: record.id });
    setForm({ validFrom: record.validFrom, hourlyCost: String(record.hourlyCost) });
    setErrors({});
    setPendingRemove(null);
  };

  const confirmRemove = async (id: string) => {
    if (await persist(removeRate(history, id))) {
      setPendingRemove(null);
      if (mode.kind === 'edit' && mode.id === id) reset();
    }
  };

  const dateError = errors.validFrom ? RATE_ERROR_MESSAGES[errors.validFrom] : null;
  const costError = errors.hourlyCost ? RATE_ERROR_MESSAGES[errors.hourlyCost] : null;

  return (
    <section aria-labelledby={`${formId}-title`} className="rate-history">
      <h2 id={`${formId}-title`}>{employee.name}</h2>
      <p className="muted">
        {employee.role} · {employee.weeklyHours} h/week
      </p>
      {oversubscribedMonths ? (
        <p className="badge" role="status">
          Oversubscribed in {oversubscribedMonths.join(', ')}
        </p>
      ) : null}

      <h3>Rate history</h3>
      {timeline.length === 0 ? (
        <p>No rates yet. Work allocated to {employee.name} costs nothing until a rate is added.</p>
      ) : (
        <table>
          <caption className="visually-hidden">Hourly cost rates for {employee.name}</caption>
          <thead>
            <tr>
              <th scope="col">Valid from</th>
              <th scope="col">Replaced on</th>
              <th scope="col">EUR / h</th>
              {showConverted ? <th scope="col">{currency.code} / h</th> : null}
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.validFrom}</th>
                <td>{row.validUntil ?? 'open-ended'}</td>
                <td>{row.hourlyCost.toFixed(2)}</td>
                {showConverted ? <td>{formatMoney(row.hourlyCost, currency.perEur)}</td> : null}
                <td>
                  {pendingRemove === row.id ? (
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void confirmRemove(row.id)}
                      >
                        Confirm remove {row.validFrom}
                      </button>
                      <button type="button" onClick={() => setPendingRemove(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => startEdit(row)}>
                        Edit {row.validFrom}
                      </button>
                      <button type="button" onClick={() => setPendingRemove(row.id)}>
                        Remove {row.validFrom}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={(event) => void submit(event)} noValidate aria-label="Rate form">
        <h3>{mode.kind === 'add' ? 'Add a rate' : 'Correct this rate'}</h3>
        <div className="field">
          <label htmlFor={`${formId}-from`}>Valid from (YYYY-MM-DD)</label>
          <input
            id={`${formId}-from`}
            value={form.validFrom}
            inputMode="numeric"
            placeholder="2026-03-12"
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateError ? `${formId}-from-error` : undefined}
            onChange={(event) => setForm({ ...form, validFrom: event.target.value })}
          />
          {dateError ? (
            <p id={`${formId}-from-error`} role="alert" className="error">
              {dateError}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor={`${formId}-cost`}>Hourly cost (EUR)</label>
          <input
            id={`${formId}-cost`}
            value={form.hourlyCost}
            inputMode="decimal"
            placeholder="95.00"
            aria-invalid={costError ? true : undefined}
            aria-describedby={costError ? `${formId}-cost-error` : undefined}
            onChange={(event) => setForm({ ...form, hourlyCost: event.target.value })}
          />
          {costError ? (
            <p id={`${formId}-cost-error`} role="alert" className="error">
              {costError}
            </p>
          ) : null}
        </div>
        {showConverted && /^\d+(\.\d{1,2})?$/.test(form.hourlyCost.trim()) ? (
          <p className="muted">
            ≈ {formatMoney(Number(form.hourlyCost), currency.perEur)} {currency.code} / h (display
            only, rates are stored in EUR)
          </p>
        ) : null}
        {saveError ? (
          <p role="alert" className="error">
            {saveError}
          </p>
        ) : null}
        <button type="submit" disabled={saving}>
          {mode.kind === 'add' ? 'Add rate' : 'Save rate'}
        </button>
        {mode.kind === 'edit' ? (
          <button type="button" onClick={reset}>
            Cancel
          </button>
        ) : null}
      </form>
    </section>
  );
}
