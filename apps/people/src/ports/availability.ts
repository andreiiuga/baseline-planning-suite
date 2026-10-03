/**
 * What crosses the boundary to another app. "Unavailable" is a value, not an exception, so
 * the UI is forced to decide what to show when the other app is down.
 */
export type Availability<T> =
  { readonly status: 'ok'; readonly data: T } | { readonly status: 'unavailable' };

export const available = <T>(data: T): Availability<T> => ({ status: 'ok', data });
export const unavailable = <T>(): Availability<T> => ({ status: 'unavailable' });
