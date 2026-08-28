import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ContextPackReuseMismatchError,
  ContextPackReuseRecordingError,
  contextPackMethodNotAllowed,
  isContextPackPayloadWithinLimit,
  requireCompleteContextPackReuse,
} from './context-pack-request';

test('GET is side-effect free and directs explicit context generation to POST', async () => {
  const response = contextPackMethodNotAllowed();
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  assert.deepEqual(await response.json(), { error: 'Use an explicit POST to create a context pack.' });
});

test('serialized context limits count UTF-8 bytes rather than JavaScript characters', () => {
  assert.equal(isContextPackPayloadWithinLimit('abc', 3), true);
  assert.equal(isContextPackPayloadWithinLimit('abc', 2), false);
  assert.equal(isContextPackPayloadWithinLimit('한', 3), true);
  assert.equal(isContextPackPayloadWithinLimit('한', 2), false);
});

test('context generation continues only when every selected item records reuse', async () => {
  assert.equal(await requireCompleteContextPackReuse(2, async () => 2), 2);

  await assert.rejects(
    requireCompleteContextPackReuse(2, async () => 1),
    (error: unknown) => {
      assert.ok(error instanceof ContextPackReuseMismatchError);
      assert.equal(error.expectedCount, 2);
      assert.equal(error.recordedCount, 1);
      return true;
    },
  );
});

test('reuse recorder failures propagate instead of allowing an unaudited context pack', async () => {
  const failure = new Error('reuse storage unavailable');
  await assert.rejects(
    requireCompleteContextPackReuse(1, async () => { throw failure; }),
    (error: unknown) => {
      assert.ok(error instanceof ContextPackReuseRecordingError);
      assert.equal(error.recordingError, failure);
      assert.doesNotMatch(error.message, /size limit/i);
      return true;
    },
  );
});
