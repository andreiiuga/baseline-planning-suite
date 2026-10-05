import type { ReactNode } from 'react';
import type { RemoteName } from './config';
import { isPlainLeftClick, pathFor } from './navigation';

/** A real link, so open-in-new-tab and copy-link work, which the shell upgrades to in-page navigation. */
export function SectionLink({
  name,
  active,
  onNavigate,
  children,
}: {
  readonly name: RemoteName;
  readonly active: boolean;
  readonly onNavigate: (name: RemoteName) => void;
  readonly children: ReactNode;
}) {
  return (
    <a
      href={pathFor(name)}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        if (!isPlainLeftClick(event)) return;
        event.preventDefault();
        onNavigate(name);
      }}
    >
      {children}
    </a>
  );
}
