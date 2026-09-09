export type CandidateInboxRequestGuard = Readonly<{
  begin: () => number;
  isLatest: (request: number) => boolean;
}>;

export function createCandidateInboxRequestGuard(): CandidateInboxRequestGuard {
  let latestRequest = 0;

  return {
    begin() {
      latestRequest += 1;
      return latestRequest;
    },
    isLatest(request) {
      return request === latestRequest;
    },
  };
}

export function addPendingCandidate(
  pendingCandidates: ReadonlySet<string>,
  candidateId: string,
): ReadonlySet<string> {
  const next = new Set(pendingCandidates);
  next.add(candidateId);
  return next;
}

export function removePendingCandidate(
  pendingCandidates: ReadonlySet<string>,
  candidateId: string,
): ReadonlySet<string> {
  const next = new Set(pendingCandidates);
  next.delete(candidateId);
  return next;
}

export function selectCandidateBatch<T extends { id: string }>(
  batches: readonly T[],
  preferredBatchId: string | null,
): T | null {
  return (preferredBatchId
    ? batches.find((batch) => batch.id === preferredBatchId)
    : undefined) ?? batches[0] ?? null;
}

export type CandidateBatchScopeKind = 'current_conversation' | 'selected_export' | 'unsupported';

export function classifyCandidateBatchScope(scope: unknown): CandidateBatchScopeKind {
  if (scope === 'current_conversation' || scope === 'selected_export') {
    return scope;
  }
  return 'unsupported';
}

export function buildCandidateWebReviewUrl(
  appBaseUrl: string | undefined,
  batchId: string,
  draftId: string,
): string | null {
  if (!appBaseUrl || !batchId || !draftId) return null;
  try {
    const base = new URL(appBaseUrl);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) return null;
    return new URL(
      `/knowledge-inbox/${encodeURIComponent(batchId)}/${encodeURIComponent(draftId)}/resolve`,
      base,
    ).toString();
  } catch {
    return null;
  }
}
