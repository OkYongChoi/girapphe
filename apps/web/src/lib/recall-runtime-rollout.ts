import 'server-only';

type RecallRuntimeRolloutEnvironment = {
  NODE_ENV?: string;
  RECALL_RUNTIME_ROLLOUT?: string;
  RECALL_RUNTIME_USER_IDS?: string;
};

export type RecallRuntimeRolloutMode = 'off' | 'allowlist' | 'all';

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
  if (!userId) return false;
  const mode = recallRuntimeRolloutMode(environment);
  if (mode === 'all') return true;
  if (mode === 'off') return false;

  const allowed = (environment.RECALL_RUNTIME_USER_IDS ?? '')
    .trim()
    .split(/[\s,]+/, 500)
    .filter(Boolean);
  return allowed.includes(userId);
}
