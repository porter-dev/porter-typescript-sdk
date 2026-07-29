import { describe, expect, it } from 'vitest';
import { buildUrl } from '../src/_baseClient.js';

describe('buildUrl', () => {
  it('targets the in-cluster sandbox API at its root', () => {
    const base = 'http://sandbox-api.porter-sandbox-system.svc.cluster.local:8080';
    expect(buildUrl(base, '/v1/sandbox/run', undefined)).toBe(`${base}/v1/sandbox/run`);
  });

  it('preserves a proxied base URL path prefix (Porter gateway pass-through)', () => {
    const base = 'https://host/api/v2/alpha/projects/1/clusters/2/sandboxes';
    expect(buildUrl(base, '/v1/sandbox/run', undefined)).toBe(
      'https://host/api/v2/alpha/projects/1/clusters/2/sandboxes/v1/sandbox/run',
    );
  });

  it('tolerates a trailing slash on the base URL', () => {
    expect(buildUrl('https://host/prefix/', '/v1/sandbox/abc', undefined)).toBe(
      'https://host/prefix/v1/sandbox/abc',
    );
  });

  it('appends query params, repeating array values', () => {
    const url = buildUrl('http://h:8080', '/v1/sandbox', { tag: ['env=prod', 'owner=alice'], page: 1 });
    expect(url).toBe('http://h:8080/v1/sandbox?tag=env%3Dprod&tag=owner%3Dalice&page=1');
  });
});
