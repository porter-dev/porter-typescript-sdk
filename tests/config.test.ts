import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/_config.js';

const IN_CLUSTER_BASE_URL = 'http://sandbox-api.porter-sandbox-system.svc.cluster.local:8080';
const EXTERNAL_BASE_URL = 'https://dashboard.porter.run/api/v2/alpha/projects/123/clusters/456';

const RESOLUTION_ENV_VARS = [
  'PORTER_SANDBOX_BASE_URL',
  'PORTER_SANDBOX_API_KEY',
  'PORTER_CLUSTER_ID',
  'KUBERNETES_SERVICE_HOST',
] as const;

const makeApiKey = (payload: unknown): string =>
  `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

const API_KEY = makeApiKey({ project_id: 123, sub: 'api', token_id: 'abc' });

describe('resolveConfig', () => {
  const originalValues = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const envVar of RESOLUTION_ENV_VARS) {
      originalValues.set(envVar, process.env[envVar]);
      delete process.env[envVar];
    }
  });

  afterEach(() => {
    for (const envVar of RESOLUTION_ENV_VARS) {
      const original = originalValues.get(envVar);
      if (original === undefined) {
        delete process.env[envVar];
      } else {
        process.env[envVar] = original;
      }
    }
  });

  it('falls back to the in-cluster sandbox API URL when running in Kubernetes', () => {
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

  it('parses the project ID from a Porter-minted token', () => {
    // Exact claim shape minted by the monolith's JWTForAPI: iat is a string,
    // project_id is a number, sub/sub_kind/token_id are always present.
    const porterToken = makeApiKey({
      iat: '1783537707',
      project_id: 1,
      sub: 'api',
      sub_kind: 'api',
      token_id: '7dc2a111-f851-4935-a414-b72945be0883',
    });
    process.env.PORTER_CLUSTER_ID = '651';
    process.env.PORTER_SANDBOX_API_KEY = porterToken;

    expect(resolveConfig().baseUrl).toBe(
      'https://dashboard.porter.run/api/v2/alpha/projects/1/clusters/651',
    );
  });

  it('builds the external URL from the API key and PORTER_CLUSTER_ID', () => {
    process.env.PORTER_CLUSTER_ID = '456';
    process.env.PORTER_SANDBOX_API_KEY = API_KEY;

    expect(resolveConfig().baseUrl).toBe(EXTERNAL_BASE_URL);
  });

  it('prefers PORTER_CLUSTER_ID over in-cluster detection', () => {
    process.env.PORTER_CLUSTER_ID = '456';
    process.env.PORTER_SANDBOX_API_KEY = API_KEY;
    process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';

    expect(resolveConfig().baseUrl).toBe(EXTERNAL_BASE_URL);
  });

  it('prefers PORTER_SANDBOX_BASE_URL over PORTER_CLUSTER_ID', () => {
    process.env.PORTER_CLUSTER_ID = '456';
    process.env.PORTER_SANDBOX_BASE_URL = 'https://sandbox.example';

    expect(resolveConfig().baseUrl).toBe('https://sandbox.example');
  });

  it('requires an API key for the external URL', () => {
    process.env.PORTER_CLUSTER_ID = '456';

    expect(() => resolveConfig()).toThrow(/PORTER_SANDBOX_API_KEY/);
  });

  it('accepts an apiKey argument for the external URL', () => {
    process.env.PORTER_CLUSTER_ID = '456';

    expect(resolveConfig({ apiKey: API_KEY }).baseUrl).toBe(EXTERNAL_BASE_URL);
  });

  it.each([
    ['a non-JWT string', 'not-a-jwt'],
    ['a two-segment token', 'one.two'],
    ['a token without a project_id claim', makeApiKey({ sub: 'api' })],
    ['a token with a string project_id', makeApiKey({ project_id: '123' })],
    ['a token with a zero project_id', makeApiKey({ project_id: 0 })],
    ['a token with a non-object payload', makeApiKey(['not', 'an', 'object'])],
    ['a token with an unparseable payload', 'header.!!!not-base64!!!.signature'],
  ])('rejects %s', (_desc, apiKey) => {
    process.env.PORTER_CLUSTER_ID = '456';
    process.env.PORTER_SANDBOX_API_KEY = apiKey;

    expect(() => resolveConfig()).toThrow(/project_id claim/);
  });

  it('requires PORTER_CLUSTER_ID when an API key is set', () => {
    process.env.PORTER_SANDBOX_API_KEY = API_KEY;

    expect(() => resolveConfig()).toThrow(/PORTER_CLUSTER_ID is not/);
  });

  it('ignores a missing cluster ID when running in Kubernetes', () => {
    process.env.PORTER_SANDBOX_API_KEY = API_KEY;
    process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';

    expect(resolveConfig().baseUrl).toBe(IN_CLUSTER_BASE_URL);
  });

  it('errors when no resolution path is available', () => {
    expect(() => resolveConfig()).toThrow(/Could not determine the sandbox API base URL/);
  });
});
