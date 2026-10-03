export const REMOTE_NAMES = ['people', 'delivery'] as const;
export type RemoteName = (typeof REMOTE_NAMES)[number];

export interface ShellConfig {
  readonly remotes: Readonly<Record<RemoteName, string>>;
}

export type ConfigResult =
  | { readonly ok: true; readonly config: ShellConfig }
  | { readonly ok: false; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseConfig(raw: unknown): ConfigResult {
  if (!isRecord(raw) || !isRecord(raw['remotes'])) {
    return { ok: false, reason: 'config.json must contain a "remotes" object' };
  }
  const urls: Partial<Record<RemoteName, string>> = {};
  for (const name of REMOTE_NAMES) {
    const url = raw['remotes'][name];
    if (typeof url !== 'string' || !isHttpUrl(url)) {
      return { ok: false, reason: `remotes.${name} must be an absolute http(s) URL` };
    }
    urls[name] = url;
  }
  const { people, delivery } = urls;
  if (people === undefined || delivery === undefined) {
    return { ok: false, reason: 'remote URLs missing' };
  }
  return { ok: true, config: { remotes: { people, delivery } } };
}

export async function loadConfig(fetchImpl: typeof fetch = fetch): Promise<ConfigResult> {
  try {
    const response = await fetchImpl('/config.json', { cache: 'no-store' });
    if (!response.ok) {
      return { ok: false, reason: `GET /config.json returned ${response.status}` };
    }
    return parseConfig(await response.json());
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `could not load /config.json: ${detail}` };
  }
}
