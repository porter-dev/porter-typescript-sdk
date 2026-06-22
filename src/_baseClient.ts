import { errorForStatus, SandboxError } from './_errors.js';
import { resolveConfig, type Config, type ConfigInput } from './_config.js';
import { DEFAULT_MAX_RETRIES, shouldRetry, sleepForAttempt } from './_retries.js';

const USER_AGENT = 'porter-sandbox-typescript/0.0.1';

export interface ClientOptions extends ConfigInput {
  maxRetries?: number;
}

export interface RequestOptions {
  method: string;
  path: string;
  query?: Record<string, unknown> | undefined;
  body?: unknown;
}

// HTTP transport shared by the generated resource classes. Owns auth/header
// injection, the retry loop, and error mapping. Resource methods call
// `this.client.request<T>(...)`.
export class BaseClient {
  private readonly config: Config;
  private readonly maxRetries: number;

  constructor(options: ClientOptions = {}) {
    const { maxRetries, ...configInput } = options;
    this.config = resolveConfig(configInput);
    this.maxRetries = maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  close(): void {
    // fetch has no persistent connection pool to close in standard Node 18+
    // runtime; method exists so callers can model lifecycle symmetry.
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const url = buildUrl(this.config.baseUrl, options.path, options.query);
    const init = buildInit(this.config, options);

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let response: Response;
      try {
        response = await withTimeout(fetch(url, init), this.config.timeoutMs);
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          await sleepForAttempt(attempt);
          continue;
        }
        throw new SandboxError(`Network error: ${describeError(err)}`);
      }

      if (response.status >= 200 && response.status < 300) {
        return (await decodeBody(response)) as T;
      }

      if (shouldRetry(response.status) && attempt < this.maxRetries) {
        await sleepForAttempt(attempt);
        continue;
      }

      const body = await decodeBody(response);
      throw errorForStatus(response.status, body, errorMessage(body, response.status));
    }

    throw new SandboxError(`Request failed after retries: ${describeError(lastError)}`);
  }
}

const buildUrl = (baseUrl: string, path: string, query: Record<string, unknown> | undefined): string => {
  const url = new URL(path, `${baseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, String(v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
};

const buildInit = (config: Config, options: RequestOptions): RequestInit => {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  return { method: options.method, headers, body };
};

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  // AbortController would be cleaner, but fetch in older Node 18 had spotty
  // signal support. setTimeout+race is universally supported and keeps the
  // pending fetch from leaking once we've already given up.
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`request timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};

const decodeBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return response.text();
};

const errorMessage = (body: unknown, statusCode: number): string => {
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
    return body.error;
  }
  return `HTTP ${statusCode}`;
};

const describeError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
