import {
  MAX_MOBILE_PRACTICE_BODY_BYTES,
  type MobilePracticeMode,
  type MobilePracticeStats,
} from '@stem-brain/shared';
import { readBoundedJson } from '@/lib/billing/bounded-json';
import {
  loadMobilePracticeRound,
  parseMobilePracticeRequest,
} from '@/lib/mobile-practice-contract';
import {
  decodeMobilePracticeCursor,
  encodeMobilePracticeCursor,
  type MobilePracticeCursorState,
} from '@/lib/mobile-practice-cursor';

export type MobilePracticePostDependencies<Card, CompatibleCard> = {
  loadCard: (
    mode: MobilePracticeMode,
    cursor: MobilePracticeCursorState | null,
  ) => Promise<{ card: Card | null; nextCursor: MobilePracticeCursorState }>;
  loadStats: () => Promise<MobilePracticeStats>;
  mapCard: (card: Card) => CompatibleCard;
};

function json(body: unknown, status: number, privateResponse = false): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (privateResponse) headers.set('Cache-Control', 'private, no-store');
  return new Response(JSON.stringify(body), { headers, status });
}

/**
 * Handle the authenticated Practice POST body. Authentication and locale
 * parsing remain route concerns, so an unauthorized request never reaches this
 * body reader.
 */
export async function handleMobilePracticePost<Card, CompatibleCard>(
  request: Request,
  dependencies: MobilePracticePostDependencies<Card, CompatibleCard>,
): Promise<Response> {
  const parsedBody = await readBoundedJson(request, MAX_MOBILE_PRACTICE_BODY_BYTES);
  if (!parsedBody.ok) {
    return json(
      {
        error: parsedBody.reason === 'too_large'
          ? 'The practice request is too large.'
          : 'A valid Practice JSON object is required.',
        code: parsedBody.reason === 'too_large'
          ? 'PRACTICE_REQUEST_TOO_LARGE'
          : 'INVALID_PRACTICE_REQUEST',
      },
      parsedBody.reason === 'too_large' ? 413 : 400,
    );
  }

  const input = parseMobilePracticeRequest(parsedBody.value);
  if (!input) {
    return json(
      {
        error: 'A valid bounded Practice request is required.',
        code: 'INVALID_PRACTICE_REQUEST',
      },
      400,
    );
  }

  const decodedCursor = input.cursor === null
    ? { ok: true as const, state: null }
    : decodeMobilePracticeCursor(input.cursor, input.mode);
  if (!decodedCursor.ok) {
    return json(
      {
        error: 'The Practice cursor is invalid for this mode.',
        code: 'INVALID_PRACTICE_CURSOR',
      },
      400,
    );
  }

  const [next, stats] = await Promise.all([
    loadMobilePracticeRound(
      (cursor) => dependencies.loadCard(input.mode, cursor),
      decodedCursor.state,
      input.cycleOnEmpty,
    ),
    dependencies.loadStats(),
  ]);

  return json({
    card: next.card ? dependencies.mapCard(next.card) : null,
    stats,
    nextCursor: next.nextCursor ? encodeMobilePracticeCursor(next.nextCursor) : null,
    cycled: next.cycled,
  }, 200, true);
}
