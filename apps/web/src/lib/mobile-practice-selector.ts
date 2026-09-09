import type { MobilePracticeMode } from '@stem-brain/shared';
import {
  createMobilePracticeCursorState,
  type MobilePracticeCursorState,
  type MobilePracticeLane,
} from '@/lib/mobile-practice-cursor';

export type MobilePracticeCursorDependencies<Card> = {
  mode: MobilePracticeMode;
  cursor: MobilePracticeCursorState | null;
  getCardId: (card: Card) => string;
  loadNextPublic: (afterCardId: string | null) => Promise<Card | null>;
  loadNextPrivate: (afterCardId: string | null) => Promise<Card | null>;
};

/**
 * Alternate deterministic public/private keyset lanes without materializing
 * either pool. Exhausted lanes are remembered in the opaque cursor.
 */
export async function loadMobilePracticeCardAfterCursor<Card>({
  mode,
  cursor,
  getCardId,
  loadNextPublic,
  loadNextPrivate,
}: MobilePracticeCursorDependencies<Card>): Promise<{
  card: Card | null;
  nextCursor: MobilePracticeCursorState;
}> {
  const state = cursor
    ? { ...cursor }
    : createMobilePracticeCursorState(mode);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (state.publicDone && state.privateDone) break;
    let source: MobilePracticeLane = state.nextSource;
    if (source === 'public' && state.publicDone) source = 'private';
    if (source === 'private' && state.privateDone) source = 'public';

    const card = source === 'public'
      ? await loadNextPublic(state.publicAfter)
      : await loadNextPrivate(state.privateAfter);
    if (card) {
      const cardId = getCardId(card);
      if (cardId.length === 0) throw new TypeError('Practice card id cannot be empty.');
      if (source === 'public') state.publicAfter = cardId;
      else state.privateAfter = cardId;
      state.nextSource = source === 'public' ? 'private' : 'public';
      return { card, nextCursor: state };
    }

    if (source === 'public') state.publicDone = true;
    else state.privateDone = true;
    state.nextSource = source === 'public' ? 'private' : 'public';
  }

  return { card: null, nextCursor: state };
}
