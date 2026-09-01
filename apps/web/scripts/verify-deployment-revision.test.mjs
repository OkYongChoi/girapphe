import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyDeploymentRevision } from './verify-deployment-revision.mjs';

const EXPECTED = 'd0c3411eee9a1e3596ed00dea9b8d70197df8b5d';

test('deployment verification waits until the health endpoint serves the expected SHA', async () => {
  const revisions = ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', EXPECTED];
  let calls = 0;
  let sleeps = 0;
  const result = await verifyDeploymentRevision({
    baseUrl: 'https://preview.example.com',
    expectedRevision: EXPECTED,
    attempts: 2,
    intervalMs: 0,
    fetchImpl: async (url) => {
      assert.equal(url.toString(), 'https://preview.example.com/api/health');
      const revision = revisions[calls];
      calls += 1;
      return { ok: true, async json() { return { revision }; } };
    },
    sleepImpl: async () => { sleeps += 1; },
  });

  assert.deepEqual(result, { attempt: 2, revision: EXPECTED });
  assert.equal(calls, 2);
  assert.equal(sleeps, 1);
});

test('deployment verification rejects stale aliases after the retry budget', async () => {
  await assert.rejects(
    () => verifyDeploymentRevision({
      baseUrl: 'https://preview.example.com',
      expectedRevision: EXPECTED,
      attempts: 1,
      fetchImpl: async () => ({
        ok: true,
        async json() { return { revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }; },
      }),
    }),
    /Deployment revision mismatch after 1 attempts/,
  );
});
