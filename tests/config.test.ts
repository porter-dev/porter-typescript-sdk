import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/_config.js';

const IN_CLUSTER_BASE_URL = 'http://sandbox-api.porter-sandbox-system.svc.cluster.local:8080';
const EXTERNAL_BASE_URL = 'https://dashboard.porter.run/api/v2/alpha/projects/123/clusters/456';

const RESOLUTION_ENV_VARS = [
  'PORTER_SANDBOX_BASE_URL',
  'PORTER_SANDBOX_API_KEY',
  'PORTER_PROJECT_ID',
  'PORTER_CLUSTER_ID',
  'KUBERNETES_SERVICE_HOST',
] as const;

describe('resolveConfig', () => {
  const originalEnv: Partial<Record<(typeof RESOLUTION_ENV_VARS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const name of RESOLUTION_ENV_VARS) {
      originalEnv[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of RESOLUTION_ENV_VARS) {
      const value = originalEnv[name];
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it('falls back to the in-cluster sandbox API URL when running in a cluster', () => {
    process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';

    expect(resolveConfig().baseUrl).toBe(IN_CLUSTER_BASE_URL);
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

  it('builds the external Porter API URL from PORTER_PROJECT_ID and PORTER_CLUSTER_ID', () => {
    process.env.PORTER_PROJECT_ID = '123';
    process.env.PORTER_CLUSTER_ID = '456';
    process.env.PORTER_SANDBOX_API_KEY = 'token';

    expect(resolveConfig().baseUrl).toBe(EXTERNAL_BASE_URL);
  });

  it('prefers project and cluster ids over in-cluster detection', () => {
    process.env.PORTER_PROJECT_ID = '123';
    process.env.PORTER_CLUSTER_ID = '456';
    process.env.PORTER_SANDBOX_API_KEY = 'token';
    process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';

    expect(resolveConfig().baseUrl).toBe(EXTERNAL_BASE_URL);
  });

  it('prefers PORTER_SANDBOX_BASE_URL over project and cluster ids', () => {
    process.env.PORTER_PROJECT_ID = '123';
    process.env.PORTER_CLUSTER_ID = '456';
    process.env.PORTER_SANDBOX_BASE_URL = 'https://sandbox.example';

    expect(resolveConfig().baseUrl).toBe('https://sandbox.example');
  });

  it('requires an API token when resolving the external Porter API URL', () => {
    process.env.PORTER_PROJECT_ID = '123';
    process.env.PORTER_CLUSTER_ID = '456';

    expect(() => resolveConfig()).toThrowError(/PORTER_SANDBOX_API_KEY/);
  });

  it('accepts an apiKey argument when resolving the external Porter API URL', () => {
    process.env.PORTER_PROJECT_ID = '123';
    process.env.PORTER_CLUSTER_ID = '456';

    expect(resolveConfig({ apiKey: 'token' }).baseUrl).toBe(EXTERNAL_BASE_URL);
  });

  it('rejects PORTER_PROJECT_ID without PORTER_CLUSTER_ID', () => {
    process.env.PORTER_PROJECT_ID = '123';

    expect(() => resolveConfig()).toThrowError(/PORTER_CLUSTER_ID is not/);
  });

  it('rejects PORTER_CLUSTER_ID without PORTER_PROJECT_ID', () => {
    process.env.PORTER_CLUSTER_ID = '456';

    expect(() => resolveConfig()).toThrowError(/PORTER_PROJECT_ID is not/);
  });

  it('throws when the base URL cannot be determined', () => {
    expect(() => resolveConfig()).toThrowError(/Could not determine the sandbox API base URL/);
  });
});
