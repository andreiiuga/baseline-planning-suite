import type { RemoteName } from './config';

/**
 * Panels stay mounted once visited, hidden while inactive, so a Delivery view that is "open"
 * in the background still receives live updates from People.
 */
export function markVisited(
  visited: ReadonlySet<RemoteName>,
  name: RemoteName,
): ReadonlySet<RemoteName> {
  return visited.has(name) ? visited : new Set([...visited, name]);
}
