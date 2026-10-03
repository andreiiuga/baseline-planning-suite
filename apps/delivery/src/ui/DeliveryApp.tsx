import { useMemo, useState } from 'react';
import type { DeliveryAppProps } from '../AppProps';
import type { PlanRepository } from '../ports/planRepository';
import { BreakdownPanel } from './BreakdownPanel';
import { DELIVERY_CSS } from './delivery.css';
import { usePeopleModel } from './usePeopleModel';
import { usePlan } from './usePlan';

export interface DeliveryAppViewProps extends DeliveryAppProps {
  readonly repository: PlanRepository;
}

/** The whole Delivery UI. `App.tsx` is the federated entry that supplies the repository. */
export function DeliveryApp({ repository, employeeQuery, rateQuery, bus }: DeliveryAppViewProps) {
  const { state, actions } = usePlan(repository, bus);
  const people = usePeopleModel(employeeQuery, rateQuery, bus);
  const [projectId, setProjectId] = useState<string | null>(null);

  const snapshot = state.status === 'ready' ? state.snapshot : null;
  const activeProjectId = projectId ?? snapshot?.projects[0]?.id ?? null;
  const tree = useMemo(
    () => (snapshot ? { items: snapshot.items, allocations: snapshot.allocations } : null),
    [snapshot],
  );

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
      </div>
      <div className="layout">
        <BreakdownPanel
          key={activeProjectId}
          projectId={activeProjectId}
          state={tree}
          onCommit={actions.applyTree}
        />
      </div>
    </div>
  );
}
