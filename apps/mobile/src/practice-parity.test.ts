import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createPracticeHistoryState,
  appendPracticeSeenCard,
  formatReviewLastSeen,
  PRACTICE_HISTORY_LIMIT,
  prerequisiteKnowledgeState,
  recordCompletedPracticeAction,
  recoverPreviousPracticeCard,
  resolvePracticeMode,
  resolvePracticeFocusMode,
  reviewQueueCount,
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

test('keeps bounded exclusion history unique while refreshing card recency', () => {
  assert.deepEqual(appendPracticeSeenCard(['a', 'b', 'a'], 'a'), ['b', 'a']);
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

  const recovered = recoverPreviousPracticeCard(state);
  assert.equal(recovered.entry?.card.id, `card-${PRACTICE_HISTORY_LIMIT + 1}`);
  assert.equal(recovered.entry?.action, 'known');
  assert.equal(recovered.state.history.length, PRACTICE_HISTORY_LIMIT - 1);
  assert.equal(recovered.state.completedCardActions, state.completedCardActions);

  const empty = recoverPreviousPracticeCard(createPracticeHistoryState());
  assert.equal(empty.entry, null);
  assert.equal(empty.state.completedCardActions, 0);
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

  assert.match(reviewScreen, /pathname: '\/\(tabs\)\/practice', params: \{ mode: 'review' \}/);
  assert.match(reviewScreen, /cards\.length > 0 \? \([\s\S]*?params: \{ mode: 'review' \}/);
  assert.match(reviewScreen, /ListEmptyComponent[\s\S]*?params: \{ mode: 'new' \}/);
  assert.match(practiceScreen, /resolvePracticeFocusMode\(routeModeRef\.current, modeRef\.current\)/);
  assert.match(practiceScreen, /router\.setParams\(\{ mode: undefined \}\)/);
  assert.match(practiceScreen, /requestSequence === requestSequenceRef\.current/);
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

  const rateHandler = practiceScreen.match(/async function rate\([^]*?\) \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
  assert.match(rateHandler, /const actionMode = modeRef\.current/);
  assert.match(rateHandler, /const advanced = await load\(actionMode, nextSeen, sessionGeneration\)/);
  assert.ok(rateHandler.indexOf('recordAdvance') > rateHandler.indexOf('if (!advanced'));

  const skipHandler = practiceScreen.match(/async function skip\(\) \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
  assert.match(skipHandler, /const advanced = await load\(actionMode, nextSeen, sessionGeneration\)/);
  assert.ok(skipHandler.indexOf('recordAdvance') > skipHandler.indexOf('if (!advanced'));
});
