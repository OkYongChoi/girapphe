export type PracticeMode = 'new' | 'review';
export type PracticeCardStatus = 'known' | 'saved' | null;

export function getMockCardStatus(index: number): PracticeCardStatus {
  if (index % 7 === 0 || index % 11 === 0) return 'known';
  if (index % 5 === 0 || index % 13 === 0) return 'saved';
  return null;
}

export function getMockPracticeStats(cardCount: number): {
  explainable: number;
  unclear: number;
} {
  let explainable = 0;
  let unclear = 0;

  for (let index = 0; index < cardCount; index += 1) {
    const status = getMockCardStatus(index);
    if (status === 'known') explainable += 1;
    if (status === 'saved') unclear += 1;
  }

  return { explainable, unclear };
}

export function isCardEligibleForPracticeMode(
  status: PracticeCardStatus,
  mode: PracticeMode
): boolean {
  return mode === 'new' ? status === null : status === 'saved';
}

/**
 * Private Recall rows share Practice's due queue. A due private `known` row is
 * reviewable, but broadening the generic status rule would make public and
 * guest `known` cards reappear in review sessions.
 */
export function isCardEligibleForPracticeSelection(
  status: PracticeCardStatus,
  mode: PracticeMode,
  context: {
    isPrivateCard: boolean;
    progressState?: 'new' | 'learning' | 'review' | null;
    dueAt?: Date | string | null;
    now?: Date | string;
  },
): boolean {
  if (isCardEligibleForPracticeMode(status, mode)) return true;
  if (
    mode !== 'review'
    || !context.isPrivateCard
    || status !== 'known'
    || context.progressState !== 'review'
    || !context.dueAt
  ) {
    return false;
  }
  const dueAt = new Date(context.dueAt).getTime();
  const now = new Date(context.now ?? new Date()).getTime();
  return Number.isFinite(dueAt) && Number.isFinite(now) && dueAt <= now;
}
