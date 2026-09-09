export type PracticeMode = 'new' | 'review';

export type SyncedPracticeAction = 'skip' | 'known' | 'saved';

export type PracticeHistoryEntry<Card> = {
  card: Card;
  action: SyncedPracticeAction;
};

export type PracticeHistoryState<Card extends { id: string }> = {
  history: PracticeHistoryEntry<Card>[];
  completedCardActions: number;
  ratedCardActionCounts: ReadonlyMap<string, number>;
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
  return { history: [], completedCardActions: 0, ratedCardActionCounts: new Map() };
}

export function recordCompletedPracticeAction<Card extends { id: string }>(
  state: PracticeHistoryState<Card>,
  card: Card,
  action: SyncedPracticeAction,
): PracticeHistoryState<Card> {
  const ratedCardActionCounts = new Map(state.ratedCardActionCounts);
  if (action !== 'skip') {
    ratedCardActionCounts.set(card.id, (ratedCardActionCounts.get(card.id) ?? 0) + 1);
  }
  return {
    history: [...state.history, { card, action }].slice(-PRACTICE_HISTORY_LIMIT),
    completedCardActions: state.completedCardActions + 1,
    ratedCardActionCounts,
  };
}

export function reviewedPracticeCardCount<Card extends { id: string }>(
  state: PracticeHistoryState<Card>,
): number {
  return state.ratedCardActionCounts.size;
}

export function recoverPreviousPracticeCard<Card extends { id: string }>(state: PracticeHistoryState<Card>): {
  entry: PracticeHistoryEntry<Card> | null;
  state: PracticeHistoryState<Card>;
} {
  const entry = state.history[state.history.length - 1] ?? null;
  if (!entry) return { entry: null, state };
  const ratedCardActionCounts = new Map(state.ratedCardActionCounts);
  if (entry.action !== 'skip') {
    const remaining = (ratedCardActionCounts.get(entry.card.id) ?? 1) - 1;
    if (remaining > 0) ratedCardActionCounts.set(entry.card.id, remaining);
    else ratedCardActionCounts.delete(entry.card.id);
  }
  return {
    entry,
    state: {
      history: state.history.slice(0, -1),
      completedCardActions: state.completedCardActions,
      ratedCardActionCounts,
    },
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
