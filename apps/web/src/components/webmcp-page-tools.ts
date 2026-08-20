export type PendingReviewSummary = {
  id: string;
};

export type PracticeMode = 'new' | 'review';

export function selectPendingReview(
  batches: readonly PendingReviewSummary[],
  requestedBatchId?: string,
): PendingReviewSummary | undefined {
  if (!requestedBatchId) return batches[0];
  return batches.find((batch) => batch.id === requestedBatchId);
}

export function resolvePracticeMode(
  requestedMode: unknown,
): PracticeMode | null {
  if (requestedMode === 'new' || requestedMode === 'review') return requestedMode;
  return null;
}
