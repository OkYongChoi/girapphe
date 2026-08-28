import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createCandidateInboxRequestGuard } from './candidate-inbox-requests';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

test('a stale initial inbox response cannot auto-select over the latest explicit batch', async () => {
  const requestGuard = createCandidateInboxRequestGuard();
  const initialInbox = deferred<string[]>();
  const explicitBatch = deferred<string>();
  let selectedBatch: string | null = null;

  const initialLoad = (async () => {
    const request = requestGuard.begin();
    const batches = await initialInbox.promise;
    if (!requestGuard.isLatest(request)) return;
    selectedBatch = batches[0] ?? null;
  })();
  const explicitLoad = (async () => {
    const request = requestGuard.begin();
    const batch = await explicitBatch.promise;
    if (!requestGuard.isLatest(request)) return;
    selectedBatch = batch;
  })();

  explicitBatch.resolve('explicit-batch');
  await explicitLoad;
  initialInbox.resolve(['automatic-first-batch']);
  await initialLoad;

  assert.equal(selectedBatch, 'explicit-batch');
});

test('candidate inbox guards the list response before automatic batch selection', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const candidateInbox = readFileSync(join(sourceDir, '../app/candidate-inbox.tsx'), 'utf8');

  assert.match(candidateInbox, /const \[requestGuard\] = useState\(createCandidateInboxRequestGuard\)/);
  assert.match(
    candidateInbox,
    /const load = useCallback\(async \(\) => \{\s*const request = requestGuard\.begin\(\);[\s\S]*?const next = \(await mobileApi\.candidateInbox\(\)\)\.batches;\s*if \(!requestGuard\.isLatest\(request\)\) return;\s*setBatches\(next\);\s*if \(next\.length > 0\) await loadBatch\(next\[0\]!\);/,
  );
  assert.match(
    candidateInbox,
    /const result = await mobileApi\.candidateBatch\(batch\.id\);\s*if \(!requestGuard\.isLatest\(request\)\) return;\s*setSelectedBatch\(result\.batch\);\s*setDrafts\(result\.drafts\);/,
  );
  assert.match(
    candidateInbox,
    /if \(requestGuard\.isLatest\(request\)\) setLoading\(false\)/,
  );
  assert.match(
    candidateInbox,
    /mobileApi\.mutate\([\s\S]*?if \(!requestGuard\.isLatest\(request\)\) return;\s*const refreshed = await mobileApi\.candidateInbox\(\);\s*if \(!requestGuard\.isLatest\(request\)\) return;/,
  );
});
