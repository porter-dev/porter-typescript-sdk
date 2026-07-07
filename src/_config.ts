const IN_CLUSTER_BASE_URL = 'http://sandbox-api.porter-sandbox-system.svc.cluster.local:8080';
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

const externalBaseUrl = (projectId: string, clusterId: string): string =>
  `https://dashboard.porter.run/api/v2/alpha/projects/${projectId}/clusters/${clusterId}`;

const resolveBaseUrl = (baseUrl: string | undefined, apiKey: string | undefined): string => {
  const explicit = baseUrl ?? process.env.PORTER_SANDBOX_BASE_URL;
  if (explicit) {
    return explicit;
  }

  const projectId = process.env.PORTER_PROJECT_ID;
  const clusterId = process.env.PORTER_CLUSTER_ID;
  if (projectId && clusterId) {
    if (!apiKey) {
      throw new Error(
        'PORTER_PROJECT_ID and PORTER_CLUSTER_ID are set, so the SDK will call the Porter API ' +
          'from outside the cluster, which requires an API token. Set PORTER_SANDBOX_API_KEY or ' +
          'pass apiKey. You can create an API token from Settings > API tokens in the Porter ' +
          'Dashboard (requires admin permissions).',
      );
    }
    return externalBaseUrl(projectId, clusterId);
  }
  if (projectId || clusterId) {
    const [setVar, missingVar] = projectId
      ? ['PORTER_PROJECT_ID', 'PORTER_CLUSTER_ID']
      : ['PORTER_CLUSTER_ID', 'PORTER_PROJECT_ID'];
    throw new Error(
      `${setVar} is set but ${missingVar} is not. Set both to call the Porter API from outside the cluster.`,
    );
  }

  // Kubernetes sets KUBERNETES_SERVICE_HOST in every pod, so its presence means the
  // in-cluster sandbox API service address is at least reachable in principle.
  if (process.env.KUBERNETES_SERVICE_HOST) {
    return IN_CLUSTER_BASE_URL;
  }

  throw new Error(
    'Could not determine the sandbox API base URL. Either run inside a sandbox-enabled Porter ' +
      'cluster, or set PORTER_PROJECT_ID and PORTER_CLUSTER_ID (plus PORTER_SANDBOX_API_KEY) to ' +
      'call the Porter API from outside the cluster. You can also set PORTER_SANDBOX_BASE_URL ' +
      'or pass baseUrl to target a specific URL.',
  );
};

export const resolveConfig = (input: ConfigInput = {}): Config => {
  const apiKey = input.apiKey ?? process.env.PORTER_SANDBOX_API_KEY;
  return {
    apiKey,
    baseUrl: resolveBaseUrl(input.baseUrl, apiKey).replace(/\/$/, ''),
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
};
