import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createPracticeHistoryState,
  createReviewRoundProgress,
  formatReviewLastSeen,
  loadPracticeWithRetry,
  PRACTICE_HISTORY_LIMIT,
  PRACTICE_RETRY_DELAY_MS,
  prerequisiteKnowledgeState,
  recordCompletedPracticeAction,
  recordReviewRoundAdvance,
  recoverPreviousPracticeCard,
  resolvePracticeMode,
  resolvePracticeFocusMode,
  reviewQueueCount,
  reviewedPracticeCardCount,
} from './practice-parity';

test('accepts supported practice modes and defaults invalid route input to new', () => {
  assert.equal(resolvePracticeMode('new'), 'new');
  assert.equal(resolvePracticeMode('review'), 'review');
  assert.equal(resolvePracticeMode(undefined), 'new');
  assert.equal(resolvePracticeMode('saved'), 'new');
  assert.equal(resolvePracticeMode(['review', 'new']), 'review');
  assert.equal(resolvePracticeMode(['invalid', 'review']), 'new');
});

test('consumes explicit route intent once and preserves later manual mode choices', () => {
  assert.deepEqual(
    resolvePracticeFocusMode('review', 'new'),
    { mode: 'review', consumeRouteIntent: true },
  );
  assert.deepEqual(
    resolvePracticeFocusMode(undefined, 'review'),
    { mode: 'review', consumeRouteIntent: false },
  );
  assert.deepEqual(
    resolvePracticeFocusMode('invalid', 'review'),
    { mode: 'new', consumeRouteIntent: true },
  );
});

test('uses the server-owned reviewable count independently of unclear cards', () => {
  assert.equal(reviewQueueCount({ reviewable: 2, unclear: 19 }), 2);
  assert.equal(reviewQueueCount({ reviewable: 0, unclear: 7 }), 0);
  assert.equal(reviewQueueCount({ unclear: 7 }), 0);
  assert.equal(reviewQueueCount({ reviewable: Number.NaN, unclear: 7 }), 0);
});

test('recovers bounded previous-card history without decrementing completed actions', () => {
  let state = createPracticeHistoryState<{ id: string }>();
  for (let index = 0; index < PRACTICE_HISTORY_LIMIT + 2; index += 1) {
    state = recordCompletedPracticeAction(state, { id: `card-${index}` }, 'known');
  }

  assert.equal(state.history.length, PRACTICE_HISTORY_LIMIT);
  assert.equal(state.history[0]?.card.id, 'card-2');
  assert.equal(state.completedCardActions, PRACTICE_HISTORY_LIMIT + 2);
  assert.equal(reviewedPracticeCardCount(state), PRACTICE_HISTORY_LIMIT);
  assert.equal('ratedCardActionCounts' in state, false);
  assert.equal('reviewedCardActions' in state, false);

  const recovered = recoverPreviousPracticeCard(state);
  assert.equal(recovered.entry?.card.id, `card-${PRACTICE_HISTORY_LIMIT + 1}`);
  assert.equal(recovered.entry?.action, 'known');
  assert.equal(recovered.state.history.length, PRACTICE_HISTORY_LIMIT - 1);
  assert.equal(recovered.state.completedCardActions, state.completedCardActions);
  assert.equal(reviewedPracticeCardCount(recovered.state), PRACTICE_HISTORY_LIMIT - 1);

  const empty = recoverPreviousPracticeCard(createPracticeHistoryState());
  assert.equal(empty.entry, null);
  assert.equal(empty.state.completedCardActions, 0);
  assert.equal(reviewedPracticeCardCount(empty.state), 0);
});

test('counts distinct ratings only within bounded recent history', () => {
  let state = createPracticeHistoryState<{ id: string }>();
  state = recordCompletedPracticeAction(state, { id: 'repeated' }, 'known');
  state = recordCompletedPracticeAction(state, { id: 'repeated' }, 'saved');
  state = recordCompletedPracticeAction(state, { id: 'skipped' }, 'skip');

  assert.equal(reviewedPracticeCardCount(state), 1);
  const recoveredSkip = recoverPreviousPracticeCard(state);
  assert.equal(reviewedPracticeCardCount(recoveredSkip.state), 1);
  const recoveredReplacement = recoverPreviousPracticeCard(recoveredSkip.state);
  assert.equal(reviewedPracticeCardCount(recoveredReplacement.state), 1);
});

test('counts skips for ad cadence but not as reviewed cards', () => {
  let state = createPracticeHistoryState<{ id: string }>();
  state = recordCompletedPracticeAction(state, { id: 'rated' }, 'known');
  state = recordCompletedPracticeAction(state, { id: 'skipped' }, 'skip');

  assert.equal(state.completedCardActions, 2);
  assert.equal(reviewedPracticeCardCount(state), 1);

  const recoveredSkip = recoverPreviousPracticeCard(state);
  assert.equal(recoveredSkip.entry?.action, 'skip');
  assert.equal(recoveredSkip.state.completedCardActions, 2);
  assert.equal(reviewedPracticeCardCount(recoveredSkip.state), 1);

  const recoveredRating = recoverPreviousPracticeCard(recoveredSkip.state);
  assert.equal(recoveredRating.entry?.action, 'known');
  assert.equal(recoveredRating.state.completedCardActions, 2);
  assert.equal(reviewedPracticeCardCount(recoveredRating.state), 0);
});

test('tracks mixed review rounds with constant-size counters and separate completion', () => {
  let progress = createReviewRoundProgress();
  progress = recordReviewRoundAdvance(progress, {
    pool: 2,
    action: 'known',
    replacesRatedAction: false,
    cycled: false,
  });
  assert.deepEqual(progress, { reviewed: 1, completed: false, resetOnNextAdvance: false });

  progress = recordReviewRoundAdvance(progress, {
    pool: 2,
    action: 'skip',
    replacesRatedAction: false,
    cycled: true,
  });
  assert.deepEqual(progress, { reviewed: 1, completed: true, resetOnNextAdvance: true });

  progress = recordReviewRoundAdvance(progress, {
    pool: 2,
    action: 'skip',
    replacesRatedAction: false,
    cycled: false,
  });
  assert.deepEqual(progress, { reviewed: 0, completed: false, resetOnNextAdvance: false });

  progress = recordReviewRoundAdvance(progress, {
    pool: 2,
    action: 'saved',
    replacesRatedAction: false,
    cycled: true,
  });
  assert.deepEqual(progress, { reviewed: 1, completed: true, resetOnNextAdvance: true });

  progress = recordReviewRoundAdvance(progress, {
    pool: 2,
    action: 'known',
    replacesRatedAction: true,
    cycled: false,
  });
  assert.deepEqual(progress, { reviewed: 0, completed: false, resetOnNextAdvance: false });
});

test('retries a failed Practice read once without hiding a second failure', async () => {
  let attempts = 0;
  const waits: number[] = [];
  const result = await loadPracticeWithRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('transient');
      return 'recovered';
    },
    async (delayMs) => { waits.push(delayMs); },
  );
  assert.equal(result, 'recovered');
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [PRACTICE_RETRY_DELAY_MS]);

  await assert.rejects(
    () => loadPracticeWithRetry(
      async () => { throw new Error('still-failing'); },
      async () => undefined,
    ),
    /still-failing/,
  );

  let permanentAttempts = 0;
  const permanentWaits: number[] = [];
  await assert.rejects(
    () => loadPracticeWithRetry(
      async () => {
        permanentAttempts += 1;
        throw new Error('permanent');
      },
      async (delayMs) => { permanentWaits.push(delayMs); },
      () => false,
    ),
    /permanent/,
  );
  assert.equal(permanentAttempts, 1);
  assert.deepEqual(permanentWaits, []);
});

test('maps every prerequisite status and formats only valid last-seen timestamps', () => {
  assert.equal(prerequisiteKnowledgeState('known'), 'explainable');
  assert.equal(prerequisiteKnowledgeState('saved'), 'unclear');
  assert.equal(prerequisiteKnowledgeState(null), 'unseen');

  const formatted = formatReviewLastSeen(
    '2026-09-09T03:00:00.000Z',
    (date) => `localized:${date.toISOString()}`,
  );
  assert.equal(formatted, 'localized:2026-09-09T03:00:00.000Z');
  assert.equal(formatReviewLastSeen(undefined, () => 'unused'), null);
  assert.equal(formatReviewLastSeen('not-a-date', () => 'unused'), null);
});

test('wires review intent and server learning context into the mobile screens', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const practiceScreen = readFileSync(join(sourceDir, '../app/(tabs)/practice.tsx'), 'utf8');
  const reviewScreen = readFileSync(join(sourceDir, '../app/(tabs)/review.tsx'), 'utf8');

  assert.match(reviewScreen, /setReviewable\(reviewQueueCount\(result\.stats\)\)/);
  assert.match(reviewScreen, /const requestSequence = \+\+requestSequenceRef\.current/);
  assert.match(reviewScreen, /if \(!isLatestRequest\(\)\) return/);
  assert.match(reviewScreen, /return \(\) => \{ requestSequenceRef\.current \+= 1; \}/);
  assert.match(reviewScreen, /params: \{ mode: reviewable > 0 \? 'review' : 'new' \}/);
  assert.doesNotMatch(reviewScreen, /cards\.length > 0[\s\S]*?mode: 'review'/);
  assert.doesNotMatch(reviewScreen, /ListEmptyComponent[\s\S]*?params: \{ mode:/);
  assert.match(practiceScreen, /const reviewedCount = Object\.keys\(ratings\)\.length/);
  assert.doesNotMatch(practiceScreen, /const \[cardAdvanceCount,/);
  assert.match(practiceScreen, /resolvePracticeFocusMode\(routeModeRef\.current, modeRef\.current\)/);
  assert.match(practiceScreen, /router\.setParams\(\{ mode: undefined \}\)/);
  assert.match(practiceScreen, /requestSequence === requestSequenceRef\.current/);
  assert.match(practiceScreen, /cursorRef\.current = result\.nextCursor/);
  assert.equal(practiceScreen.match(/cursorRef\.current = null/g)?.length, 2);
  assert.doesNotMatch(practiceScreen, /ratedCardIds|skippedCardIds|excludeIds/);
  assert.doesNotMatch(practiceScreen, /roundRatedIdsRef|ratedCardActionCounts/);
  assert.equal(
    practiceScreen.match(/setHistoryState\(\(current\) => \(\{ \.\.\.current, history: \[\] \}\)\)/g)?.length,
    2,
  );
  assert.match(practiceScreen, /useFocusEffect[\s\S]*?setCard\(null\)[\s\S]*?void load\(focusMode\.mode/);
  assert.match(practiceScreen, /function changeMode[\s\S]*?setCard\(null\)[\s\S]*?void load\(nextMode/);
  assert.equal(practiceScreen.match(/setCard\(null\)/g)?.length, 2);

  assert.match(practiceScreen, /card\.prerequisites\.map\(\(prerequisite\) =>/);
  assert.match(practiceScreen, /accessibilityLabel=\{`\$\{prerequisite\.label\}: \$\{stateLabel\}`\}/);
  assert.match(reviewScreen, /formatReviewLastSeen\(\s*item\.last_seen,/);
  assert.match(practiceScreen, /accessibilityLabel=\{t\('practice\.previousAria'\)\}/);
  assert.match(practiceScreen, />\{t\('practice\.previous'\)\}<\/Text>/);

  const previousHandler = practiceScreen.match(/function showPrevious\(\) \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
  assert.match(previousHandler, /recoverPreviousPracticeCard\(historyState\)/);
  assert.doesNotMatch(previousHandler, /mobileApi\./);
  assert.doesNotMatch(previousHandler, /cursorRef/);

  const rateHandler = practiceScreen.match(/async function rate\([^]*?\) \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
  assert.match(rateHandler, /const actionMode = modeRef\.current/);
  assert.match(rateHandler, /const cursor = cursorRef\.current/);
  assert.match(rateHandler, /const advanced = await load\(actionMode, cursor, sessionGeneration, true\)/);
  assert.match(rateHandler, /recordReviewRoundAdvance\(current, \{[\s\S]*?action: status,[\s\S]*?cycled: advanced\.cycled/);
  assert.ok(rateHandler.indexOf('recordAdvance') > rateHandler.indexOf('if (!advanced.ok'));

  const skipHandler = practiceScreen.match(/async function skip\(\) \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
  assert.match(skipHandler, /const cursor = cursorRef\.current/);
  assert.match(skipHandler, /const advanced = await load\(actionMode, cursor, sessionGeneration, true\)/);
  assert.match(skipHandler, /recordReviewRoundAdvance\(current, \{[\s\S]*?action: 'skip',[\s\S]*?cycled: advanced\.cycled/);
  assert.ok(skipHandler.indexOf('recordAdvance') > skipHandler.indexOf('if (!advanced.ok'));
  assert.match(practiceScreen, /loadPracticeWithRetry\([\s\S]*?isTransientMobileApiError/);
  assert.match(practiceScreen, /reviewedPracticeCardCount\(historyState\)/);
  assert.match(practiceScreen, /accessibilityRole="progressbar"[\s\S]*?practice\.roundComplete/);
  assert.match(practiceScreen, /Platform\.OS === 'ios'[\s\S]*?AccessibilityInfo\.announceForAccessibility/);
});
