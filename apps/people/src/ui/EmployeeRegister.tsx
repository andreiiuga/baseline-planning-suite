import { useId } from 'react';
import type { Employee } from '../domain/model';
import type { CapacityState } from './useOversubscription';

interface Props {
  readonly employees: readonly Employee[];
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly capacity: CapacityState;
}

export function EmployeeRegister({
  employees,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  capacity,
}: Props) {
  const searchId = useId();
  return (
    <section aria-labelledby={`${searchId}-title`} className="register">
      <h2 id={`${searchId}-title`}>Employees</h2>
      <label htmlFor={searchId}>Search by name or role</label>
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        autoComplete="off"
      />
      <p role="status" className="muted">
        {employees.length} {employees.length === 1 ? 'person' : 'people'}
      </p>
      {employees.length === 0 ? (
        <p>No employees match “{query}”.</p>
      ) : (
        <ul className="register-list">
          {employees.map((employee) => {
            const months =
              capacity.status === 'ok' ? capacity.byEmployee.get(employee.id) : undefined;
            return (
              <li key={employee.id}>
                <button
                  type="button"
                  aria-current={employee.id === selectedId ? 'true' : undefined}
                  onClick={() => onSelect(employee.id)}
                >
                  <span className="name">{employee.name}</span>
                  <span className="muted">
                    {employee.role} · {employee.weeklyHours} h/week
                  </span>
                  {months ? (
                    <span className="badge" title={`Over capacity in ${months.join(', ')}`}>
                      Oversubscribed
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
