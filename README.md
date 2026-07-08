# porter-sandbox

TypeScript SDK for the [Porter Sandbox API](https://porter.run).

> **Pre-release.** Pilot for Porter's multi-language SDK rollout.

## Install

```bash
npm install porter-sandbox
```

## Usage

```typescript
import { Porter } from 'porter-sandbox';

const porter = new Porter();

const sb = await porter.sandboxes.create({
  image: 'python:3.11-alpine',
  command: ['python', '-c', "print('hi')"],
});

console.log(await sb.logs());
await sb.terminate();
```

Volumes can be created up front and mounted into sandboxes at launch:

```typescript
const volume = await porter.volumes.create({ name: 'my-data' });

const sb = await porter.sandboxes.create({
  image: 'python:3.11-alpine',
  volume_mounts: { '/mnt/my-data': volume.id },
});
```

Inside a sandbox-enabled Porter cluster, the SDK connects to the in-cluster
sandbox API at `http://sandbox-api.porter-sandbox-system.svc.cluster.local:8080`
automatically, with no configuration needed.

From outside the cluster, set a Porter API token (created from
**Settings > API tokens** in the Porter Dashboard) and the cluster where
sandboxes are enabled:

```bash
export PORTER_SANDBOX_API_KEY=<porter-api-token>
export PORTER_CLUSTER_ID=<cluster-id>
```

The SDK reads the project from the token and calls the sandbox API through the
Porter API at `dashboard.porter.run`. To target a specific URL instead, set
`PORTER_SANDBOX_BASE_URL` or pass `baseUrl` - both take precedence over
everything above.

### Concurrency

Sandbox methods are all promise-based — launch many in parallel with `Promise.all`:

```typescript
const sandboxes = await Promise.all(
  commands.map((command) => porter.sandboxes.create({ image: 'python:3.11', command })),
);
```

## Layout

- `src/sandbox.ts` — rich `Sandbox` handle (hand-written ergonomic API)
- `src/porter.ts`, `src/sandboxes.ts`, `src/volumes.ts`, `src/healthz.ts`, `src/readyz.ts` — generated public `Porter` client and resource namespaces
- `src/_client.ts`, `src/_models.ts`, `src/enums.ts`, `src/_errors.ts`, `src/resources/` — generated from the sandbox-api OpenAPI spec. Do not edit by hand.
- `src/_baseClient.ts` — hand-written `fetch`-based HTTP transport (auth, retries, error mapping)
- `src/_config.ts`, `src/_retries.ts` — hand-written runtime (env-var resolution, retry/backoff)

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

To pull in a fresh generation from the sdk-gen workspace:

```bash
./scripts/sync-generated.sh /path/to/sdk-gen/out/typescript
```
