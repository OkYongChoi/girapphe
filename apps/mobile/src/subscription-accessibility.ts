import type { Locale } from '@stem-brain/shared';

export function duplicateSubscriptionAnnouncementKey(
  userId: string | null,
  locale: Locale,
  duplicateDetected: boolean,
): string | null {
  if (!userId || !duplicateDetected) return null;
  return `${userId}\u0000${locale}`;
}

export function advanceDuplicateSubscriptionAnnouncement(
  previousKey: string | null,
  nextKey: string | null,
): { key: string | null; shouldAnnounce: boolean } {
  return {
    key: nextKey,
    shouldAnnounce: nextKey !== null && nextKey !== previousKey,
  };
}
