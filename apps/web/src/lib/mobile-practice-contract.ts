import {
  MAX_MOBILE_PRACTICE_CARD_ID_LENGTH,
  MAX_MOBILE_PRACTICE_CURSOR_LENGTH,
  type MobilePracticeRequest,
} from '@stem-brain/shared';

export const MAX_LEGACY_MOBILE_PRACTICE_EXCLUDE_IDS = 100;

export function parseMobilePracticeRequest(value: unknown): MobilePracticeRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const allowedKeys = new Set(['mode', 'cursor', 'cycleOnEmpty']);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) return null;
  if (input.mode !== 'new' && input.mode !== 'review') return null;
  if (input.cycleOnEmpty !== undefined && typeof input.cycleOnEmpty !== 'boolean') return null;

  const cursor = input.cursor ?? null;
  if (
    cursor !== null
    && (
      typeof cursor !== 'string'
      || cursor.length < 1
      || cursor.length > MAX_MOBILE_PRACTICE_CURSOR_LENGTH
    )
  ) {
    return null;
  }

  return {
    mode: input.mode,
    cursor,
    cycleOnEmpty: input.cycleOnEmpty === true,
  };
}

export function parseLegacyMobilePracticeExcludeIds(values: string[]):
  | { ok: true; excludeIds: string[] }
  | { ok: false; reason: 'too_many' | 'invalid' } {
  if (values.length > MAX_LEGACY_MOBILE_PRACTICE_EXCLUDE_IDS) {
    return { ok: false, reason: 'too_many' };
  }
  const excludeIds: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (value.length < 1 || value.length > MAX_MOBILE_PRACTICE_CARD_ID_LENGTH) {
      return { ok: false, reason: 'invalid' };
    }
    if (!seen.has(value)) {
      seen.add(value);
      excludeIds.push(value);
    }
  }
  return { ok: true, excludeIds };
}

export async function loadMobilePracticeRound<Card, Cursor>(
  loadNext: (cursor: Cursor | null) => Promise<{
    card: Card | null;
    nextCursor: Cursor | null;
  }>,
  cursor: Cursor | null,
  cycleOnEmpty: boolean,
): Promise<{ card: Card | null; nextCursor: Cursor | null; cycled: boolean }> {
  const result = await loadNext(cursor);
  if (result.card || !cycleOnEmpty || cursor === null) {
    return { ...result, cycled: false };
  }
  return {
    ...await loadNext(null),
    cycled: true,
  };
}
