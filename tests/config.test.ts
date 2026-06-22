import { afterEach, describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/_config.js';

const DEFAULT_BASE_URL = 'http://sandbox-api.porter-sandbox-system.svc.cluster.local:8080';

describe('resolveConfig', () => {
  const originalBaseUrl = process.env.PORTER_SANDBOX_BASE_URL;

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.PORTER_SANDBOX_BASE_URL;
    } else {
      process.env.PORTER_SANDBOX_BASE_URL = originalBaseUrl;
    }
  });

  it('falls back to the in-cluster sandbox API URL', () => {
    delete process.env.PORTER_SANDBOX_BASE_URL;

    expect(resolveConfig().baseUrl).toBe(DEFAULT_BASE_URL);
  });

  it('uses PORTER_SANDBOX_BASE_URL when no baseUrl is passed', () => {
    process.env.PORTER_SANDBOX_BASE_URL = 'https://sandbox.example/';

    expect(resolveConfig().baseUrl).toBe('https://sandbox.example');
  });

  it('prefers an explicit baseUrl over PORTER_SANDBOX_BASE_URL', () => {
    process.env.PORTER_SANDBOX_BASE_URL = 'https://sandbox.example';

    expect(resolveConfig({ baseUrl: 'https://sandbox.override/' }).baseUrl).toBe(
      'https://sandbox.override',
    );
  });
});
