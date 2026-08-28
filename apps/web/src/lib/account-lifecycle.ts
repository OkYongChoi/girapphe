import 'server-only';

import { createHash } from 'node:crypto';

// These values predate the generic account-lifecycle name. Keep them stable:
// deployed deletion markers and mixed-version advisory locks depend on the
// exact hash domain and lock prefix.
export const ACCOUNT_LIFECYCLE_DOMAIN = 'girapphe:mcp-account-lifecycle:v1';
export const ACCOUNT_LIFECYCLE_LOCK_PREFIX = 'mcp-account-lifecycle';
const ACCOUNT_BILLING_OPERATION_DOMAIN = 'girapphe:account-billing-operation:v1';

export type AccountBillingOperationProvider = 'stripe' | 'toss';

export function deriveDeletedAccountScopeKey(userId: string): string {
  return createHash('sha256')
    .update(`${ACCOUNT_LIFECYCLE_DOMAIN}\0${userId}`, 'utf8')
    .digest('hex');
}

export function deriveAccountAdvisoryLockKey(userId: string): string {
  return `${ACCOUNT_LIFECYCLE_LOCK_PREFIX}:${deriveDeletedAccountScopeKey(userId)}`;
}

export function deriveAccountBillingOperationEventId(
  userId: string,
  provider: AccountBillingOperationProvider,
): string {
  const fingerprint = createHash('sha256')
    .update(`${ACCOUNT_BILLING_OPERATION_DOMAIN}\0${provider}\0${userId}`, 'utf8')
    .digest('hex');
  return `account-billing:${fingerprint}`;
}

export type AccountLifecycleQuery = { text: string; params: unknown[] };

export function buildAccountDeletionFenceQueries(userId: string): AccountLifecycleQuery[] {
  return [
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [deriveAccountAdvisoryLockKey(userId)],
    },
    {
      text: `INSERT INTO mcp_deleted_account_markers (scope_key, deleted_at)
             SELECT $1, NOW()
             WHERE NOT EXISTS (
               SELECT 1
               FROM billing_webhook_events
               WHERE processed_at IS NULL
                 AND created_at >= NOW() - INTERVAL '10 minutes'
                 AND (
                   (provider = 'stripe' AND event_id = $2)
                   OR (provider = 'toss' AND event_id = $3)
                 )
             )
             ON CONFLICT (scope_key) DO UPDATE SET
               deleted_at = mcp_deleted_account_markers.deleted_at
             RETURNING scope_key`,
      params: [
        deriveDeletedAccountScopeKey(userId),
        deriveAccountBillingOperationEventId(userId, 'stripe'),
        deriveAccountBillingOperationEventId(userId, 'toss'),
      ],
    },
  ];
}

/**
 * The assertion deliberately attempts to duplicate an existing marker. If the
 * account was deleted, PostgreSQL aborts the whole transaction before any
 * product write can run. It is a separate Read Committed statement after the
 * advisory lock, so a writer that waited for deletion sees the committed marker.
 */
export function buildActiveAccountGuardQueries(userId: string): AccountLifecycleQuery[] {
  return [
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [deriveAccountAdvisoryLockKey(userId)],
    },
    {
      text: `INSERT INTO mcp_deleted_account_markers (scope_key, deleted_at)
             SELECT scope_key, deleted_at
             FROM mcp_deleted_account_markers
             WHERE scope_key = $1`,
      params: [deriveDeletedAccountScopeKey(userId)],
    },
  ];
}
