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

Set `PORTER_SANDBOX_API_KEY` in your environment, or pass `apiKey` when constructing the client.
By default, the SDK connects to Porter's in-cluster sandbox API at
`http://sandbox-api.porter-sandbox-system.svc.cluster.local:8080`. Override it
with `PORTER_SANDBOX_BASE_URL` or by passing `baseUrl`.

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
