/** Collision-resistant enough for a single-user local store, and works on plain http. */
export function newItemId(): string {
  return `wbs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
