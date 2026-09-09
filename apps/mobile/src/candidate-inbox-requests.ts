export type CandidateInboxRequestGuard = Readonly<{
  begin: () => number;
  isLatest: (request: number) => boolean;
}>;

export type CandidateQuickAction = 'approve-candidate' | 'ignore-candidate';

export type CandidateQuickActionDraft = {
  id: string;
  requires_detailed_review: boolean;
};

export type CandidateQuickActionOutcome<Result, Draft> =
  | { status: 'detailed-review-required' }
  | { status: 'resolved'; result: Result }
  | {
    status: 'stale';
    latestDraft: Draft | null;
    reloadSucceeded: boolean;
  };

export function candidateQuickActionRequiresDetailedReview(
  draft: CandidateQuickActionDraft,
  action: CandidateQuickAction,
): boolean {
  return action === 'approve-candidate' && draft.requires_detailed_review;
}

export async function resolveCandidateQuickAction<
  Result,
  Draft extends CandidateQuickActionDraft,
>({
  draft,
  action,
  mutate,
  reloadLatest,
  isStaleError,
}: {
  draft: Draft;
  action: CandidateQuickAction;
  mutate: () => Promise<Result>;
  reloadLatest: () => Promise<readonly Draft[] | null>;
  isStaleError: (reason: unknown) => boolean;
}): Promise<CandidateQuickActionOutcome<Result, Draft>> {
  if (candidateQuickActionRequiresDetailedReview(draft, action)) {
    return { status: 'detailed-review-required' };
  }

  try {
    return { status: 'resolved', result: await mutate() };
  } catch (reason) {
    if (!isStaleError(reason)) throw reason;
    const latestDrafts = await reloadLatest();
    return {
      status: 'stale',
      latestDraft: latestDrafts?.find((candidate) => candidate.id === draft.id) ?? null,
      reloadSucceeded: latestDrafts !== null,
    };
  }
}

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
