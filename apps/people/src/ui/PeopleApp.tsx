import { useEffect, useMemo, useState } from 'react';
import type { PeopleAppProps } from '../AppProps';
import { newRateId } from '../domain/ids';
import type { Employee, RateRecord } from '../domain/model';
import { searchEmployees } from '../domain/search';
import type { PeopleRepository } from '../ports/peopleRepository';
import { EmployeeRegister } from './EmployeeRegister';
import { PEOPLE_CSS } from './people.css';
import { RateHistory } from './RateHistory';
import { useOversubscription } from './useOversubscription';

export interface PeopleAppViewProps extends PeopleAppProps {
  readonly repository: PeopleRepository;
  /** Overridable so tests get predictable ids. */
  readonly createId?: () => string;
}

/** The whole People UI. `App.tsx` is the federated entry that supplies the repository. */
export function PeopleApp({
  repository,
  allocationTotals,
  bus,
  currency,
  createId = newRateId,
}: PeopleAppViewProps) {
  const [employees, setEmployees] = useState<readonly Employee[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [histories, setHistories] = useState<Readonly<Record<string, readonly RateRecord[]>>>({});

  useEffect(() => {
    let mounted = true;
    repository.listEmployees().then(
      (list) => mounted && setEmployees(list),
      (error: unknown) =>
        mounted &&
        setLoadError(error instanceof Error ? error.message : 'Could not load employees'),
    );
    return () => {
      mounted = false;
    };
  }, [repository]);

  useEffect(() => {
    if (selectedId === null || histories[selectedId]) return;
    let mounted = true;
    void repository.getRates([selectedId]).then((rates) => {
      if (mounted)
        setHistories((current) => ({ ...current, [selectedId]: rates[selectedId] ?? [] }));
    });
    return () => {
      mounted = false;
    };
  }, [repository, selectedId, histories]);

  const employeeIds = useMemo(() => (employees ?? []).map((e) => e.id), [employees]);
  const capacity = useOversubscription(allocationTotals, bus, employeeIds);

  const visible = useMemo(() => searchEmployees(employees ?? [], query), [employees, query]);
  const selected = employees?.find((e) => e.id === selectedId) ?? null;
  const selectedHistory = selected ? histories[selected.id] : undefined;

  const saveHistory = async (employeeId: string, next: readonly RateRecord[]): Promise<void> => {
    await repository.replaceRates(employeeId, next);
    setHistories((current) => ({ ...current, [employeeId]: next }));
    // One notification per save; Delivery re-reads the rates through its port.
    bus.publish({ type: 'rate:changed', employeeId });
  };

  if (loadError) return <p role="alert">People could not load its data: {loadError}</p>;
  if (!employees) return <p>Loading employees…</p>;

  return (
    <div className="people">
      <style>{PEOPLE_CSS}</style>
      <div>
        {capacity.status === 'unavailable' ? (
          <p className="notice" role="status">
            Capacity data is unavailable (Delivery is not loaded), so oversubscription is not shown.
          </p>
        ) : null}
        <EmployeeRegister
          employees={visible}
          query={query}
          onQueryChange={setQuery}
          selectedId={selectedId}
          onSelect={setSelectedId}
          capacity={capacity}
        />
      </div>
      {selected && selectedHistory ? (
        <RateHistory
          key={selected.id}
          employee={selected}
          history={selectedHistory}
          currency={currency}
          createId={createId}
          oversubscribedMonths={
            capacity.status === 'ok' ? capacity.byEmployee.get(selected.id) : undefined
          }
          onSave={(next) => saveHistory(selected.id, next)}
        />
      ) : (
        <p className="muted">
          {selected ? 'Loading rates…' : 'Select an employee to see and edit their rate history.'}
        </p>
      )}
    </div>
  );
}
