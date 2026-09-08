import 'server-only';

type RolloutEnvironment = {
  NODE_ENV?: string;
  AI_THINKING_HISTORY_ROLLOUT?: string;
  AI_THINKING_HISTORY_USER_IDS?: string;
};

export function isAiThinkingHistoryEnabledForUser(
  userId: string,
  environment: RolloutEnvironment = process.env,
) {
  const configured = environment.AI_THINKING_HISTORY_ROLLOUT?.trim().toLowerCase();
  const mode = configured === 'off' || configured === 'allowlist' || configured === 'all'
    ? configured
    : environment.NODE_ENV === 'production' ? 'off' : 'all';
  const allowed = (environment.AI_THINKING_HISTORY_USER_IDS ?? '').trim().split(/[\s,]+/, 500);
  return !!userId && (mode === 'all' || (mode === 'allowlist' && allowed.includes(userId)));
}
