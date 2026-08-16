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
