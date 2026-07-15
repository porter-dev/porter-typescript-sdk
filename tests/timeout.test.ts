import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseClient } from '../src/_baseClient.js';
import { SandboxTimeoutError } from '../src/_errors.js';

const jsonResponse = (): Response =>
  new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });

const slowFetch = (delayMs: number): typeof fetch =>
  vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        setTimeout(() => resolve(jsonResponse()), delayMs);
      }),
  );

describe('request timeouts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('timeoutMs: null disables the client-wide timeout', async () => {
    vi.stubGlobal('fetch', slowFetch(50));
    const client = new BaseClient({ baseUrl: 'http://sandbox.test', timeoutMs: 10 });

    await expect(
      client.request({ method: 'POST', path: '/v1/sandbox/abc/exec', timeoutMs: null }),
    ).resolves.toEqual({});
  });

  it('a per-request timeoutMs bounds the call and throws without retrying', async () => {
    const fetchMock = slowFetch(50);
    vi.stubGlobal('fetch', fetchMock);
    const client = new BaseClient({ baseUrl: 'http://sandbox.test' });

    await expect(
      client.request({ method: 'POST', path: '/v1/sandbox/abc/exec', timeoutMs: 10 }),
    ).rejects.toBeInstanceOf(SandboxTimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retry: false stops network errors from being re-sent', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);
    const client = new BaseClient({ baseUrl: 'http://sandbox.test' });

    await expect(
      client.request({ method: 'POST', path: '/v1/sandbox/abc/exec', retry: false }),
    ).rejects.toThrow('Network error');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('other requests still retry network errors', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse());
    vi.stubGlobal('fetch', fetchMock);
    const client = new BaseClient({ baseUrl: 'http://sandbox.test' });

    await expect(client.request({ method: 'GET', path: '/v1/sandbox' })).resolves.toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
