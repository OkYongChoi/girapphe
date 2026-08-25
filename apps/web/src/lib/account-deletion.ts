import 'server-only';

import { clerkClient } from '@clerk/nextjs/server';
import db from '@/lib/db';
import { cancelStripeSubscriptionsForAccountDeletion } from '@/lib/billing/stripe';
import { cancelTossBilling } from '@/lib/billing/toss-subscriptions';
import { isTossBillingConfigured } from '@/lib/billing/toss';
import { deleteRevenueCatCustomer } from '@/lib/billing/revenuecat';

export class AccountDeletionError extends Error {
  constructor(message: string, readonly code: 'ADMIN_ACCOUNT' | 'BILLING_CANCELLATION' | 'DATABASE_REQUIRED') {
    super(message);
    this.name = 'AccountDeletionError';
  }
}

async function hasTossBillingRecords(userId: string) {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM toss_billing_agreements WHERE user_id = $1
       UNION ALL
       SELECT 1 FROM toss_billing_sessions WHERE user_id = $1
     ) AS exists`,
    [userId],
  );
  return result.rows[0]?.exists === true;
}

async function cancelRenewingWebBilling(userId: string) {
  try {
    const stripeCanceled = await cancelStripeSubscriptionsForAccountDeletion(userId);
    let tossCanceled = 0;
    if (await hasTossBillingRecords(userId)) {
      if (!isTossBillingConfigured()) {
        throw new Error('Toss billing cleanup is not configured.');
      }
      const result = await cancelTossBilling(userId);
      if (result.pending > 0) throw new Error('A Toss charge is still being reconciled.');
      tossCanceled = result.canceled;
    }
    return { stripeCanceled, tossCanceled };
  } catch (cause) {
    console.error('Unable to cancel renewing web billing before account deletion:', cause);
    throw new AccountDeletionError(
      'Renewing web billing could not be canceled safely. Try again or use the support page.',
      'BILLING_CANCELLATION',
    );
  }
}

async function deleteProcessorCustomerData(userId: string) {
  try {
    return await deleteRevenueCatCustomer(userId);
  } catch (cause) {
    console.error('Unable to delete RevenueCat customer data:', cause);
    throw new AccountDeletionError(
      'Mobile purchase profile data could not be deleted safely. Try again or use the support page.',
      'BILLING_CANCELLATION',
    );
  }
}

async function purgePrivateProductData(userId: string) {
  await db.query(
    `WITH
       deleted_sources AS (
         DELETE FROM knowledge_card_sources WHERE user_id = $1 RETURNING id
       ),
       deleted_graph_edges AS (
         DELETE FROM user_graph_edges WHERE user_id = $1 RETURNING id
       ),
       deleted_private_states AS (
         DELETE FROM user_private_card_states WHERE user_id = $1 RETURNING knowledge_item_id
       ),
       deleted_graph_nodes AS (
         DELETE FROM user_graph_nodes
         WHERE user_id = $1
           AND (SELECT COUNT(*) FROM deleted_graph_edges) >= 0
         RETURNING id
       ),
       deleted_items AS (
         DELETE FROM user_knowledge_items
         WHERE user_id = $1
           AND (SELECT COUNT(*) FROM deleted_sources) >= 0
           AND (SELECT COUNT(*) FROM deleted_private_states) >= 0
           AND (SELECT COUNT(*) FROM deleted_graph_nodes) >= 0
         RETURNING id
       ),
       deleted_drafts AS (
         DELETE FROM knowledge_card_drafts
         WHERE user_id = $1
           AND (SELECT COUNT(*) FROM deleted_sources) >= 0
         RETURNING id
       ),
       deleted_batches AS (
         DELETE FROM knowledge_ingestion_batches
         WHERE user_id = $1
           AND (SELECT COUNT(*) FROM deleted_drafts) >= 0
         RETURNING id
       ),
       deleted_tokens AS (
         DELETE FROM mcp_access_tokens WHERE user_id = $1 RETURNING id
       ),
       deleted_evidence AS (
         DELETE FROM user_knowledge_evidence WHERE user_id = $1 RETURNING id
       ),
       deleted_knowledge_states AS (
         DELETE FROM user_knowledge_states WHERE user_id = $1 RETURNING node_id
       ),
       deleted_quiz_limits AS (
         DELETE FROM user_quiz_rate_limits WHERE user_id = $1 RETURNING user_id
       ),
       deleted_card_states AS (
         DELETE FROM user_card_states WHERE user_id = $1 RETURNING card_id
       ),
       deleted_toss_limits AS (
         DELETE FROM toss_prepare_rate_limits WHERE user_id = $1 RETURNING user_id
       )
     SELECT
       (SELECT COUNT(*) FROM deleted_items) AS deleted_items,
       (SELECT COUNT(*) FROM deleted_batches) AS deleted_batches,
       (SELECT COUNT(*) FROM deleted_tokens) AS deleted_tokens,
       (SELECT COUNT(*) FROM deleted_evidence) AS deleted_evidence,
       (SELECT COUNT(*) FROM deleted_knowledge_states) AS deleted_knowledge_states,
       (SELECT COUNT(*) FROM deleted_quiz_limits) AS deleted_quiz_limits,
       (SELECT COUNT(*) FROM deleted_card_states) AS deleted_card_states,
       (SELECT COUNT(*) FROM deleted_toss_limits) AS deleted_toss_limits`,
    [userId],
  );
}

export async function deleteGirappheAccount(userId: string) {
  if (!process.env.DATABASE_URL) {
    throw new AccountDeletionError('The account database is unavailable.', 'DATABASE_REQUIRED');
  }
  if (process.env.ADMIN_CLERK_USER_ID === userId) {
    throw new AccountDeletionError('The configured administrator account cannot be self-deleted.', 'ADMIN_ACCOUNT');
  }

  const billing = await cancelRenewingWebBilling(userId);
  const revenueCatDeleted = await deleteProcessorCustomerData(userId);
  await purgePrivateProductData(userId);
  const client = await clerkClient();
  await client.users.deleteUser(userId);
  return { ...billing, revenueCatDeleted };
}
