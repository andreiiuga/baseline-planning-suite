import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteTimeoutError, withTimeout } from '../src/timeout';

describe('withTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves with the value when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 5000, 'people')).resolves.toBe('ok');
  });

  it('rejects with a timeout error when the promise never settles', async () => {
    const pending = withTimeout(new Promise<never>(() => undefined), 5000, 'people');
    const assertion = expect(pending).rejects.toBeInstanceOf(RemoteTimeoutError);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it('passes through the original rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 5000, 'people')).rejects.toThrow(
      'boom',
    );
  });
});
