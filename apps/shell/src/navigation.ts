import { REMOTE_NAMES, type RemoteName } from './config';

export const SECTIONS: readonly { readonly name: RemoteName; readonly label: string }[] = [
  { name: 'people', label: 'People' },
  { name: 'delivery', label: 'Delivery' },
];

export const DEFAULT_SECTION: RemoteName = 'people';

export const pathFor = (name: RemoteName): string => `/${name}`;

/**
 * Which section a URL path belongs to, or null if it belongs to none. Only the first path
 * segment counts, so a remote can later own anything below `/people/...` without the shell
 * having to know about it. Query and hash are not part of a pathname.
 */
export function sectionForPath(pathname: string): RemoteName | null {
  const first = pathname.split('/').find((segment) => segment !== '');
  return REMOTE_NAMES.find((name) => name === first) ?? null;
}

export const titleFor = (name: RemoteName): string =>
  `${SECTIONS.find((section) => section.name === name)?.label ?? name} · Baseline`;

/**
 * A plain left click is the shell's to handle. Anything else (open in new tab, new window,
 * download, middle click) must be left to the browser, or links would stop behaving like links.
 */
export function isPlainLeftClick(event: {
  readonly button: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly defaultPrevented: boolean;
}): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

/**
 * Panels stay mounted once visited, hidden while inactive, so a Delivery view that is "open"
 * in the background still receives live updates from People. Routing only changes which
 * panel is visible; it never unmounts one.
 */
export function markVisited(
  visited: ReadonlySet<RemoteName>,
  name: RemoteName,
): ReadonlySet<RemoteName> {
  return visited.has(name) ? visited : new Set([...visited, name]);
}
