export type PracticeMode = 'new' | 'review';

export type SyncedPracticeAction = 'skip' | 'known' | 'saved';

export type PracticeHistoryEntry<Card> = {
  card: Card;
  action: SyncedPracticeAction;
};

export type PracticeHistoryState<Card> = {
  history: PracticeHistoryEntry<Card>[];
  completedCardActions: number;
};

export type PrerequisiteKnowledgeState = 'explainable' | 'unclear' | 'unseen';

export const PRACTICE_HISTORY_LIMIT = 100;
export const PRACTICE_SEEN_LIMIT = 100;

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

export function appendPracticeSeenCard(seen: readonly string[], cardId: string): string[] {
  return [...seen.filter((seenCardId) => seenCardId !== cardId), cardId]
    .slice(-PRACTICE_SEEN_LIMIT);
}

export function reviewQueueCount(stats: { reviewable?: number; unclear: number }): number {
  return typeof stats.reviewable === 'number' && Number.isFinite(stats.reviewable)
    ? Math.max(0, Math.trunc(stats.reviewable))
    : 0;
}

export function createPracticeHistoryState<Card>(): PracticeHistoryState<Card> {
  return { history: [], completedCardActions: 0 };
}

export function recordCompletedPracticeAction<Card>(
  state: PracticeHistoryState<Card>,
  card: Card,
  action: SyncedPracticeAction,
): PracticeHistoryState<Card> {
  return {
    history: [...state.history, { card, action }].slice(-PRACTICE_HISTORY_LIMIT),
    completedCardActions: state.completedCardActions + 1,
  };
}

export function recoverPreviousPracticeCard<Card>(state: PracticeHistoryState<Card>): {
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
