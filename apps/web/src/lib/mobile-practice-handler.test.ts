import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_MOBILE_PRACTICE_BODY_BYTES } from '@stem-brain/shared';
import {
  createMobilePracticeCursorState,
  decodeMobilePracticeCursor,
  encodeMobilePracticeCursor,
  type MobilePracticeCursorState,
} from './mobile-practice-cursor';
import {
  handleMobilePracticePost,
  type MobilePracticePostDependencies,
} from './mobile-practice-handler';

type Card = { id: string; title: string };
type CompatibleCard = Card & { compatible: true };

function request(body: string, headers?: HeadersInit): Request {
  return new Request('https://www.girapphe.com/api/mobile?resource=practice', {
    method: 'POST',
    body,
    headers,
  });
}

async function errorCode(response: Response): Promise<string | undefined> {
  const body = await response.json() as { code?: string };
  return body.code;
}

function unusedDependencies(
  calls: string[],
): MobilePracticePostDependencies<Card, CompatibleCard> {
  return {
    loadCard: async () => {
      calls.push('card');
      return {
        card: null,
        nextCursor: createMobilePracticeCursorState('new'),
      };
    },
    loadStats: async () => {
      calls.push('stats');
      return { explainable: 0, unclear: 0, reviewable: 0 };
    },
    mapCard: (card) => ({ ...card, compatible: true }),
  };
}

test('rejects invalid JSON and oversized bodies before invoking dependencies', async () => {
  const calls: string[] = [];
  const invalidResponse = await handleMobilePracticePost(
    request('{'),
    unusedDependencies(calls),
  );
  assert.equal(invalidResponse.status, 400);
  assert.equal(await errorCode(invalidResponse), 'INVALID_PRACTICE_REQUEST');
  assert.deepEqual(calls, []);

  const oversizedResponse = await handleMobilePracticePost(
    request('{}', { 'Content-Length': String(MAX_MOBILE_PRACTICE_BODY_BYTES + 1) }),
    unusedDependencies(calls),
  );
  assert.equal(oversizedResponse.status, 413);
  assert.equal(await errorCode(oversizedResponse), 'PRACTICE_REQUEST_TOO_LARGE');
  assert.deepEqual(calls, []);
});

test('rejects a malformed or mode-mismatched cursor before loading private data', async () => {
  const calls: string[] = [];
  const malformed = await handleMobilePracticePost(
    request(JSON.stringify({ mode: 'new', cursor: 'not+base64', cycleOnEmpty: true })),
    unusedDependencies(calls),
  );
  assert.equal(malformed.status, 400);
  assert.equal(await errorCode(malformed), 'INVALID_PRACTICE_CURSOR');

  const reviewCursor = encodeMobilePracticeCursor(createMobilePracticeCursorState('review'));
  const wrongMode = await handleMobilePracticePost(
    request(JSON.stringify({ mode: 'new', cursor: reviewCursor, cycleOnEmpty: true })),
    unusedDependencies(calls),
  );
  assert.equal(wrongMode.status, 400);
  assert.equal(await errorCode(wrongMode), 'INVALID_PRACTICE_CURSOR');
  assert.deepEqual(calls, []);
});

test('wraps once and returns mapped private no-store data with the next cursor', async () => {
  const previousState: MobilePracticeCursorState = {
    ...createMobilePracticeCursorState('review'),
    publicAfter: 'public-z',
    privateAfter: 'personal:z',
  };
  const nextState: MobilePracticeCursorState = {
    ...createMobilePracticeCursorState('review'),
    publicAfter: 'public-a',
    nextSource: 'private',
  };
  const cursorCalls: Array<MobilePracticeCursorState | null> = [];
  const modeCalls: string[] = [];
  let statsCalls = 0;

  const response = await handleMobilePracticePost(
    request(JSON.stringify({
      mode: 'review',
      cursor: encodeMobilePracticeCursor(previousState),
      cycleOnEmpty: true,
    })),
    {
      loadCard: async (mode, cursor) => {
        modeCalls.push(mode);
        cursorCalls.push(cursor);
        return cursor
          ? { card: null, nextCursor: cursor }
          : { card: { id: 'public-a', title: 'First' }, nextCursor: nextState };
      },
      loadStats: async () => {
        statsCalls += 1;
        return { explainable: 3, unclear: 2, reviewable: 1 };
      },
      mapCard: (card) => ({ ...card, compatible: true as const }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(statsCalls, 1);
  assert.deepEqual(modeCalls, ['review', 'review']);
  assert.deepEqual(cursorCalls, [previousState, null]);
  const payload = await response.json() as {
    card: CompatibleCard;
    stats: { explainable: number; unclear: number; reviewable: number };
    nextCursor: string;
    cycled: boolean;
  };
  assert.deepEqual(payload.card, { id: 'public-a', title: 'First', compatible: true });
  assert.deepEqual(payload.stats, { explainable: 3, unclear: 2, reviewable: 1 });
  assert.equal(payload.cycled, true);
  assert.deepEqual(decodeMobilePracticeCursor(payload.nextCursor, 'review'), {
    ok: true,
    state: nextState,
  });
});
