import { useEffect, useState } from 'react';
import type { DeliveryAppProps } from './AppProps';
import { getPlanRepository } from './adapters/idb/sharedRepository';
import type { PlanRepository } from './ports/planRepository';
import { DeliveryApp } from './ui/DeliveryApp';

/** The federated entry (`delivery/App`): opens Delivery's own storage, then renders the UI. */
export default function App(props: DeliveryAppProps) {
  const [repository, setRepository] = useState<PlanRepository | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getPlanRepository().then(
      (repo) => mounted && setRepository(repo),
      (cause: unknown) =>
        mounted && setError(cause instanceof Error ? cause.message : 'storage could not be opened'),
    );
    return () => {
      mounted = false;
    };
  }, []);

  if (error) return <p role="alert">Delivery storage is unavailable: {error}</p>;
  if (!repository) return <p>Opening Delivery…</p>;
  return <DeliveryApp {...props} repository={repository} />;
}
