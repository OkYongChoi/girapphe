export type PracticeMode = 'new' | 'review';

export type SyncedPracticeAction = 'skip' | 'known' | 'saved';

export type RatedPracticeAction = Exclude<SyncedPracticeAction, 'skip'>;

export type PendingRatedPracticeAdvance = {
  action: RatedPracticeAction;
  replacesRatedAction: boolean;
};

export type PracticeHistoryEntry<Card> = {
  card: Card;
  action: SyncedPracticeAction;
};

export type PracticeHistoryState<Card extends { id: string }> = {
  history: PracticeHistoryEntry<Card>[];
  completedCardActions: number;
};

export type ReviewRoundProgress = {
  reviewed: number;
  completed: boolean;
  resetOnNextAdvance: boolean;
};

export type ReviewRoundAdvance = {
  pool: number;
  action: SyncedPracticeAction;
  replacesRatedAction: boolean;
  cycled: boolean;
};

export type PrerequisiteKnowledgeState = 'explainable' | 'unclear' | 'unseen';

export const PRACTICE_HISTORY_LIMIT = 100;
export const PRACTICE_RETRY_DELAY_MS = 600;

export function resolvePracticeMode(value: string | string[] | undefined): PracticeMode {
  const candidate = typeof value === 'string' ? value : value?.[0];
  return candidate === 'review' ? 'review' : 'new';
}

export function resolvePracticeFocusMode(
  value: string | string[] | undefined,
  currentMode: PracticeMode,
): { mode: PracticeMode; consumeRouteIntent: boolean } {
  if (value === undefined) return { mode: currentMode, consumeRouteIntent: false };
  return { mode: resolvePracticeMode(value), consumeRouteIntent: true };
}

export function reviewQueueCount(stats: { reviewable?: number; unclear: number }): number {
  return typeof stats.reviewable === 'number' && Number.isFinite(stats.reviewable)
    ? Math.max(0, Math.trunc(stats.reviewable))
    : 0;
}

export function createPracticeHistoryState<Card extends { id: string }>(): PracticeHistoryState<Card> {
  return { history: [], completedCardActions: 0 };
}

export function recordCompletedPracticeAction<Card extends { id: string }>(
  state: PracticeHistoryState<Card>,
  card: Card,
  action: SyncedPracticeAction,
): PracticeHistoryState<Card> {
  return {
    history: [...state.history, { card, action }].slice(-PRACTICE_HISTORY_LIMIT),
    completedCardActions: state.completedCardActions + 1,
  };
}

export function reviewedPracticeCardCount<Card extends { id: string }>(
  state: PracticeHistoryState<Card>,
): number {
  return new Set(state.history
    .filter((entry) => entry.action !== 'skip')
    .map((entry) => entry.card.id)).size;
}

export function recoverPreviousPracticeCard<Card extends { id: string }>(state: PracticeHistoryState<Card>): {
  entry: PracticeHistoryEntry<Card> | null;
  state: PracticeHistoryState<Card>;
} {
  const entry = state.history[state.history.length - 1] ?? null;
  if (!entry) return { entry: null, state };
  return {
    entry,
    state: {
      history: state.history.slice(0, -1),
      completedCardActions: state.completedCardActions,
    },
  };
}

export function resolvePreviousPracticeActionAfterAdvance(
  action: SyncedPracticeAction | null,
  advanced: boolean,
): SyncedPracticeAction | null {
  return advanced ? null : action;
}

export function resolvePracticeHistoryActionAfterSkip(
  previousAction: SyncedPracticeAction | null,
): SyncedPracticeAction {
  return previousAction === 'known' || previousAction === 'saved'
    ? previousAction
    : 'skip';
}

export function resolvePendingRatedPracticeAdvance(
  pending: PendingRatedPracticeAdvance | null,
  previousAction: SyncedPracticeAction | null,
  action: RatedPracticeAction,
): PendingRatedPracticeAdvance {
  return {
    action,
    replacesRatedAction: pending
      ? pending.replacesRatedAction
      : previousAction === 'known' || previousAction === 'saved',
  };
}

export function resolvePracticeSkipAdvance(
  pending: PendingRatedPracticeAdvance | null,
  previousAction: SyncedPracticeAction | null,
): Pick<ReviewRoundAdvance, 'action' | 'replacesRatedAction'> {
  if (pending) return pending;
  const action = resolvePracticeHistoryActionAfterSkip(previousAction);
  return {
    action,
    replacesRatedAction: action !== 'skip',
  };
}

export function createReviewRoundProgress(): ReviewRoundProgress {
  return { reviewed: 0, completed: false, resetOnNextAdvance: false };
}

export function recordReviewRoundAdvance(
  state: ReviewRoundProgress,
  advance: ReviewRoundAdvance,
): ReviewRoundProgress {
  const pool = Number.isFinite(advance.pool) ? Math.max(0, Math.trunc(advance.pool)) : 0;
  const reviewedBeforeAction = state.resetOnNextAdvance ? 0 : state.reviewed;
  const reviewed = advance.action !== 'skip' && !advance.replacesRatedAction
    ? Math.min(pool, reviewedBeforeAction + 1)
    : Math.min(pool, reviewedBeforeAction);
  return {
    reviewed,
    completed: advance.cycled && pool > 0,
    resetOnNextAdvance: advance.cycled,
  };
}

export async function loadPracticeWithRetry<T>(
  load: () => Promise<T>,
  wait: (delayMs: number) => Promise<void> = (delayMs) => new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  }),
  shouldRetry: (error: unknown) => boolean = () => true,
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (!shouldRetry(error)) throw error;
    await wait(PRACTICE_RETRY_DELAY_MS);
    return load();
  }
}

export function prerequisiteKnowledgeState(
  status: 'known' | 'saved' | null,
): PrerequisiteKnowledgeState {
  if (status === 'known') return 'explainable';
  if (status === 'saved') return 'unclear';
  return 'unseen';
}

export function formatReviewLastSeen(
  lastSeen: string | null | undefined,
  formatDate: (value: Date) => string,
): string | null {
  if (!lastSeen) return null;
  const date = new Date(lastSeen);
  if (!Number.isFinite(date.getTime())) return null;
  return formatDate(date);
}
