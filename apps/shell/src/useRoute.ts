import { useCallback, useEffect, useState } from 'react';
import type { RemoteName } from './config';
import { DEFAULT_SECTION, pathFor, sectionForPath } from './navigation';

/**
 * The active section, kept in step with the URL through the History API. The shell owns only
 * this top level (`/people`, `/delivery`): what happens inside a section is the remote's own
 * business, and nothing here is passed to it.
 */
export function useRoute(): {
  readonly active: RemoteName;
  readonly navigate: (name: RemoteName) => void;
} {
  const [active, setActive] = useState<RemoteName>(
    () => sectionForPath(window.location.pathname) ?? DEFAULT_SECTION,
  );

  // `/` and unknown paths get a canonical URL, replacing the entry so Back does not bounce.
  useEffect(() => {
    if (sectionForPath(window.location.pathname) === null) {
      window.history.replaceState(null, '', pathFor(DEFAULT_SECTION));
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const section = sectionForPath(window.location.pathname);
      if (section === null) window.history.replaceState(null, '', pathFor(DEFAULT_SECTION));
      setActive(section ?? DEFAULT_SECTION);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback(
    (name: RemoteName) => {
      if (name === active) return;
      window.history.pushState(null, '', pathFor(name));
      setActive(name);
    },
    [active],
  );

  return { active, navigate };
}
