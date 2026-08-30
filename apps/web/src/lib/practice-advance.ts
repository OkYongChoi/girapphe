type SaveResult = { success: boolean };

type PracticeAdvanceOptions<TCard, TStats> = {
  save: () => Promise<SaveResult>;
  loadNext: (excludeIds?: string[]) => Promise<TCard | null>;
  loadStats: () => Promise<TStats>;
  excludeIds: string[];
  retryDelayMs?: number;
  wait?: (delayMs: number) => Promise<void>;
};

export type PracticeAdvanceFlowResult<TCard, TStats> =
  | { success: false }
  | {
      success: true;
      nextCard: TCard | null;
      stats: TStats;
      cycled: boolean;
    };

const defaultWait = (delayMs: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, delayMs);
});

/**
 * Keep the client interaction to one server action: persist the rating first,
 * then load the next card and aggregate stats concurrently. A missing card for
 * the current exclusion set starts a new round without another client trip.
 */
export async function runPracticeAdvance<TCard, TStats>({
  save,
  loadNext,
  loadStats,
  excludeIds,
  retryDelayMs = 600,
  wait = defaultWait,
}: PracticeAdvanceOptions<TCard, TStats>): Promise<PracticeAdvanceFlowResult<TCard, TStats>> {
  const saveResult = await save();
  if (!saveResult.success) return { success: false };

  const advance = async () => {
    const nextCard = await loadNext(excludeIds);
    if (nextCard) return { nextCard, cycled: false };
    return { nextCard: await loadNext(undefined), cycled: true };
  };

  const advanceWithRetry = async () => {
    try {
      return await advance();
    } catch {
      await wait(retryDelayMs);
      return advance();
    }
  };

  const [next, stats] = await Promise.all([
    advanceWithRetry(),
    loadStats(),
  ]);

  return { success: true, ...next, stats };
}
