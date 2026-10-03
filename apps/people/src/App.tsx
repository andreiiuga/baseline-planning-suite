import { useEffect, useState } from 'react';
import type { PeopleAppProps } from './AppProps';
import { getPeopleRepository } from './adapters/idb/sharedRepository';
import type { PeopleRepository } from './ports/peopleRepository';
import { PeopleApp } from './ui/PeopleApp';

/** The federated entry (`people/App`): opens People's own storage, then renders the UI. */
export default function App(props: PeopleAppProps) {
  const [repository, setRepository] = useState<PeopleRepository | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getPeopleRepository().then(
      (repo) => mounted && setRepository(repo),
      (cause: unknown) =>
        mounted && setError(cause instanceof Error ? cause.message : 'storage could not be opened'),
    );
    return () => {
      mounted = false;
    };
  }, []);

  if (error) return <p role="alert">People storage is unavailable: {error}</p>;
  if (!repository) return <p>Opening People…</p>;
  return <PeopleApp {...props} repository={repository} />;
}
