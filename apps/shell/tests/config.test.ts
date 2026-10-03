import { describe, expect, it } from 'vitest';
import { loadConfig, parseConfig } from '../src/config';

const valid = {
  remotes: {
    people: 'http://localhost:8081/remoteEntry.js',
    delivery: 'https://example.test/delivery/remoteEntry.js',
  },
};

describe('parseConfig', () => {
  it('accepts a well-formed config', () => {
    expect(parseConfig(valid)).toEqual({ ok: true, config: valid });
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['no remotes key', {}],
    ['remotes is a string', { remotes: 'x' }],
  ])('rejects %s', (_label, raw) => {
    expect(parseConfig(raw).ok).toBe(false);
  });

  it('names the remote whose URL is missing', () => {
    const result = parseConfig({ remotes: { people: valid.remotes.people } });
    expect(result).toEqual({
      ok: false,
      reason: 'remotes.delivery must be an absolute http(s) URL',
    });
  });

  it.each(['/relative/remoteEntry.js', 'ftp://host/x.js', 'not a url', ''])(
    'rejects %j as a remote URL',
    (url) => {
      expect(parseConfig({ remotes: { ...valid.remotes, people: url } }).ok).toBe(false);
    },
  );
});

describe('loadConfig', () => {
  const respond = (body: unknown, status = 200): typeof fetch =>
    (() => Promise.resolve(new Response(JSON.stringify(body), { status }))) as typeof fetch;

  it('returns the parsed config on success', async () => {
    expect(await loadConfig(respond(valid))).toEqual({ ok: true, config: valid });
  });

  it('reports an HTTP failure', async () => {
    const result = await loadConfig(respond({}, 404));
    expect(result).toEqual({ ok: false, reason: 'GET /config.json returned 404' });
  });

  it('reports a network failure instead of throwing', async () => {
    const failing = (() => Promise.reject(new Error('offline'))) as typeof fetch;
    const result = await loadConfig(failing);
    expect(result.ok).toBe(false);
  });
});
