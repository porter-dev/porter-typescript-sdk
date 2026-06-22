/**
 * End-to-end smoke test against a real sandbox-api.
 *
 * Reads PORTER_SANDBOX_BASE_URL and PORTER_SANDBOX_API_KEY from env. Exercises
 * the full public Sandbox surface against the live API. Intended for in-cluster
 * execution where TLS/auth/header issues that kubectl port-forward exhibits
 * don't apply.
 *
 * Pass --parallel to exercise concurrent sandbox creation.
 */

import { Porter, SandboxError } from '../src/index.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const runSequential = async (): Promise<number> => {
  const base = process.env.PORTER_SANDBOX_BASE_URL ?? '';
  console.log(`target: ${base || '(default)'} (sequential)`);
  const porter = new Porter();
  let failures = 0;

  try {
    console.log('\n[1/6] list (initial)');
    const existing = await porter.sandboxes.list();
    console.log(`  ok, ${existing.length} sandbox(es) present`);

    console.log('\n[2/6] create');
    const sb = await porter.sandboxes.create({
      image: 'python:3.11-alpine',
      command: ['python', '-c', "print('hello from sandbox')"],
      tags: { created_by: 'sdk-smoke', ts: String(Math.floor(Date.now() / 1000)) },
    });
    console.log(`  ok, id=${sb.id}`);

    console.log('\n[3/6] refresh (poll until phase != queued)');
    for (let attempt = 0; attempt < 15; attempt++) {
      await sb.refresh();
      console.log(`  attempt ${attempt + 1}: phase=${sb.phase}`);
      if (sb.phase && sb.phase !== 'queued' && sb.phase !== 'creating') break;
      await sleep(1000);
    }

    console.log('\n[4/6] logs');
    try {
      const logs = await sb.logs({ limit: 20 });
      console.log(`  ok, ${logs.length} line(s)`);
      for (const entry of logs.slice(0, 5)) {
        console.log(`    | [${entry.level}] ${entry.line}`);
      }
    } catch (err) {
      if (err instanceof SandboxError) {
        console.log(`  FAIL: ${err.name}: ${err.message} status=${err.statusCode}`);
        failures += 1;
      } else {
        throw err;
      }
    }

    console.log('\n[5/6] list (filtered by tag)');
    const filtered = await porter.sandboxes.list({ tags: { created_by: 'sdk-smoke' } });
    const found = filtered.some((s) => s.id === sb.id);
    if (found) {
      console.log(`  ok, our sandbox is present in ${filtered.length} matching result(s)`);
    } else {
      console.log(`  FAIL: our sandbox ${sb.id} not in ${filtered.length} tag-filtered results`);
      failures += 1;
    }

    console.log('\n[6/6] terminate');
    await sb.terminate();
    console.log('  ok');
  } catch (err) {
    if (err instanceof SandboxError) {
      console.log(
        `\n!! TOP-LEVEL FAILURE: ${err.name}: ${err.message} status=${err.statusCode} body=${JSON.stringify(err.body)}`,
      );
    } else {
      console.log(`\n!! TOP-LEVEL FAILURE: ${err}`);
    }
    failures += 1;
  } finally {
    porter.close();
  }

  console.log(`\nfinished, ${failures} failure(s)`);
  return failures > 0 ? 1 : 0;
};

const runParallel = async (): Promise<number> => {
  const base = process.env.PORTER_SANDBOX_BASE_URL ?? '';
  console.log(`target: ${base || '(default)'} (parallel)`);
  const porter = new Porter();
  let failures = 0;

  try {
    console.log('\n[1/3] create x3 concurrently');
    const sandboxes = await Promise.all(
      [1, 2, 3].map((i) =>
        porter.sandboxes.create({
          image: 'python:3.11-alpine',
          command: ['python', '-c', `print(${i})`],
          tags: { created_by: 'sdk-smoke-parallel' },
        }),
      ),
    );
    for (const sb of sandboxes) console.log(`  ok, id=${sb.id}`);

    console.log('\n[2/3] refresh all concurrently');
    await Promise.all(sandboxes.map((sb) => sb.refresh()));
    for (const sb of sandboxes) console.log(`  ${sb.id}: phase=${sb.phase}`);

    console.log('\n[3/3] terminate all concurrently');
    await Promise.all(sandboxes.map((sb) => sb.terminate()));
    console.log('  ok');
  } catch (err) {
    if (err instanceof SandboxError) {
      console.log(
        `\n!! TOP-LEVEL FAILURE: ${err.name}: ${err.message} status=${err.statusCode} body=${JSON.stringify(err.body)}`,
      );
    } else {
      console.log(`\n!! TOP-LEVEL FAILURE: ${err}`);
    }
    failures += 1;
  } finally {
    porter.close();
  }

  console.log(`\nfinished, ${failures} failure(s)`);
  return failures > 0 ? 1 : 0;
};

const main = async (): Promise<void> => {
  const parallel = process.argv.includes('--parallel');
  const code = parallel ? await runParallel() : await runSequential();
  process.exit(code);
};

void main();
