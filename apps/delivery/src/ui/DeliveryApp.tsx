import { useMemo, useState } from 'react';
import type { DeliveryAppProps } from '../AppProps';
import { addMonths, monthRange, parseYearMonth, type YearMonth } from '../domain/dates';
import { monthLabel } from '../domain/display';
import { unitNeedsPeople } from '../domain/staffing';
import { UNITS, type Unit } from '../domain/units';
import type { PlanRepository } from '../ports/planRepository';
import { BreakdownPanel } from './BreakdownPanel';
import { StaffingGrid } from './StaffingGrid';
import { DELIVERY_CSS } from './delivery.css';
import { usePeopleModel } from './usePeopleModel';
import { usePlan } from './usePlan';

/** The grid horizon in the fixtures: April 2026 to March 2027. */
const DEFAULT_WINDOW_START = parseYearMonth('2026-04');
const WINDOW_LENGTH = 12;

const UNIT_LABELS: Record<Unit, (currencyCode: string) => string> = {
  pm: () => 'Person-months',
  hours: () => 'Hours',
  pct: () => '% of capacity',
  eur: (code) => `Cost (${code})`,
};

export interface DeliveryAppViewProps extends DeliveryAppProps {
  readonly repository: PlanRepository;
}

/** The whole Delivery UI. `App.tsx` is the federated entry that supplies the repository. */
export function DeliveryApp({
  repository,
  employeeQuery,
  rateQuery,
  bus,
  currency,
}: DeliveryAppViewProps) {
  const { state, actions } = usePlan(repository, bus);
  const people = usePeopleModel(employeeQuery, rateQuery, bus);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [requestedUnit, setRequestedUnit] = useState<Unit>('pm');
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [windowStart, setWindowStart] = useState<YearMonth>(DEFAULT_WINDOW_START);
  const months = useMemo(
    () => monthRange(windowStart, addMonths(windowStart, WINDOW_LENGTH - 1)),
    [windowStart],
  );

  const snapshot = state.status === 'ready' ? state.snapshot : null;
  const activeProjectId = projectId ?? snapshot?.projects[0]?.id ?? null;
  const tree = useMemo(
    () => (snapshot ? { items: snapshot.items, allocations: snapshot.allocations } : null),
    [snapshot],
  );

  const projectItems = useMemo(
    () => (snapshot ? snapshot.items.filter((item) => item.projectId === activeProjectId) : []),
    [snapshot, activeProjectId],
  );
  const peopleModel = people.status === 'ok' ? people.model : null;
  // Hours and cost need People. If it goes away while one is selected, fall back to a unit that
  // still works rather than showing numbers that would be wrong.
  const unit: Unit = unitNeedsPeople(requestedUnit) && !peopleModel ? 'pm' : requestedUnit;

  if (state.status === 'loading') return <p>Loading the plan…</p>;
  if (state.status === 'error') {
    return <p role="alert">Delivery could not load its data: {state.message}</p>;
  }
  if (!tree || !activeProjectId || !snapshot) return <p>There are no projects.</p>;

  return (
    <div className="delivery">
      <style>{DELIVERY_CSS}</style>
      {people.status === 'unavailable' ? (
        <p className="notice" role="status">
          People is not available, so hours and cost cannot be shown. Person-months and percent
          still work.
        </p>
      ) : null}
      <div className="toolbar">
        <div className="field">
          <label htmlFor="delivery-project">Project</label>
          <select
            id="delivery-project"
            value={activeProjectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            {snapshot.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="unit-switch">
          <legend>Show as</legend>
          {UNITS.map((candidate) => (
            <label key={candidate}>
              <input
                type="radio"
                name="delivery-unit"
                value={candidate}
                checked={unit === candidate}
                disabled={unitNeedsPeople(candidate) && !peopleModel}
                onChange={() => setRequestedUnit(candidate)}
              />
              {UNIT_LABELS[candidate](currency.code)}
            </label>
          ))}
        </fieldset>
        <div className="field reset">
          {confirmingReset ? (
            <span role="group" aria-label="Confirm reset">
              Restore the shipped plan? Your edits will be lost.{' '}
              <button
                type="button"
                onClick={() => void actions.reset().then(() => setConfirmingReset(false))}
              >
                Yes, reset
              </button>{' '}
              <button type="button" onClick={() => setConfirmingReset(false)}>
                Keep my data
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmingReset(true)}>
              Reset demo data
            </button>
          )}
        </div>
        <div className="field">
          <span id="delivery-window-label">Months</span>
          <div role="group" aria-labelledby="delivery-window-label">
            <button type="button" onClick={() => setWindowStart(addMonths(windowStart, -1))}>
              ← Earlier
            </button>{' '}
            <span>
              {monthLabel(months[0] ?? windowStart)} – {monthLabel(months.at(-1) ?? windowStart)}
            </span>{' '}
            <button type="button" onClick={() => setWindowStart(addMonths(windowStart, 1))}>
              Later →
            </button>
            <button type="button" onClick={() => setWindowStart(DEFAULT_WINDOW_START)}>
              Reset window
            </button>
          </div>
        </div>
      </div>
      <div className="layout">
        <BreakdownPanel
          key={activeProjectId}
          projectId={activeProjectId}
          state={tree}
          onCommit={actions.applyTree}
        />
        <StaffingGrid
          projectItems={projectItems}
          allItems={snapshot.items}
          projects={snapshot.projects}
          allocations={snapshot.allocations}
          months={months}
          unit={unit}
          currency={currency}
          people={peopleModel}
          onEdit={actions.editCell}
        />
      </div>
    </div>
  );
}
