import type { KnowledgeBundleType } from './knowledge-bundles';

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
const ABSOLUTE_INSTANT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export const RECALL_SUPPORTED_BUNDLE_TYPES = [
  'concept',
  'procedure',
  'comparison',
] as const satisfies readonly KnowledgeBundleType[];

export const RECALL_D1_OPEN_MS = DAY_MS;
export const RECALL_D1_INITIAL_DELIVERY_CLOSE_MS = 2 * DAY_MS;
export const RECALL_D7_OPEN_MS = 7 * DAY_MS;
export const RECALL_D7_CLOSE_MS = 8 * DAY_MS;
export const RECALL_POST_D7_INTERVAL_MS = 14 * DAY_MS;
export const RECALL_SNOOZE_MS = HOUR_MS;

export type RecallSupportedBundleType = (typeof RECALL_SUPPORTED_BUNDLE_TYPES)[number];
export type RecallWindow = 'before_d1' | 'd1' | 'd7' | 'post_d7';
export type RecallScheduleState =
  | 'd1_pending'
  | 'd1_retry'
  | 'd7_pending'
  | 'ordinary_practice';
export type RecallAssessmentOutcome = 'remembered' | 'partial' | 'missed';
export type RecallD7Outcome = RecallAssessmentOutcome | 'unassessed';

/** A one-shot write instruction returned by a transition, never durable state. */
export type RecallPracticeProjection =
  | { action: 'preserve' }
  | {
      action: 'set';
      status: 'known';
      knowledgeState: 'known';
      progressState: 'review';
    }
  | {
      action: 'set';
      status: 'saved';
      knowledgeState: 'unknown';
      progressState: 'learning';
    };

export type RecallScheduleSnapshot = {
  enrolledAt: string;
  state: RecallScheduleState;
  dueAt: string;
  d1FinalizedIncomplete: boolean;
  d7Outcome: RecallD7Outcome | null;
};

export type RecallScheduleDecision = {
  /** Durable scheduling state that may be passed to the next transition. */
  snapshot: RecallScheduleSnapshot;
  /** Apply once in the same transaction as the returned snapshot. */
  practiceProjection: RecallPracticeProjection;
};

export type RecallSnoozeDecision = RecallScheduleDecision & {
  kind: 'scheduled' | 'unchanged' | 'cancelled_for_boundary';
  snoozeConsumed: boolean;
};

export type RecallInstant = Date | string;

const PRESERVE_PRACTICE = { action: 'preserve' } as const;
const KNOWN_PRACTICE = {
  action: 'set',
  status: 'known',
  knowledgeState: 'known',
  progressState: 'review',
} as const;
const SAVED_PRACTICE = {
  action: 'set',
  status: 'saved',
  knowledgeState: 'unknown',
  progressState: 'learning',
} as const;

function instantMs(value: RecallInstant, field: string): number {
  if (typeof value === 'string') {
    const match = ABSOLUTE_INSTANT_PATTERN.exec(value);
    if (!match) throw new Error(`Invalid ${field}.`);
    const [, year, month, day, hour, minute, second, offset] = match;
    const numericYear = Number(year);
    const numericMonth = Number(month);
    const numericDay = Number(day);
    const numericHour = Number(hour);
    const numericMinute = Number(minute);
    const numericSecond = Number(second);
    const offsetHour = offset === 'Z' ? 0 : Number(offset?.slice(1, 3));
    const offsetMinute = offset === 'Z' ? 0 : Number(offset?.slice(4, 6));
    const daysInMonth = numericMonth >= 1 && numericMonth <= 12
      ? new Date(Date.UTC(numericYear, numericMonth, 0)).getUTCDate()
      : 0;
    if (
      numericDay < 1
      || numericDay > daysInMonth
      || numericHour > 23
      || numericMinute > 59
      || numericSecond > 59
      || offsetHour > 23
      || offsetMinute > 59
    ) {
      throw new Error(`Invalid ${field}.`);
    }
  }
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ${field}.`);
  return timestamp;
}

function iso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function snapshotEnrollmentMs(snapshot: RecallScheduleSnapshot): number {
  return instantMs(snapshot.enrolledAt, 'enrolledAt');
}

function ensureStateWindow(
  state: RecallScheduleState,
  enrolledAt: number,
  at: number,
): 'd1' | 'd7' {
  const window = classifyRecallWindow(iso(enrolledAt), iso(at));
  if ((state === 'd1_pending' || state === 'd1_retry') && window === 'd1') return 'd1';
  if (state === 'd7_pending' && window === 'd7') return 'd7';
  throw new Error(`Recall state ${state} is not active in the ${window} window.`);
}

function ensureDueAfter(dueAt: number, after: number): void {
  if (dueAt <= after) throw new Error('The next due instant must be after the event instant.');
}

function ensureEventIsDue(snapshot: RecallScheduleSnapshot, at: number): void {
  const dueAt = instantMs(snapshot.dueAt, 'dueAt');
  if (at < dueAt) throw new Error('The Recall item is not due yet.');
}

function ensureWindowDue(
  dueAt: number,
  opensAt: number,
  closesAt: number,
  label: string,
): void {
  if (dueAt < opensAt || dueAt >= closesAt) {
    throw new Error(`${label} must fall inside its elapsed-time window.`);
  }
}

export function isRecallSupportedBundleType(
  value: unknown,
): value is RecallSupportedBundleType {
  return RECALL_SUPPORTED_BUNDLE_TYPES.some((candidate) => candidate === value);
}

export function getRecallBoundaries(enrolledAt: RecallInstant): {
  d1OpensAt: string;
  d1InitialDeliveryClosesAt: string;
  d7OpensAt: string;
  d7ClosesAt: string;
} {
  const enrolledAtMs = instantMs(enrolledAt, 'enrolledAt');
  return {
    d1OpensAt: iso(enrolledAtMs + RECALL_D1_OPEN_MS),
    d1InitialDeliveryClosesAt: iso(enrolledAtMs + RECALL_D1_INITIAL_DELIVERY_CLOSE_MS),
    d7OpensAt: iso(enrolledAtMs + RECALL_D7_OPEN_MS),
    d7ClosesAt: iso(enrolledAtMs + RECALL_D7_CLOSE_MS),
  };
}

export function classifyRecallWindow(enrolledAt: RecallInstant, at: RecallInstant): RecallWindow {
  const enrolledAtMs = instantMs(enrolledAt, 'enrolledAt');
  const atMs = instantMs(at, 'at');
  const elapsed = atMs - enrolledAtMs;
  if (elapsed < RECALL_D1_OPEN_MS) return 'before_d1';
  if (elapsed < RECALL_D7_OPEN_MS) return 'd1';
  if (elapsed < RECALL_D7_CLOSE_MS) return 'd7';
  return 'post_d7';
}

/**
 * The timezone adapter supplies the first preferred wall-clock instant. This
 * dependency-light contract verifies that it stays inside the elapsed D+1
 * window and returns no assessed Practice projection.
 */
export function createRecallEnrollmentSchedule(
  enrolledAt: RecallInstant,
  firstDeliveryAt: RecallInstant,
): RecallScheduleDecision {
  const enrolledAtMs = instantMs(enrolledAt, 'enrolledAt');
  const dueAtMs = instantMs(firstDeliveryAt, 'firstDeliveryAt');
  ensureWindowDue(
    dueAtMs,
    enrolledAtMs + RECALL_D1_OPEN_MS,
    enrolledAtMs + RECALL_D1_INITIAL_DELIVERY_CLOSE_MS,
    'The first D+1 delivery',
  );
  return {
    snapshot: {
      enrolledAt: iso(enrolledAtMs),
      state: 'd1_pending',
      dueAt: iso(dueAtMs),
      d1FinalizedIncomplete: false,
      d7Outcome: null,
    },
    practiceProjection: PRESERVE_PRACTICE,
  };
}

export function assessRecallSchedule(
  snapshot: RecallScheduleSnapshot,
  input: {
    at: RecallInstant;
    outcome: RecallAssessmentOutcome;
    nextPreferredDeliveryAt?: RecallInstant;
  },
): RecallScheduleDecision {
  const enrolledAtMs = snapshotEnrollmentMs(snapshot);
  const atMs = instantMs(input.at, 'at');
  const window = ensureStateWindow(snapshot.state, enrolledAtMs, atMs);
  ensureEventIsDue(snapshot, atMs);

  if (window === 'd7') {
    if (input.nextPreferredDeliveryAt !== undefined) {
      throw new Error('D+7 assessment derives its ordinary Practice due instant.');
    }
    if (input.outcome === 'remembered') {
      return {
        snapshot: {
          ...snapshot,
          state: 'ordinary_practice',
          dueAt: iso(atMs + RECALL_POST_D7_INTERVAL_MS),
          d7Outcome: 'remembered',
        },
        practiceProjection: KNOWN_PRACTICE,
      };
    }
    return {
      snapshot: {
        ...snapshot,
        state: 'ordinary_practice',
        dueAt: iso(enrolledAtMs + RECALL_D7_CLOSE_MS),
        d7Outcome: input.outcome,
      },
      practiceProjection: SAVED_PRACTICE,
    };
  }

  if (input.nextPreferredDeliveryAt === undefined) {
    throw new Error('A D+1 assessment requires the next preferred delivery instant.');
  }
  const nextDueAtMs = instantMs(input.nextPreferredDeliveryAt, 'nextPreferredDeliveryAt');
  ensureDueAfter(nextDueAtMs, atMs);
  const nextWindow = classifyRecallWindow(iso(enrolledAtMs), iso(nextDueAtMs));
  const practiceProjection = input.outcome === 'remembered'
    ? KNOWN_PRACTICE
    : SAVED_PRACTICE;

  if (input.outcome !== 'remembered' && nextWindow === 'd1') {
    return {
      snapshot: {
        ...snapshot,
        state: 'd1_retry',
        dueAt: iso(nextDueAtMs),
      },
      practiceProjection,
    };
  }
  if (nextWindow !== 'd7') {
    throw new Error('The next D+1 decision must retry before D+7 or enter D+7.');
  }
  return {
    snapshot: {
      ...snapshot,
      state: 'd7_pending',
      dueAt: iso(nextDueAtMs),
      d1FinalizedIncomplete: input.outcome !== 'remembered',
    },
    practiceProjection,
  };
}

export function rescheduleUnopenedRecall(
  snapshot: RecallScheduleSnapshot,
  input: { at: RecallInstant; nextPreferredDeliveryAt: RecallInstant },
): RecallScheduleDecision {
  const enrolledAtMs = snapshotEnrollmentMs(snapshot);
  const atMs = instantMs(input.at, 'at');
  const window = ensureStateWindow(snapshot.state, enrolledAtMs, atMs);
  ensureEventIsDue(snapshot, atMs);
  if (window !== 'd1') throw new Error('Unopened D+7 delivery closes at the D+7 boundary.');

  const nextDueAtMs = instantMs(input.nextPreferredDeliveryAt, 'nextPreferredDeliveryAt');
  ensureDueAfter(nextDueAtMs, atMs);
  const nextWindow = classifyRecallWindow(iso(enrolledAtMs), iso(nextDueAtMs));
  if (nextWindow === 'd1') {
    return {
      snapshot: {
        ...snapshot,
        state: 'd1_retry',
        dueAt: iso(nextDueAtMs),
      },
      practiceProjection: PRESERVE_PRACTICE,
    };
  }
  if (nextWindow === 'd7') {
    return {
      snapshot: {
        ...snapshot,
        state: 'd7_pending',
        dueAt: iso(nextDueAtMs),
        d1FinalizedIncomplete: true,
      },
      practiceProjection: PRESERVE_PRACTICE,
    };
  }
  throw new Error('An unopened D+1 delivery must retry before D+7 or enter D+7.');
}

export function rollRecallWindow(
  snapshot: RecallScheduleSnapshot,
  input: { at: RecallInstant; nextD7DeliveryAt?: RecallInstant },
): RecallScheduleDecision {
  const enrolledAtMs = snapshotEnrollmentMs(snapshot);
  const atMs = instantMs(input.at, 'at');
  const d7OpensAt = enrolledAtMs + RECALL_D7_OPEN_MS;
  const d7ClosesAt = enrolledAtMs + RECALL_D7_CLOSE_MS;

  if (snapshot.state === 'd1_pending' || snapshot.state === 'd1_retry') {
    if (atMs < d7OpensAt) throw new Error('D+1 cannot roll over before D+7 opens.');
    if (atMs >= d7ClosesAt) {
      if (input.nextD7DeliveryAt !== undefined) {
        throw new Error('D+7 is already closed.');
      }
      return {
        snapshot: {
          ...snapshot,
          state: 'ordinary_practice',
          dueAt: iso(d7ClosesAt),
          d1FinalizedIncomplete: true,
          d7Outcome: 'unassessed',
        },
        practiceProjection: PRESERVE_PRACTICE,
      };
    }
    if (input.nextD7DeliveryAt === undefined) {
      throw new Error('D+1 rollover requires the preferred D+7 delivery instant.');
    }
    const nextD7DueAtMs = instantMs(input.nextD7DeliveryAt, 'nextD7DeliveryAt');
    ensureWindowDue(nextD7DueAtMs, d7OpensAt, d7ClosesAt, 'The D+7 delivery');
    return {
      snapshot: {
        ...snapshot,
        state: 'd7_pending',
        dueAt: iso(nextD7DueAtMs),
        d1FinalizedIncomplete: true,
      },
      practiceProjection: PRESERVE_PRACTICE,
    };
  }

  if (snapshot.state === 'd7_pending' && atMs >= d7ClosesAt) {
    if (input.nextD7DeliveryAt !== undefined) {
      throw new Error('D+7 is already closed.');
    }
    return {
      snapshot: {
        ...snapshot,
        state: 'ordinary_practice',
        dueAt: iso(d7ClosesAt),
        d7Outcome: 'unassessed',
      },
      practiceProjection: PRESERVE_PRACTICE,
    };
  }
  throw new Error(`Recall state ${snapshot.state} cannot roll over at this instant.`);
}

export function requestRecallSnooze(
  snapshot: RecallScheduleSnapshot,
  input: {
    at: RecallInstant;
    alreadySnoozed: boolean;
    nextMilestoneDeliveryAt?: RecallInstant;
  },
): RecallSnoozeDecision {
  const enrolledAtMs = snapshotEnrollmentMs(snapshot);
  const atMs = instantMs(input.at, 'at');
  if ((snapshot.state === 'd1_pending' || snapshot.state === 'd1_retry')
    && atMs >= enrolledAtMs + RECALL_D7_OPEN_MS) {
    const nextDecision = rollRecallWindow(snapshot, {
      at: input.at,
      nextD7DeliveryAt: input.nextMilestoneDeliveryAt,
    });
    return {
      ...nextDecision,
      kind: 'cancelled_for_boundary',
      snoozeConsumed: true,
    };
  }
  if (snapshot.state === 'd7_pending' && atMs >= enrolledAtMs + RECALL_D7_CLOSE_MS) {
    if (input.nextMilestoneDeliveryAt !== undefined) {
      throw new Error('D+7 closes into ordinary Practice without another milestone delivery.');
    }
    const nextDecision = rollRecallWindow(snapshot, { at: input.at });
    return {
      ...nextDecision,
      kind: 'cancelled_for_boundary',
      snoozeConsumed: true,
    };
  }
  if (input.alreadySnoozed) {
    return {
      kind: 'unchanged',
      snoozeConsumed: true,
      snapshot,
      practiceProjection: PRESERVE_PRACTICE,
    };
  }
  const window = ensureStateWindow(snapshot.state, enrolledAtMs, atMs);
  ensureEventIsDue(snapshot, atMs);
  const snoozedAt = atMs + RECALL_SNOOZE_MS;
  const boundaryAt = window === 'd1'
    ? enrolledAtMs + RECALL_D7_OPEN_MS
    : enrolledAtMs + RECALL_D7_CLOSE_MS;

  if (snoozedAt < boundaryAt) {
    return {
      kind: 'scheduled',
      snoozeConsumed: true,
      snapshot: {
        ...snapshot,
        state: window === 'd1' ? 'd1_retry' : 'd7_pending',
        dueAt: iso(snoozedAt),
      },
      practiceProjection: PRESERVE_PRACTICE,
    };
  }

  if (window === 'd1') {
    if (input.nextMilestoneDeliveryAt === undefined) {
      throw new Error('A snooze crossing D+7 requires the preferred D+7 delivery instant.');
    }
    const nextD7DueAtMs = instantMs(input.nextMilestoneDeliveryAt, 'nextMilestoneDeliveryAt');
    ensureWindowDue(
      nextD7DueAtMs,
      enrolledAtMs + RECALL_D7_OPEN_MS,
      enrolledAtMs + RECALL_D7_CLOSE_MS,
      'The D+7 delivery',
    );
    return {
      kind: 'cancelled_for_boundary',
      snoozeConsumed: true,
      snapshot: {
        ...snapshot,
        state: 'd7_pending',
        dueAt: iso(nextD7DueAtMs),
        d1FinalizedIncomplete: true,
      },
      practiceProjection: PRESERVE_PRACTICE,
    };
  }

  if (input.nextMilestoneDeliveryAt !== undefined) {
    throw new Error('D+7 closes into ordinary Practice without another milestone delivery.');
  }
  return {
    kind: 'cancelled_for_boundary',
    snoozeConsumed: true,
    snapshot: {
      ...snapshot,
      state: 'ordinary_practice',
      dueAt: iso(boundaryAt),
      d7Outcome: 'unassessed',
    },
    practiceProjection: PRESERVE_PRACTICE,
  };
}
