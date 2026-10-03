import type { ActiveUser } from '../contracts';

/** There is no auth: the active user is picked from a fixed list. */
export const USERS: readonly ActiveUser[] = [
  { id: 'user-1', name: 'Alex Planner' },
  { id: 'user-2', name: 'Sam Reviewer' },
  { id: 'user-3', name: 'Robin Lead' },
];

export const DEFAULT_USER: ActiveUser = { id: 'user-1', name: 'Alex Planner' };

export function userById(id: string | null): ActiveUser {
  return USERS.find((user) => user.id === id) ?? DEFAULT_USER;
}
