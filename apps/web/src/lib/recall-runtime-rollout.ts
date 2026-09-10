import 'server-only';

type RecallRuntimeRolloutEnvironment = {
  NODE_ENV?: string;
  RECALL_RUNTIME_ROLLOUT?: string;
  RECALL_RUNTIME_USER_IDS?: string;
};

export type RecallRuntimeRolloutMode = 'off' | 'allowlist' | 'all';

export type RecallRuntimeEnrollmentDecision = {
  mode: RecallRuntimeRolloutMode;
  enabled: boolean;
  exactSingleAllowedOwner: boolean;
  distinctCandidateDenied: boolean;
};

const DISTINCT_CANDIDATE_PROBE = '__girapphe_recall_rollout_nonmember_probe__';

function recallRuntimeAllowedUserIds(
  environment: RecallRuntimeRolloutEnvironment,
): string[] {
  return (environment.RECALL_RUNTIME_USER_IDS ?? '')
    .trim()
    .split(/[\s,]+/, 500)
    .filter(Boolean);
}

function isEnrollmentEnabled(
  userId: string,
  mode: RecallRuntimeRolloutMode,
  allowedUserIds: readonly string[],
): boolean {
  if (!userId) return false;
  if (mode === 'all') return true;
  if (mode === 'off') return false;
  return allowedUserIds.includes(userId);
}

export function recallRuntimeRolloutMode(
  environment: RecallRuntimeRolloutEnvironment = process.env,
): RecallRuntimeRolloutMode {
  const configured = environment.RECALL_RUNTIME_ROLLOUT?.trim().toLowerCase();
  if (configured === 'off' || configured === 'allowlist' || configured === 'all') {
    return configured;
  }
  return environment.NODE_ENV === 'production' ? 'off' : 'all';
}

export function isRecallRuntimeEnrollmentEnabledForUser(
  userId: string,
  environment: RecallRuntimeRolloutEnvironment = process.env,
): boolean {
  return recallRuntimeEnrollmentDecision(userId, environment).enabled;
}

export function recallRuntimeEnrollmentDecision(
  userId: string,
  environment: RecallRuntimeRolloutEnvironment = process.env,
): RecallRuntimeEnrollmentDecision {
  const mode = recallRuntimeRolloutMode(environment);
  const allowedUserIds = recallRuntimeAllowedUserIds(environment);
  const distinctCandidate = userId === DISTINCT_CANDIDATE_PROBE
    ? `${DISTINCT_CANDIDATE_PROBE}_alternate`
    : DISTINCT_CANDIDATE_PROBE;
  return {
    mode,
    enabled: isEnrollmentEnabled(userId, mode, allowedUserIds),
    exactSingleAllowedOwner: Boolean(userId)
      && mode === 'allowlist'
      && allowedUserIds.length === 1
      && allowedUserIds[0] === userId,
    distinctCandidateDenied: !isEnrollmentEnabled(distinctCandidate, mode, allowedUserIds),
  };
}
