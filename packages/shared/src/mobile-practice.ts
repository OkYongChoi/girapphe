export const MAX_MOBILE_PRACTICE_BODY_BYTES = 2_048;
export const MAX_MOBILE_PRACTICE_CARD_ID_LENGTH = 160;
export const MAX_MOBILE_PRACTICE_CURSOR_LENGTH = 1_024;

export function mergePracticeRoundExclusions(
  groups: ReadonlyArray<readonly string[]>,
): string[] {
  const exclusions = new Set<string>();
  for (const group of groups) {
    for (const cardId of group) exclusions.add(cardId);
  }
  return [...exclusions];
}

export type MobilePracticeMode = 'new' | 'review';

export type MobilePracticeRequest = {
  mode: MobilePracticeMode;
  cursor: string | null;
  cycleOnEmpty: boolean;
};

export type MobilePracticeStats = {
  explainable: number;
  unclear: number;
  reviewable?: number;
};

export type MobilePracticeResponse<Card> = {
  card: Card | null;
  stats: MobilePracticeStats;
  nextCursor: string | null;
  cycled: boolean;
};
