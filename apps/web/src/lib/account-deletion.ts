import 'server-only';

import { clerkClient } from '@clerk/nextjs/server';
import db from '@/lib/db';
import { buildAccountDeletionFenceQueries } from '@/lib/account-lifecycle';
import { buildPrivateProductPurgeQuery } from '@/lib/account-private-purge';
import {
  abandonAcquisitionAttemptsForDeletion,
  getProviderCustomerId,
  getProviderSubscriptionIdsForUser,
  getUnresolvedCheckoutAttempt,
} from '@/lib/billing/database';
import { cancelCreemRenewalForAccountDeletion } from '@/lib/billing/creem';
import {
  deleteRevenueCatCustomer,
  shouldAttemptRevenueCatCustomerDeletion,
} from '@/lib/billing/revenuecat';
import { cancelStripeSubscriptionsForAccountDeletion } from '@/lib/billing/stripe';
import { cancelTossBilling } from '@/lib/billing/toss-subscriptions';
import { isTossBillingConfigured } from '@/lib/billing/toss';

export class AccountDeletionError extends Error {
  constructor(
    message: string,
    readonly code: 'ADMIN_ACCOUNT' | 'BILLING_CANCELLATION' | 'DATABASE_REQUIRED',
  ) {
    super(message);
    this.name = 'AccountDeletionError';
  }
}

async function beginAccountDeletionFence(userId: string) {
  const results = await db.transaction<{ scope_key: string }>(
    buildAccountDeletionFenceQueries(userId),
    { isolationLevel: 'ReadCommitted' },
  );

  if (!results[1]?.rows[0]) {
    throw new AccountDeletionError(
      'A billing operation is still in progress. Try account deletion again shortly.',
      'BILLING_CANCELLATION',
    );
  }
}

async function cancelRenewingWebBilling(userId: string) {
  try {
    const [creemSubscriptionIds, unresolved, creemCustomerId] = await Promise.all([
      getProviderSubscriptionIdsForUser(userId, 'creem'),
      getUnresolvedCheckoutAttempt(userId),
      getProviderCustomerId(userId, 'creem'),
    ]);
    const creemCanceled = creemSubscriptionIds.length > 0
      || creemCustomerId !== null
      || unresolved?.provider === 'creem'
      ? await cancelCreemRenewalForAccountDeletion(userId)
      : 0;
    const stripeCanceled = await cancelStripeSubscriptionsForAccountDeletion(userId);
    let tossCanceled = 0;
    const tossRecords = await db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM toss_billing_agreements WHERE user_id = $1
         UNION ALL
         SELECT 1 FROM toss_billing_sessions WHERE user_id = $1
       ) AS exists`,
      [userId],
    );
    if (tossRecords.rows[0]?.exists === true) {
      if (!isTossBillingConfigured()) throw new Error('Toss billing cleanup is not configured.');
      const result = await cancelTossBilling(userId);
      if (result.pending > 0) throw new Error('A Toss charge is still being reconciled.');
      tossCanceled = result.canceled;
    }
    await abandonAcquisitionAttemptsForDeletion(userId);
    return { creemCanceled, stripeCanceled, tossCanceled };
  } catch (cause) {
    console.error('Unable to cancel renewing web billing before account deletion:', cause);
    throw new AccountDeletionError(
      'Renewing web billing could not be canceled safely. Try again or use the support page.',
      'BILLING_CANCELLATION',
    );
  }
}

async function deleteLegacyRevenueCatProfile(userId: string): Promise<boolean | null> {
  const subscriptionIds = await getProviderSubscriptionIdsForUser(userId, 'revenuecat');
  if (!shouldAttemptRevenueCatCustomerDeletion(subscriptionIds.length > 0)) return null;
  try {
    return await deleteRevenueCatCustomer(userId);
  } catch (cause) {
    console.error('Unable to delete legacy RevenueCat customer data:', cause);
    throw new AccountDeletionError(
      'Legacy mobile purchase profile data could not be deleted safely. Try again or use the support page.',
      'BILLING_CANCELLATION',
    );
  }
}

async function purgePrivateProductDataForUser(userId: string) {
  await db.transaction(
    [buildPrivateProductPurgeQuery(userId)],
    { isolationLevel: 'ReadCommitted' },
  );
}

export async function deleteGirappheAccount(userId: string) {
  if (!process.env.DATABASE_URL) {
    throw new AccountDeletionError('The account database is unavailable.', 'DATABASE_REQUIRED');
  }
  if (process.env.ADMIN_CLERK_USER_ID === userId) {
    throw new AccountDeletionError('The configured administrator account cannot be self-deleted.', 'ADMIN_ACCOUNT');
  }

  await beginAccountDeletionFence(userId);
  const billing = await cancelRenewingWebBilling(userId);
  const revenueCatDeleted = await deleteLegacyRevenueCatProfile(userId);
  await purgePrivateProductDataForUser(userId);
  const client = await clerkClient();
  await client.users.deleteUser(userId);
  return { ...billing, revenueCatDeleted, superwallDeviceResetRequired: true };
}
