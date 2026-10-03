/** The shell's only persistence: two preferences in localStorage, under one prefix. */
const PREFIX = 'baseline-shell:';

/** Storage can be blocked or full (private windows, embedded previews): never let it throw. */
export function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // The choice still applies for this session.
  }
}
