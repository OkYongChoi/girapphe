import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  MAX_MOBILE_PRACTICE_CARD_ID_LENGTH,
  MAX_MOBILE_PRACTICE_CURSOR_LENGTH,
} from '@stem-brain/shared';
import {
  loadMobilePracticeRound,
  MAX_LEGACY_MOBILE_PRACTICE_EXCLUDE_IDS,
  parseLegacyMobilePracticeExcludeIds,
  parseMobilePracticeRequest,
} from './mobile-practice-contract';

test('accepts only the bounded mobile Practice cursor request shape', () => {
  assert.deepEqual(parseMobilePracticeRequest({
    mode: 'review',
    cursor: 'opaque-cursor',
    cycleOnEmpty: true,
  }), {
    mode: 'review',
    cursor: 'opaque-cursor',
    cycleOnEmpty: true,
  });
  assert.deepEqual(parseMobilePracticeRequest({ mode: 'new' }), {
    mode: 'new',
    cursor: null,
    cycleOnEmpty: false,
  });

  assert.equal(parseMobilePracticeRequest(null), null);
  assert.equal(parseMobilePracticeRequest([]), null);
  assert.equal(parseMobilePracticeRequest({ mode: 'saved' }), null);
  assert.equal(parseMobilePracticeRequest({ mode: 'new', cursor: '' }), null);
  assert.equal(parseMobilePracticeRequest({
    mode: 'new',
    cursor: 'x'.repeat(MAX_MOBILE_PRACTICE_CURSOR_LENGTH + 1),
  }), null);
  assert.equal(parseMobilePracticeRequest({ mode: 'new', cursor: 1 }), null);
  assert.equal(parseMobilePracticeRequest({ mode: 'new', cycleOnEmpty: 'yes' }), null);
  assert.equal(parseMobilePracticeRequest({
    mode: 'new',
    cursor: null,
    cycleOnEmpty: false,
    excludeIds: ['legacy-card'],
  }), null);
  assert.equal(parseMobilePracticeRequest({
    mode: 'new',
    cursor: null,
    cycleOnEmpty: false,
    unexpected: true,
  }), null);
});

test('legacy exclusions accept at most 100 valid unique card ids without truncation', () => {
  const maximum = Array.from(
    { length: MAX_LEGACY_MOBILE_PRACTICE_EXCLUDE_IDS },
    (_, index) => `card-${index}`,
  );
  const duplicateWithinLimit = [...maximum.slice(0, 99), maximum[0]];
  assert.deepEqual(parseLegacyMobilePracticeExcludeIds(duplicateWithinLimit), {
    ok: true,
    excludeIds: maximum.slice(0, 99),
  });
  assert.deepEqual(parseLegacyMobilePracticeExcludeIds(maximum), {
    ok: true,
    excludeIds: maximum,
  });
  assert.deepEqual(
    parseLegacyMobilePracticeExcludeIds([...maximum, 'card-over-limit']),
    { ok: false, reason: 'too_many' },
  );
  assert.deepEqual(parseLegacyMobilePracticeExcludeIds(['']), { ok: false, reason: 'invalid' });
  assert.deepEqual(
    parseLegacyMobilePracticeExcludeIds(['x'.repeat(MAX_MOBILE_PRACTICE_CARD_ID_LENGTH + 1)]),
    { ok: false, reason: 'invalid' },
  );
});

test('returns a card without wrapping when the current cursor still has work', async () => {
  const cursor = { after: 'card-a' };
  const calls: Array<typeof cursor | null> = [];
  const result = await loadMobilePracticeRound(async (nextCursor) => {
    calls.push(nextCursor);
    return { card: { id: 'card-b' }, nextCursor: { after: 'card-b' } };
  }, cursor, true);

  assert.deepEqual(calls, [cursor]);
  assert.deepEqual(result, {
    card: { id: 'card-b' },
    nextCursor: { after: 'card-b' },
    cycled: false,
  });
});

test('wraps a non-null exhausted cursor exactly once', async () => {
  type Cursor = { after: string };
  const cursor: Cursor = { after: 'last-card' };
  const calls: Array<Cursor | null> = [];
  const result = await loadMobilePracticeRound(async (nextCursor) => {
    calls.push(nextCursor);
    return nextCursor
      ? { card: null, nextCursor }
      : { card: { id: 'first-next-round' }, nextCursor: { after: 'first-next-round' } };
  }, cursor, true);

  assert.deepEqual(calls, [cursor, null]);
  assert.deepEqual(result, {
    card: { id: 'first-next-round' },
    nextCursor: { after: 'first-next-round' },
    cycled: true,
  });
});

test('does not wrap an initial null cursor or a caller that disables cycling', async () => {
  type Cursor = { after: string };
  const calls: Array<Cursor | null> = [];
  const loadNext = async (cursor: Cursor | null) => {
    calls.push(cursor);
    return { card: null, nextCursor: cursor };
  };

  assert.deepEqual(await loadMobilePracticeRound(loadNext, null, true), {
    card: null,
    nextCursor: null,
    cycled: false,
  });
  assert.deepEqual(await loadMobilePracticeRound(loadNext, { after: 'last-card' }, false), {
    card: null,
    nextCursor: { after: 'last-card' },
    cycled: false,
  });
  assert.deepEqual(calls, [null, { after: 'last-card' }]);
});

test('authoritative reviewable stats reuse the selectable public-card predicate', () => {
  const cardActions = readFileSync(
    new URL('../actions/card-actions.ts', import.meta.url),
    'utf8',
  );
  const eligibilityUses = cardActions.match(
    /\$\{PUBLIC_PRACTICE_CARD_ELIGIBILITY_SQL\}/g,
  ) ?? [];

  assert.equal(eligibilityUses.length, 4);
  assert.match(cardActions, /AS reviewable_count[\s\S]*?FROM user_card_states/);
  assert.match(cardActions, /EXISTS \([\s\S]*?FROM knowledge_cards kc[\s\S]*?PUBLIC_PRACTICE_CARD_ELIGIBILITY_SQL/);
  const mobilePublicSelector = cardActions.match(
    /async function getNextPublicPracticeCardAfter\([\s\S]*?\n\}/,
  )?.[0] ?? '';
  assert.match(mobilePublicSelector, /PUBLIC_PRACTICE_CARD_ELIGIBILITY_SQL/);
  assert.match(mobilePublicSelector, /kc\.id > \$2/);
  assert.match(mobilePublicSelector, /ORDER BY kc\.id ASC\s*LIMIT 1/);
});

test('configured-database mobile reads fail closed instead of returning mock account state', () => {
  const cardActions = readFileSync(
    new URL('../actions/card-actions.ts', import.meta.url),
    'utf8',
  );
  const savedSource = cardActions.slice(
    cardActions.indexOf('async function getSavedCardsSource()'),
    cardActions.indexOf('export async function getSavedCards('),
  );
  const statsSource = cardActions.slice(
    cardActions.indexOf('export async function getUserStats()'),
    cardActions.indexOf('type RateCardAndAdvanceInput'),
  );

  assert.match(savedSource, /if \(!process\.env\.DATABASE_URL\)[\s\S]*?getMockCardsForActor/);
  assert.match(savedSource, /catch \(error\) \{[\s\S]*?throw error;/);
  assert.doesNotMatch(savedSource, /catch \(error\) \{[\s\S]*?return \[\];/);
  assert.match(statsSource, /if \(user\.isGuest \|\| !process\.env\.DATABASE_URL\)[\s\S]*?getMockPracticeStats/);
  assert.match(statsSource, /catch \(error\) \{[\s\S]*?throw error;/);
  assert.doesNotMatch(statsSource, /catch \(error\) \{[\s\S]*?getMockPracticeStats/);
});

test('web Practice clears both round sets before either kind of cycle reset', () => {
  const cardViewer = readFileSync(
    new URL('../components/card-viewer.tsx', import.meta.url),
    'utf8',
  );
  const actionHandler = cardViewer.match(
    /const handleAction = useCallback\(async \(status: CardStatus\) => \{([\s\S]*?)\n  \},/,
  )?.[1] ?? '';
  const skipHandler = cardViewer.match(
    /const handleSkip = useCallback\(async \(\) => \{([\s\S]*?)\n  \},/,
  )?.[1] ?? '';

  assert.match(
    actionHandler,
    /if \(result\.cycled\) \{\s*ratedIds\.current\.clear\(\);\s*skippedIds\.current\.clear\(\);\s*\}/,
  );
  assert.match(
    actionHandler,
    /const roundExclusions = mergePracticeRoundExclusions\(\[\s*\[\.\.\.ratedIds\.current\],\s*\[\.\.\.skippedIds\.current\],\s*\[card\.id\],\s*\]\);/,
  );
  assert.match(actionHandler, /excludeIds: roundExclusions/);
  assert.match(skipHandler, /ratedIds\.current\.clear\(\)/);
  assert.match(skipHandler, /skippedIds\.current\.clear\(\)/);
  assert.ok(skipHandler.indexOf('ratedIds.current.clear()') < skipHandler.indexOf('getNextCard(mode, undefined, locale)'));
  assert.ok(skipHandler.indexOf('skippedIds.current.clear()') < skipHandler.indexOf('getNextCard(mode, undefined, locale)'));
});
