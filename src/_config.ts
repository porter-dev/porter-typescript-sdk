const DEFAULT_BASE_URL = 'http://sandbox-api.porter-sandbox-system.svc.cluster.local:8080';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface Config {
  readonly apiKey: string | undefined;
  readonly baseUrl: string;
  readonly timeoutMs: number;
}

export interface ConfigInput {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export const resolveConfig = (input: ConfigInput = {}): Config => {
  const rawBaseUrl = input.baseUrl ?? process.env.PORTER_SANDBOX_BASE_URL ?? DEFAULT_BASE_URL;
  return {
    apiKey: input.apiKey ?? process.env.PORTER_SANDBOX_API_KEY,
    baseUrl: rawBaseUrl.replace(/\/$/, ''),
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
};
