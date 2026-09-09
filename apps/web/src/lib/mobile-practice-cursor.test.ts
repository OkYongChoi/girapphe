import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_MOBILE_PRACTICE_CARD_ID_LENGTH,
  MAX_MOBILE_PRACTICE_CURSOR_LENGTH,
} from '@stem-brain/shared';
import {
  createMobilePracticeCursorState,
  decodeMobilePracticeCursor,
  encodeMobilePracticeCursor,
  type MobilePracticeCursorState,
} from './mobile-practice-cursor';

function encodeJson(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

test('round-trips a maximum normal cursor within the shared bound', () => {
  const state: MobilePracticeCursorState = {
    ...createMobilePracticeCursorState('review'),
    nextSource: 'private',
    publicAfter: 'p'.repeat(MAX_MOBILE_PRACTICE_CARD_ID_LENGTH),
    privateAfter: 'personal:' + 'q'.repeat(
      MAX_MOBILE_PRACTICE_CARD_ID_LENGTH - 'personal:'.length,
    ),
  };
  const encoded = encodeMobilePracticeCursor(state);

  assert.ok(encoded.length <= MAX_MOBILE_PRACTICE_CURSOR_LENGTH);
  assert.deepEqual(decodeMobilePracticeCursor(encoded, 'review'), {
    ok: true,
    state,
  });

  const serialized = JSON.stringify(state);
  assert.doesNotMatch(serialized, /userId|title|summary|explanation|rating/i);
  assert.deepEqual(Object.keys(state).sort(), [
    'mode',
    'nextSource',
    'privateAfter',
    'privateDone',
    'publicAfter',
    'publicDone',
    'v',
  ]);
});

test('rejects malformed, oversized, wrong-mode, and noncanonical cursor states', () => {
  const valid = createMobilePracticeCursorState('new');
  const wrongMode = encodeMobilePracticeCursor(valid);

  assert.deepEqual(decodeMobilePracticeCursor('', 'new'), { ok: false, reason: 'invalid' });
  assert.deepEqual(
    decodeMobilePracticeCursor('x'.repeat(MAX_MOBILE_PRACTICE_CURSOR_LENGTH + 1), 'new'),
    { ok: false, reason: 'invalid' },
  );
  assert.deepEqual(decodeMobilePracticeCursor('not+base64', 'new'), {
    ok: false,
    reason: 'invalid',
  });
  assert.deepEqual(decodeMobilePracticeCursor(wrongMode, 'review'), {
    ok: false,
    reason: 'mode_mismatch',
  });
  assert.deepEqual(decodeMobilePracticeCursor(encodeJson({ ...valid, v: 2 }), 'new'), {
    ok: false,
    reason: 'invalid',
  });
  assert.deepEqual(decodeMobilePracticeCursor(encodeJson({ ...valid, actorId: 'other' }), 'new'), {
    ok: false,
    reason: 'invalid',
  });
  assert.deepEqual(decodeMobilePracticeCursor(encodeJson({
    ...valid,
    privateAfter: 'public-card',
  }), 'new'), {
    ok: false,
    reason: 'invalid',
  });
  assert.throws(
    () => encodeMobilePracticeCursor({
      ...valid,
      publicAfter: 'personal:not-public',
    }),
    /Invalid mobile Practice cursor state/,
  );
});
