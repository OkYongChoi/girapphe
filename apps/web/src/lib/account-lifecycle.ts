import 'server-only';

import { createHash } from 'node:crypto';

// These values predate the generic account-lifecycle name. Keep them stable:
// deployed deletion markers and mixed-version advisory locks depend on the
// exact hash domain and lock prefix.
export const ACCOUNT_LIFECYCLE_DOMAIN = 'girapphe:mcp-account-lifecycle:v1';
export const ACCOUNT_LIFECYCLE_LOCK_PREFIX = 'mcp-account-lifecycle';
const ACCOUNT_BILLING_OPERATION_DOMAIN = 'girapphe:account-billing-operation:v2';

// Stripe and Toss are transitional lifecycle-only providers. Keeping them in
// the account-wide lease domain lets cancellation/renewal finish safely while
// their acquisition routes remain absent.
export type AccountBillingOperationProvider = 'creem' | 'superwall' | 'stripe' | 'toss';

export function deriveDeletedAccountScopeKey(userId: string): string {
  return createHash('sha256')
    .update(`${ACCOUNT_LIFECYCLE_DOMAIN}\0${userId}`, 'utf8')
    .digest('hex');
}

export function deriveAccountAdvisoryLockKey(userId: string): string {
  return `${ACCOUNT_LIFECYCLE_LOCK_PREFIX}:${deriveDeletedAccountScopeKey(userId)}`;
}

export function deriveMcpTokenCreationRateScopeKey(userId: string): string {
  return `token-creation:${deriveDeletedAccountScopeKey(userId)}`;
}

export function deriveAccountBillingOperationScopeKey(userId: string): string {
  const fingerprint = createHash('sha256')
    .update(`${ACCOUNT_BILLING_OPERATION_DOMAIN}\0${userId}`, 'utf8')
    .digest('hex');
  return fingerprint;
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
               FROM billing_account_operations
               WHERE scope_key = $2
                 AND expires_at > NOW()
             )
             AND NOT EXISTS (
               SELECT 1
               FROM billing_acquisition_blocks
               WHERE user_id = $3
                 AND reason = 'mobile_purchase_pending'
                 AND resolved_at IS NULL
             )
             ON CONFLICT (scope_key) DO UPDATE SET
               deleted_at = mcp_deleted_account_markers.deleted_at
             RETURNING scope_key`,
      params: [
        deriveDeletedAccountScopeKey(userId),
        deriveAccountBillingOperationScopeKey(userId),
        userId,
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
