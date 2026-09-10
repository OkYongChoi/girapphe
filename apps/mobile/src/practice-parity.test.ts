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
  resolvePendingRatedPracticeAdvance,
  resolvePracticeHistoryActionAfterSkip,
  resolvePracticeMode,
  resolvePracticeFocusMode,
  resolvePracticeSkipAdvance,
  reviewQueueCount,
  reviewedPracticeCardCount,
} from './practice-parity';
import { catalogs } from './i18n/catalogs';

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

test('preserves a recovered rating when skip advances the completed-action cadence', () => {
  for (const previousAction of ['known', 'saved'] as const) {
    let state = createPracticeHistoryState<{ id: string }>();
    for (let index = 0; index < 4; index += 1) {
      state = recordCompletedPracticeAction(state, { id: `card-${index}` }, previousAction);
    }

    const recovered = recoverPreviousPracticeCard(state);
    assert.ok(recovered.entry);
    assert.equal(recovered.entry.action, previousAction);

    const skipAdvance = resolvePracticeSkipAdvance(null, recovered.entry.action);
    const advanced = recordCompletedPracticeAction(
      recovered.state,
      recovered.entry.card,
      skipAdvance.action,
    );

    assert.deepEqual(skipAdvance, { action: previousAction, replacesRatedAction: true });
    assert.equal(advanced.completedCardActions, 5);
    assert.equal(advanced.completedCardActions % 5, 0);
    assert.equal(reviewedPracticeCardCount(advanced), 4);
    assert.equal(advanced.history.at(-1)?.action, previousAction);
  }

  assert.equal(resolvePracticeHistoryActionAfterSkip('skip'), 'skip');
  assert.equal(resolvePracticeHistoryActionAfterSkip(null), 'skip');
});

test('counts a persisted new rating when its failed read is later advanced by Skip', () => {
  let history = createPracticeHistoryState<{ id: string }>();
  for (let index = 0; index < 4; index += 1) {
    history = recordCompletedPracticeAction(history, { id: `prior-${index}` }, 'known');
  }
  let progress = createReviewRoundProgress();

  // The server accepted this first rating, but the next-card read failed.
  const pending = resolvePendingRatedPracticeAdvance(null, null, 'saved');
  assert.deepEqual(pending, { action: 'saved', replacesRatedAction: false });

  // A later Skip advances the frontier without losing the persisted rating.
  const skipAdvance = resolvePracticeSkipAdvance(pending, null);
  progress = recordReviewRoundAdvance(progress, {
    pool: 5,
    ...skipAdvance,
    cycled: false,
  });
  history = recordCompletedPracticeAction(history, { id: 'newly-rated' }, skipAdvance.action);

  assert.deepEqual(skipAdvance, { action: 'saved', replacesRatedAction: false });
  assert.equal(history.history.at(-1)?.action, 'saved');
  assert.equal(reviewedPracticeCardCount(history), 5);
  assert.equal(progress.reviewed, 1);
  assert.equal(history.completedCardActions, 5);
  assert.equal(history.completedCardActions % 5, 0);
});

test('preserves a persisted re-rating when its failed read is later advanced by Skip', () => {
  let history = createPracticeHistoryState<{ id: string }>();
  for (let index = 0; index < 4; index += 1) {
    history = recordCompletedPracticeAction(history, { id: `card-${index}` }, 'known');
  }
  const recovered = recoverPreviousPracticeCard(history);
  assert.ok(recovered.entry);
  let progress = recordReviewRoundAdvance(createReviewRoundProgress(), {
    pool: 4,
    action: 'known',
    replacesRatedAction: false,
    cycled: false,
  });

  // The replacement reached the server, then the next-card read failed.
  const pending = resolvePendingRatedPracticeAdvance(null, recovered.entry.action, 'saved');
  assert.deepEqual(pending, { action: 'saved', replacesRatedAction: true });

  const skipAdvance = resolvePracticeSkipAdvance(pending, recovered.entry.action);
  progress = recordReviewRoundAdvance(progress, {
    pool: 4,
    ...skipAdvance,
    cycled: false,
  });
  history = recordCompletedPracticeAction(
    recovered.state,
    recovered.entry.card,
    skipAdvance.action,
  );

  assert.deepEqual(skipAdvance, { action: 'saved', replacesRatedAction: true });
  assert.equal(history.history.at(-1)?.action, 'saved');
  assert.equal(reviewedPracticeCardCount(history), 4);
  assert.equal(progress.reviewed, 1);
  assert.equal(history.completedCardActions, 5);
  assert.equal(history.completedCardActions % 5, 0);
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

test('rerating before an advance preserves whether the first persisted rating was counted', () => {
  const newRating = resolvePendingRatedPracticeAdvance(null, null, 'saved');
  assert.deepEqual(
    resolvePendingRatedPracticeAdvance(newRating, null, 'known'),
    { action: 'known', replacesRatedAction: false },
  );

  const replacement = resolvePendingRatedPracticeAdvance(null, 'known', 'saved');
  assert.deepEqual(
    resolvePendingRatedPracticeAdvance(replacement, 'known', 'known'),
    { action: 'known', replacesRatedAction: true },
  );
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

test('keeps Previous reachable when a synced advance exhausts the current queue', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const practiceScreen = readFileSync(join(sourceDir, '../app/(tabs)/practice.tsx'), 'utf8');
  const navigationStart = practiceScreen.indexOf(
    '{!loading && !sponsoredCardVisible && (card || historyState.history.length > 0) ? (',
  );
  const cardOnlyBranch = practiceScreen.indexOf('{sponsoredCardVisible ? (', navigationStart);
  const previousControl = practiceScreen.indexOf(
    "accessibilityLabel={t('practice.previousAria')}",
    navigationStart,
  );

  assert.notEqual(navigationStart, -1);
  assert.notEqual(cardOnlyBranch, -1);
  assert.notEqual(previousControl, -1);
  assert.ok(previousControl < cardOnlyBranch, 'Previous must render before the card-only branch');
  assert.doesNotMatch(
    practiceScreen.slice(cardOnlyBranch),
    /accessibilityLabel=\{t\('practice\.previousAria'\)\}/,
  );
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
  const syncedLoad = practiceScreen.slice(
    practiceScreen.indexOf('const load = useCallback'),
    practiceScreen.indexOf('useFocusEffect', practiceScreen.indexOf('const load = useCallback')),
  );
  assert.doesNotMatch(syncedLoad, /setPreviousAction/);
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
  assert.match(previousHandler, /if \(busyRef\.current \|\| pendingRatedAdvance\) return/);
  assert.match(previousHandler, /recoverPreviousPracticeCard\(historyState\)/);
  assert.doesNotMatch(previousHandler, /mobileApi\./);
  assert.doesNotMatch(previousHandler, /cursorRef/);

  const rateHandler = practiceScreen.match(/async function rate\([^]*?\) \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
  assert.match(rateHandler, /resolvePendingRatedPracticeAdvance\([\s\S]*?pendingRatedAdvance,[\s\S]*?previousAction,[\s\S]*?status/);
  assert.match(rateHandler, /const actionMode = modeRef\.current/);
  assert.match(rateHandler, /const cursor = cursorRef\.current/);
  assert.match(rateHandler, /const advanced = await load\(actionMode, cursor, sessionGeneration, true\)/);
  assert.ok(rateHandler.indexOf('setPendingRatedAdvance(ratedAdvance)') > rateHandler.indexOf('await mobileApi.mutate'));
  assert.ok(rateHandler.indexOf('setPendingRatedAdvance(ratedAdvance)') < rateHandler.indexOf('const advanced = await load'));
  assert.match(rateHandler, /setPreviousAction\(\(current\) => resolvePreviousPracticeActionAfterAdvance\(current, advanced\.ok\)\)[\s\S]*?if \(!advanced\.ok\) return/);
  assert.ok(rateHandler.indexOf('setPendingRatedAdvance(null)') > rateHandler.indexOf('if (!advanced.ok) return'));
  assert.match(rateHandler, /recordReviewRoundAdvance\(current, \{[\s\S]*?action: ratedAdvance\.action,[\s\S]*?replacesRatedAction: ratedAdvance\.replacesRatedAction,[\s\S]*?cycled: advanced\.cycled/);
  assert.match(rateHandler, /recordAdvance\(completedCard, ratedAdvance\.action\)/);
  assert.ok(rateHandler.indexOf('recordAdvance') > rateHandler.indexOf('if (!advanced.ok'));

  const skipHandler = practiceScreen.match(/async function skip\(\) \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
  assert.match(skipHandler, /const skipAdvance = resolvePracticeSkipAdvance\(pendingRatedAdvance, previousAction\)/);
  assert.match(skipHandler, /const cursor = cursorRef\.current/);
  assert.match(skipHandler, /const advanced = await load\(actionMode, cursor, sessionGeneration, true\)/);
  assert.match(skipHandler, /setPreviousAction\(\(current\) => resolvePreviousPracticeActionAfterAdvance\(current, advanced\.ok\)\)[\s\S]*?if \(!advanced\.ok\) return/);
  assert.ok(skipHandler.indexOf('setPendingRatedAdvance(null)') > skipHandler.indexOf('if (!advanced.ok) return'));
  assert.match(skipHandler, /recordReviewRoundAdvance\(current, \{[\s\S]*?action: skipAdvance\.action,[\s\S]*?replacesRatedAction: skipAdvance\.replacesRatedAction,[\s\S]*?cycled: advanced\.cycled/);
  assert.match(skipHandler, /recordAdvance\(completedCard, skipAdvance\.action\)/);
  assert.ok(skipHandler.indexOf('recordAdvance') > skipHandler.indexOf('if (!advanced.ok'));
  assert.match(practiceScreen, /const previousDisabled = historyState\.history\.length === 0 \|\| pendingRatedAdvance !== null/);
  assert.match(practiceScreen, /accessibilityState=\{\{ disabled: previousDisabled \}\}/);
  assert.match(practiceScreen, /loadPracticeWithRetry\([\s\S]*?isTransientMobileApiError/);
  assert.match(practiceScreen, /reviewedPracticeCardCount\(historyState\)/);
  assert.match(practiceScreen, /accessibilityRole="progressbar"[\s\S]*?practice\.roundComplete/);
  assert.match(practiceScreen, /Platform\.OS === 'ios'[\s\S]*?AccessibilityInfo\.announceForAccessibility/);
});

test('round completion copy stays true when a cycle returns no next card', () => {
  assert.deepEqual(
    Object.values(catalogs).map((catalog) => catalog['practice.roundComplete']),
    [
      'Round complete! You went through all {count} cards.',
      'ラウンド完了！{count}枚すべて確認しました。',
      '本轮完成！您已浏览完所有 {count} 张卡片。',
      '¡Ronda completada! Has visto las {count} tarjetas.',
      'اكتملت الجولة! مررت بجميع البطاقات وعددها {count}.',
      'चरण पूरा हुआ! आपने सभी {count} कार्ड देख लिए।',
    ],
  );
});
