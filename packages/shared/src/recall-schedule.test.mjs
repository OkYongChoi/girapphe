import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RECALL_D1_OPEN_MS,
  RECALL_D7_CLOSE_MS,
  RECALL_D7_OPEN_MS,
  assessRecallSchedule,
  classifyRecallWindow,
  createRecallEnrollmentSchedule,
  isRecallSupportedBundleType,
  requestRecallSnooze,
  rescheduleUnopenedRecall,
  rollRecallWindow,
} from './recall-schedule.ts';

const T0 = '2026-09-01T00:00:00.000Z';
const at = (elapsedMs) => new Date(new Date(T0).getTime() + elapsedMs).toISOString();
const hour = 60 * 60 * 1_000;
const day = 24 * hour;
const enroll = (elapsedMs = 30 * hour) => (
  createRecallEnrollmentSchedule(T0, at(elapsedMs)).snapshot
);

test('limits the initial Recall Ping pilot to the first three bundle types', () => {
  assert.equal(isRecallSupportedBundleType('concept'), true);
  assert.equal(isRecallSupportedBundleType('procedure'), true);
  assert.equal(isRecallSupportedBundleType('comparison'), true);
  assert.equal(isRecallSupportedBundleType('mechanism'), false);
  assert.equal(isRecallSupportedBundleType('unknown'), false);
});

test('classifies every exact D+1 and D+7 boundary without overlap', () => {
  assert.equal(classifyRecallWindow(T0, at(RECALL_D1_OPEN_MS - 1)), 'before_d1');
  assert.equal(classifyRecallWindow(T0, at(RECALL_D1_OPEN_MS)), 'd1');
  assert.equal(classifyRecallWindow(T0, at(RECALL_D7_OPEN_MS - 1)), 'd1');
  assert.equal(classifyRecallWindow(T0, at(RECALL_D7_OPEN_MS)), 'd7');
  assert.equal(classifyRecallWindow(T0, at(RECALL_D7_CLOSE_MS - 1)), 'd7');
  assert.equal(classifyRecallWindow(T0, at(RECALL_D7_CLOSE_MS)), 'post_d7');
});

test('accepts only absolute string instants so runtimes cannot reinterpret local time', () => {
  assert.equal(
    classifyRecallWindow('2026-09-01T09:00:00+09:00', '2026-09-02T09:00:00+09:00'),
    'd1',
  );
  assert.throws(() => classifyRecallWindow('2026-09-01T09:00:00', at(day)));
  assert.throws(() => classifyRecallWindow('2026-09-01', at(day)));
  assert.throws(() => classifyRecallWindow('2026-02-30T00:00:00Z', at(day)));
});

test('enrollment accepts only the first preferred instant in the 24-to-48-hour window', () => {
  assert.equal(enroll(day).dueAt, at(day));
  assert.equal(enroll(2 * day - 1).dueAt, at(2 * day - 1));
  const decision = createRecallEnrollmentSchedule(T0, at(30 * hour));
  assert.equal(decision.snapshot.state, 'd1_pending');
  assert.equal(decision.snapshot.dueAt, at(30 * hour));
  assert.equal(decision.snapshot.d7Outcome, null);
  assert.deepEqual(decision.practiceProjection, { action: 'preserve' });
  assert.throws(() => createRecallEnrollmentSchedule(T0, at(day - 1)));
  assert.throws(() => createRecallEnrollmentSchedule(T0, at(2 * day)));
});

test('an item first due at 24 hours can be assessed at that exact instant', () => {
  const decision = assessRecallSchedule(enroll(day), {
    at: at(day), outcome: 'remembered', nextPreferredDeliveryAt: at(7 * day),
  });
  assert.equal(decision.snapshot.state, 'd7_pending');
  assert.equal(decision.snapshot.dueAt, at(7 * day));
});

test('remembered D+1 projects known/review and retains the fixed D+7 anchor', () => {
  const decision = assessRecallSchedule(enroll(), {
    at: at(31 * hour),
    outcome: 'remembered',
    nextPreferredDeliveryAt: at(7 * day + 9 * hour),
  });
  assert.equal(decision.snapshot.state, 'd7_pending');
  assert.equal(decision.snapshot.dueAt, at(7 * day + 9 * hour));
  assert.equal(decision.snapshot.d1FinalizedIncomplete, false);
  assert.deepEqual(decision.practiceProjection, {
    action: 'set', status: 'known', knowledgeState: 'known', progressState: 'review',
  });
});

test('partial D+1 projects saved/learning while one due instant moves to retry or D+7', () => {
  const retry = assessRecallSchedule(enroll(), {
    at: at(31 * hour), outcome: 'partial', nextPreferredDeliveryAt: at(54 * hour),
  });
  assert.equal(retry.snapshot.state, 'd1_retry');
  assert.deepEqual(retry.practiceProjection, {
    action: 'set', status: 'saved', knowledgeState: 'unknown', progressState: 'learning',
  });

  const d7 = assessRecallSchedule(retry.snapshot, {
    at: at(167 * hour), outcome: 'missed', nextPreferredDeliveryAt: at(7 * day + hour),
  });
  assert.equal(d7.snapshot.state, 'd7_pending');
  assert.equal(d7.snapshot.d1FinalizedIncomplete, true);
  assert.equal(d7.snapshot.dueAt, at(7 * day + hour));
});

test('unopened D+1 preserves Practice and D+7 wins at exactly 168 hours', () => {
  const retry = rescheduleUnopenedRecall(enroll(), {
    at: at(31 * hour), nextPreferredDeliveryAt: at(55 * hour),
  });
  assert.equal(retry.snapshot.state, 'd1_retry');
  assert.deepEqual(retry.practiceProjection, { action: 'preserve' });

  assert.throws(() => assessRecallSchedule(retry.snapshot, {
    at: at(7 * day), outcome: 'remembered', nextPreferredDeliveryAt: at(7 * day + hour),
  }));
  const d7 = rollRecallWindow(retry.snapshot, {
    at: at(7 * day), nextD7DeliveryAt: at(7 * day),
  });
  assert.equal(d7.snapshot.state, 'd7_pending');
  assert.equal(d7.snapshot.dueAt, at(7 * day));
  assert.equal(d7.snapshot.d1FinalizedIncomplete, true);
  assert.deepEqual(d7.practiceProjection, { action: 'preserve' });
});

test('late D+7 reconciliation preserves a preferred instant that is already due', () => {
  const d7 = rollRecallWindow(enroll(), {
    at: at(170 * hour), nextD7DeliveryAt: at(169 * hour),
  });
  assert.equal(d7.snapshot.state, 'd7_pending');
  assert.equal(d7.snapshot.dueAt, at(169 * hour));
  assert.equal(d7.snapshot.d1FinalizedIncomplete, true);
});

test('an unopened retry does not replay the previous assessed Practice write', () => {
  const partial = assessRecallSchedule(enroll(), {
    at: at(31 * hour), outcome: 'partial', nextPreferredDeliveryAt: at(55 * hour),
  });
  const unopened = rescheduleUnopenedRecall(partial.snapshot, {
    at: at(55 * hour), nextPreferredDeliveryAt: at(79 * hour),
  });
  assert.deepEqual(unopened.practiceProjection, { action: 'preserve' });
});

test('D+7 assessment returns to ordinary Practice with an explicit terminal outcome', () => {
  const d7 = assessRecallSchedule(enroll(), {
    at: at(31 * hour), outcome: 'remembered', nextPreferredDeliveryAt: at(7 * day + hour),
  });
  const remembered = assessRecallSchedule(d7.snapshot, {
    at: at(7 * day + 2 * hour), outcome: 'remembered',
  });
  assert.equal(remembered.snapshot.state, 'ordinary_practice');
  assert.equal(remembered.snapshot.dueAt, at(21 * day + 2 * hour));
  assert.equal(remembered.snapshot.d7Outcome, 'remembered');

  const partial = assessRecallSchedule(d7.snapshot, {
    at: at(7 * day + 2 * hour), outcome: 'partial',
  });
  assert.equal(partial.snapshot.state, 'ordinary_practice');
  assert.equal(partial.snapshot.dueAt, at(8 * day));
  assert.equal(partial.snapshot.d7Outcome, 'partial');
  assert.equal(partial.practiceProjection.status, 'saved');
});

test('an unopened D+7 window closes as explicitly unassessed at 192 hours', () => {
  const d7 = rollRecallWindow(enroll(), {
    at: at(7 * day), nextD7DeliveryAt: at(7 * day + hour),
  });
  const ordinary = rollRecallWindow(d7.snapshot, { at: at(8 * day) });
  assert.equal(ordinary.snapshot.state, 'ordinary_practice');
  assert.equal(ordinary.snapshot.dueAt, at(8 * day));
  assert.equal(ordinary.snapshot.d7Outcome, 'unassessed');
  assert.deepEqual(ordinary.practiceProjection, { action: 'preserve' });
});

test('one-hour snooze is idempotent and is cancelled rather than crossing D+7', () => {
  const schedule = enroll();
  const snoozed = requestRecallSnooze(schedule, {
    at: at(30 * hour), alreadySnoozed: false,
  });
  assert.equal(snoozed.kind, 'scheduled');
  assert.equal(snoozed.snapshot.dueAt, at(31 * hour));
  assert.deepEqual(snoozed.practiceProjection, { action: 'preserve' });
  assert.deepEqual(requestRecallSnooze(snoozed.snapshot, {
    at: at(30 * hour), alreadySnoozed: true,
  }), {
    kind: 'unchanged',
    snoozeConsumed: true,
    snapshot: snoozed.snapshot,
    practiceProjection: { action: 'preserve' },
  });

  const nearBoundary = { ...schedule, state: 'd1_retry', dueAt: at(167.5 * hour) };
  const cancelled = requestRecallSnooze(nearBoundary, {
    at: at(167.5 * hour),
    alreadySnoozed: false,
    nextMilestoneDeliveryAt: at(7 * day + hour),
  });
  assert.equal(cancelled.kind, 'cancelled_for_boundary');
  assert.equal(cancelled.snapshot.state, 'd7_pending');
  assert.equal(cancelled.snapshot.dueAt, at(7 * day + hour));
});

test('a D+7 snooze that reaches 192 hours closes into unassessed ordinary Practice', () => {
  const d7 = rollRecallWindow(enroll(), {
    at: at(7 * day), nextD7DeliveryAt: at(191.5 * hour),
  });
  const cancelled = requestRecallSnooze(d7.snapshot, {
    at: at(191.5 * hour), alreadySnoozed: false,
  });
  assert.equal(cancelled.kind, 'cancelled_for_boundary');
  assert.equal(cancelled.snapshot.state, 'ordinary_practice');
  assert.equal(cancelled.snapshot.dueAt, at(8 * day));
  assert.equal(cancelled.snapshot.d7Outcome, 'unassessed');
  assert.deepEqual(cancelled.practiceProjection, { action: 'preserve' });
});

test('a snooze landing exactly on either milestone boundary is cancelled', () => {
  const d1 = { ...enroll(), state: 'd1_retry', dueAt: at(167 * hour) };
  const d7 = requestRecallSnooze(d1, {
    at: at(167 * hour),
    alreadySnoozed: false,
    nextMilestoneDeliveryAt: at(7 * day),
  });
  assert.equal(d7.kind, 'cancelled_for_boundary');
  assert.equal(d7.snapshot.state, 'd7_pending');
  assert.equal(d7.snapshot.dueAt, at(7 * day));

  const dueAt191 = { ...d7.snapshot, dueAt: at(191 * hour) };
  const ordinary = requestRecallSnooze(dueAt191, {
    at: at(191 * hour), alreadySnoozed: false,
  });
  assert.equal(ordinary.kind, 'cancelled_for_boundary');
  assert.equal(ordinary.snapshot.state, 'ordinary_practice');
  assert.equal(ordinary.snapshot.dueAt, at(8 * day));
  assert.equal(ordinary.snapshot.d7Outcome, 'unassessed');
});

test('milestone precedence beats even an already-consumed stale snooze request', () => {
  const d7 = requestRecallSnooze(enroll(), {
    at: at(7 * day),
    alreadySnoozed: true,
    nextMilestoneDeliveryAt: at(7 * day),
  });
  assert.equal(d7.kind, 'cancelled_for_boundary');
  assert.equal(d7.snapshot.state, 'd7_pending');
  assert.equal(d7.snapshot.dueAt, at(7 * day));

  const ordinary = requestRecallSnooze(d7.snapshot, {
    at: at(8 * day), alreadySnoozed: true,
  });
  assert.equal(ordinary.kind, 'cancelled_for_boundary');
  assert.equal(ordinary.snapshot.state, 'ordinary_practice');
  assert.equal(ordinary.snapshot.dueAt, at(8 * day));
  assert.equal(ordinary.snapshot.d7Outcome, 'unassessed');
});

test('invalid instants, early actions, backward due time, and late D+7 are rejected', () => {
  assert.throws(() => createRecallEnrollmentSchedule('not-a-date', at(30 * hour)));
  const schedule = enroll();
  assert.throws(() => requestRecallSnooze(schedule, {
    at: at(29 * hour), alreadySnoozed: false,
  }));
  assert.throws(() => assessRecallSchedule(schedule, {
    at: at(day - 1), outcome: 'remembered', nextPreferredDeliveryAt: at(7 * day),
  }));
  assert.throws(() => assessRecallSchedule(schedule, {
    at: at(31 * hour), outcome: 'partial', nextPreferredDeliveryAt: at(30 * hour),
  }));
  const d7 = rollRecallWindow(schedule, {
    at: at(7 * day), nextD7DeliveryAt: at(7 * day + hour),
  });
  assert.throws(() => assessRecallSchedule(d7.snapshot, {
    at: at(8 * day), outcome: 'remembered',
  }));
});
