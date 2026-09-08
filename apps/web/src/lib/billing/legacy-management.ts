import type { CanonicalSubscription } from '@stem-brain/shared';

const TERMINAL_TOSS_STATUSES = new Set<CanonicalSubscription['status']>([
  'canceled',
  'expired',
  'refunded',
  'revoked',
]);

export function findActionableTossSubscription(
  subscriptions: readonly CanonicalSubscription[],
): CanonicalSubscription | null {
  return subscriptions.find((subscription) => (
    subscription.provider === 'toss'
    && !subscription.cancelAtPeriodEnd
    && subscription.autoRenew !== false
    && !TERMINAL_TOSS_STATUSES.has(subscription.status)
  )) ?? null;
}
