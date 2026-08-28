import db from '@/lib/db';
import {
  claimAccountBillingOperation,
  releaseAccountBillingOperation,
  type AccountBillingOperationLease,
} from './database';
import {
  addTossBillingPeriod,
  chargeTossBillingKey,
  createTossCheckoutState,
  createTossOrderId,
  decryptTossBillingKey,
  deleteTossBillingKey,
  encryptTossBillingKey,
  findTossPaymentByOrderId,
  getTossPlanAmount,
  getTossBillingConfig,
  issueTossBillingKey,
  sha256Fingerprint,
  TossBillingError,
  TossProviderRequestError,
  verifyTossPayment,
  type TossBillingPlan,
} from './toss';

type BillingCustomerRow = {
  toss_customer_key: string;
  trial_consumed_at: string | null;
};

type TossAgreementRow = {
  id: string;
  user_id: string;
  customer_key: string;
  billing_key_ciphertext: string;
  plan: TossBillingPlan;
  status: string;
  current_period_end: string | null;
  next_charge_at: string;
  retry_count: number;
  processing_token: string;
};

type ExistingTossAgreementRow = {
  status: string;
  plan: TossBillingPlan;
  current_period_start: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

type TossChargeRow = {
  order_id: string;
  agreement_id: string;
  user_id: string;
  cycle_key: string;
  plan: TossBillingPlan;
  amount_krw: number;
  period_start: string;
  period_end: string;
  status: 'pending' | 'paid' | 'applied' | 'canceled' | 'abandoned';
  payment_key: string | null;
  attempt_count: number;
  updated_at?: string;
};

type TossActivationClaimRow = {
  claimed: boolean;
  cross_provider_blocked: boolean;
};

type TossBillingKeyIntentRow = {
  id: string;
  agreement_id: string;
  user_id: string;
  customer_key: string;
  plan: TossBillingPlan;
  provider_idempotency_key: string | null;
  auth_key_ciphertext: string | null;
  billing_key_ciphertext: string | null;
  billing_key_fingerprint: string | null;
  status: 'issuing' | 'cleanup_pending' | 'live' | 'cleaned' | 'manual_review';
  processing_token?: string | null;
};

type TossAgreementCredentialRow = {
  billing_key_ciphertext: string;
  billing_key_intent_id: string | null;
  billing_key_fingerprint: string | null;
  customer_key: string;
  plan: TossBillingPlan;
};

export type TossBillingActivation = {
  status: 'trialing' | 'active';
  currentPeriodEnd: string;
};

export type TossBillingSession = {
  plan: TossBillingPlan;
  tokenHash: string;
};

function isPlan(value: string): value is TossBillingPlan {
  return value === 'monthly' || value === 'annual';
}

function addTrialPeriod(date: Date) {
  return new Date(date.getTime() + 14 * 86_400_000);
}

function retryAt(date: Date) {
  return new Date(date.getTime() + 86_400_000);
}

async function claimTossAccountOperation(
  userId: string,
  operation: 'prepare' | 'activation' | 'renewal',
) {
  const lease = await claimAccountBillingOperation(userId, 'toss', operation);
  if (!lease) {
    throw new TossBillingError(
      'Another Toss billing operation is already in progress.',
      'TOSS_OPERATION_IN_PROGRESS',
    );
  }
  return lease;
}

function shouldRetainTossOperationLease(error: unknown) {
  return error instanceof TossProviderRequestError
    && error.outcome === 'indeterminate';
}

async function releaseTossAccountOperation(lease: AccountBillingOperationLease) {
  await releaseAccountBillingOperation(lease).catch(() => undefined);
}

function activeActivation(row: ExistingTossAgreementRow | undefined, now: Date): TossBillingActivation | null {
  if (!row?.current_period_end) return null;
  const periodEnd = new Date(row.current_period_end);
  if (!Number.isFinite(periodEnd.getTime()) || periodEnd <= now) return null;
  if (row.status === 'trialing') {
    return { status: 'trialing', currentPeriodEnd: periodEnd.toISOString() };
  }
  // A canceled subscription retains its already-paid entitlement until the
  // period end. Treating it as active here prevents a callback retry from
  // charging the same user again during that period.
  if (row.status === 'active' || row.status === 'canceled') {
    return { status: 'active', currentPeriodEnd: periodEnd.toISOString() };
  }
  return null;
}

async function readExistingActivation(agreementId: string, userId: string, now: Date) {
  const result = await db.query<ExistingTossAgreementRow>(
    `SELECT status, plan, current_period_start::text, current_period_end::text,
       cancel_at_period_end
     FROM toss_billing_agreements
     WHERE id = $1 AND user_id = $2`,
    [agreementId, userId]
  );
  const row = result.rows[0];
  const activation = activeActivation(row, now);
  if (!row || !activation?.currentPeriodEnd) return activation;

  // Repair a partial DB write from the provider callback before returning a
  // previously-created period. This is idempotent and never calls Toss.
  await upsertTossSubscription({
    agreementId,
    userId,
    plan: row.plan,
    status: activation.status,
    currentPeriodStart: new Date(row.current_period_start),
    currentPeriodEnd: new Date(activation.currentPeriodEnd),
    trialEnd: activation.status === 'trialing' ? new Date(activation.currentPeriodEnd) : null,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  });
  return activation;
}

async function hasCrossProviderBlockingSubscription(userId: string) {
  const result = await db.query<{ blocked: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM billing_subscriptions
       WHERE user_id = $1
         AND provider <> 'toss'
         AND entitlement = 'ad_free'
         AND status IN ('incomplete', 'past_due', 'paused', 'trialing', 'active')
         AND (
           status NOT IN ('trialing', 'active')
           OR COALESCE(current_period_end, trial_end) > NOW()
         )
     ) AS blocked`,
    [userId]
  );
  return result.rows[0]?.blocked === true;
}

function tossLifecycleErrorCode(error: unknown, fallback: string) {
  return error instanceof TossBillingError ? error.code.slice(0, 80) : fallback;
}

async function ensureAgreementBillingKeyIntent(agreementId: string, userId: string) {
  const current = await db.query<TossAgreementCredentialRow>(
    `SELECT a.billing_key_ciphertext, a.billing_key_intent_id,
       i.billing_key_fingerprint, c.toss_customer_key AS customer_key, a.plan
     FROM toss_billing_agreements a
     JOIN billing_customers c ON c.user_id = a.user_id
     LEFT JOIN toss_billing_key_intents i ON i.id = a.billing_key_intent_id
     WHERE a.id = $1 AND a.user_id = $2`,
    [agreementId, userId]
  );
  const credential = current.rows[0];
  if (!credential) return;

  const billingKey = await decryptTossBillingKey(credential.billing_key_ciphertext);
  const fingerprint = await sha256Fingerprint(billingKey);
  if (credential.billing_key_intent_id) {
    await db.query(
      `UPDATE toss_billing_key_intents SET
         billing_key_fingerprint = COALESCE(billing_key_fingerprint, $3),
         updated_at = NOW()
       WHERE id = $1 AND agreement_id = $2
         AND billing_key_ciphertext = $4`,
      [
        credential.billing_key_intent_id,
        agreementId,
        fingerprint,
        credential.billing_key_ciphertext,
      ]
    );
    return;
  }

  // This covers agreements created by the previous application version during
  // the migration/deploy window. The key is copied, never moved or exposed.
  const legacyFingerprint = await sha256Fingerprint(
    `${agreementId}:${credential.billing_key_ciphertext}`
  );
  const legacyIntentId = `toss_legacy_${legacyFingerprint.slice(0, 48)}`;
  await db.query(
    `INSERT INTO toss_billing_key_intents (
       id, agreement_id, user_id, customer_key, plan,
       billing_key_ciphertext, billing_key_fingerprint, status,
       created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'live', NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       billing_key_fingerprint = COALESCE(
         toss_billing_key_intents.billing_key_fingerprint,
         EXCLUDED.billing_key_fingerprint
       ),
       updated_at = NOW()
     WHERE toss_billing_key_intents.agreement_id = EXCLUDED.agreement_id
       AND toss_billing_key_intents.user_id = EXCLUDED.user_id
       AND toss_billing_key_intents.billing_key_ciphertext = EXCLUDED.billing_key_ciphertext`,
    [
      legacyIntentId,
      agreementId,
      userId,
      credential.customer_key,
      credential.plan,
      credential.billing_key_ciphertext,
      fingerprint,
    ]
  );
  await db.query(
    `UPDATE toss_billing_agreements SET billing_key_intent_id = $3, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND billing_key_intent_id IS NULL
       AND billing_key_ciphertext = $4`,
    [agreementId, userId, legacyIntentId, credential.billing_key_ciphertext]
  );
}

async function createTossBillingKeyIntent(input: {
  id: string;
  agreementId: string;
  userId: string;
  customerKey: string;
  plan: TossBillingPlan;
  checkoutTokenHash: string;
  providerIdempotencyKey: string;
  encryptedAuthKey: string;
}) {
  const created = await db.query<TossBillingKeyIntentRow>(
     `WITH checkout_session AS (
       SELECT token_hash FROM toss_billing_sessions
       WHERE token_hash = $6 AND user_id = $3 AND customer_key = $4
         AND plan = $5 AND status = 'processing'
       FOR UPDATE
     )
     INSERT INTO toss_billing_key_intents (
       id, agreement_id, user_id, customer_key, plan,
       provider_idempotency_key, auth_key_ciphertext, status,
       created_at, updated_at
     )
     SELECT $1, $2, $3, $4, $5, $7, $8, 'issuing', NOW(), NOW()
     FROM checkout_session
     ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
     WHERE toss_billing_key_intents.agreement_id = EXCLUDED.agreement_id
       AND toss_billing_key_intents.user_id = EXCLUDED.user_id
       AND toss_billing_key_intents.customer_key = EXCLUDED.customer_key
       AND toss_billing_key_intents.plan = EXCLUDED.plan
       AND toss_billing_key_intents.provider_idempotency_key = EXCLUDED.provider_idempotency_key
       AND toss_billing_key_intents.status <> 'cleaned'
     RETURNING id, agreement_id, user_id, customer_key, plan,
       provider_idempotency_key, auth_key_ciphertext, billing_key_ciphertext,
       billing_key_fingerprint, status, processing_token`,
    [
      input.id,
      input.agreementId,
      input.userId,
      input.customerKey,
      input.plan,
      input.checkoutTokenHash,
      input.providerIdempotencyKey,
      input.encryptedAuthKey,
    ]
  );
  const intent = created.rows[0];
  if (!intent) {
    throw new TossBillingError(
      'Toss billing authorization is invalid, expired, or already retired.',
      'TOSS_BILLING_KEY_INTENT_INVALID'
    );
  }
  return intent;
}

async function readTossBillingKeyIntent(intentId: string) {
  const result = await db.query<TossBillingKeyIntentRow>(
    `SELECT id, agreement_id, user_id, customer_key, plan,
       provider_idempotency_key, auth_key_ciphertext, billing_key_ciphertext,
       billing_key_fingerprint, status, processing_token
     FROM toss_billing_key_intents WHERE id = $1`,
    [intentId]
  );
  return result.rows[0] ?? null;
}

async function materializeTossBillingKeyIntent(
  intent: TossBillingKeyIntentRow,
  expectedProcessingToken: string | null = null,
) {
  if (
    (intent.status === 'cleanup_pending' || intent.status === 'live')
    && intent.billing_key_ciphertext
    && intent.billing_key_fingerprint
  ) {
    return {
      billingKey: await decryptTossBillingKey(intent.billing_key_ciphertext),
      encryptedBillingKey: intent.billing_key_ciphertext,
      fingerprint: intent.billing_key_fingerprint,
    };
  }
  if (
    intent.status !== 'issuing'
    || !intent.auth_key_ciphertext
    || !intent.provider_idempotency_key
  ) {
    throw new TossBillingError('Toss billing key intent cannot be issued.', 'TOSS_BILLING_KEY_INTENT_INVALID');
  }

  let billingKey: string;
  try {
    const authKey = await decryptTossBillingKey(intent.auth_key_ciphertext);
    billingKey = await issueTossBillingKey(
      authKey,
      intent.customer_key,
      intent.provider_idempotency_key,
    );
  } catch (error) {
    await db.query(
      `UPDATE toss_billing_key_intents SET
         issue_attempt_count = issue_attempt_count + 1,
         last_error_code = $2,
         processing_started_at = NULL,
         processing_token = NULL,
         updated_at = NOW()
       WHERE id = $1 AND status = 'issuing'
         AND ($3::text IS NULL OR processing_token = $3)`,
      [intent.id, tossLifecycleErrorCode(error, 'TOSS_BILLING_KEY_ISSUE_ERROR'), expectedProcessingToken]
    ).catch(() => undefined);
    throw error;
  }

  const encryptedBillingKey = await encryptTossBillingKey(billingKey);
  const fingerprint = await sha256Fingerprint(billingKey);
  const stored = await db.query<TossBillingKeyIntentRow>(
    `UPDATE toss_billing_key_intents SET
       auth_key_ciphertext = NULL,
       billing_key_ciphertext = $2,
       billing_key_fingerprint = $3,
       status = 'cleanup_pending',
       issue_attempt_count = issue_attempt_count + 1,
       last_error_code = NULL,
       processing_started_at = NULL,
       processing_token = NULL,
       updated_at = NOW()
     WHERE id = $1 AND status = 'issuing'
       AND ($4::text IS NULL OR processing_token = $4)
     RETURNING id, agreement_id, user_id, customer_key, plan,
       provider_idempotency_key, auth_key_ciphertext, billing_key_ciphertext,
       billing_key_fingerprint, status, processing_token`,
    [intent.id, encryptedBillingKey, fingerprint, expectedProcessingToken]
  );
  if (stored.rows[0]) return { billingKey, encryptedBillingKey, fingerprint };

  // A concurrent callback or the recovery worker may have persisted the same
  // idempotent provider response. Reuse it instead of deleting either copy.
  const raced = await readTossBillingKeyIntent(intent.id);
  if (
    raced?.billing_key_ciphertext
    && raced.billing_key_fingerprint === fingerprint
    && (raced.status === 'cleanup_pending' || raced.status === 'live')
  ) {
    return {
      billingKey,
      encryptedBillingKey: raced.billing_key_ciphertext,
      fingerprint,
    };
  }
  throw new TossBillingError(
    'The durable Toss billing key intent changed during issuance.',
    'TOSS_BILLING_KEY_INTENT_RACE'
  );
}

async function markTossBillingKeyIntentLive(intentId: string, agreementId: string) {
  await db.query(
    `UPDATE toss_billing_key_intents i SET
       status = 'live', auth_key_ciphertext = NULL,
       processing_started_at = NULL, processing_token = NULL,
       last_error_code = NULL, updated_at = NOW()
     FROM toss_billing_agreements a
     WHERE i.id = $1 AND i.agreement_id = $2
       AND a.id = $2 AND a.billing_key_intent_id = i.id`,
    [intentId, agreementId]
  );
}

async function normalizeTossBillingKeyIntents(limit: number) {
  // A referenced key is authoritative. Any unreferenced row with the same
  // fingerprint is only another durable record of that key and must be retired
  // without calling the provider DELETE endpoint.
  const duplicate = await db.query<{ id: string }>(
    `WITH duplicate_candidates AS (
       SELECT old.id
       FROM toss_billing_key_intents old
       WHERE old.status = 'cleanup_pending'
         AND old.billing_key_fingerprint IS NOT NULL
         AND (old.processing_started_at IS NULL
           OR old.processing_started_at < NOW() - INTERVAL '10 minutes')
         AND NOT EXISTS (
           SELECT 1 FROM toss_billing_agreements referenced
           WHERE referenced.billing_key_intent_id = old.id
         )
         AND EXISTS (
           SELECT 1
           FROM toss_billing_agreements a
           JOIN toss_billing_key_intents current
             ON current.id = a.billing_key_intent_id
           WHERE current.billing_key_fingerprint = old.billing_key_fingerprint
         )
       ORDER BY old.updated_at
       LIMIT $1
       FOR UPDATE OF old SKIP LOCKED
     )
     UPDATE toss_billing_key_intents old SET
       status = 'cleaned', auth_key_ciphertext = NULL,
       billing_key_ciphertext = NULL, cleaned_at = NOW(),
       processing_started_at = NULL, processing_token = NULL,
       last_error_code = NULL, updated_at = NOW()
     FROM duplicate_candidates
     WHERE old.id = duplicate_candidates.id
     RETURNING old.id`,
    [limit]
  );

  const referenced = await db.query<{ id: string }>(
    `WITH referenced_candidates AS (
       SELECT i.id
       FROM toss_billing_key_intents i
       JOIN toss_billing_agreements a ON a.billing_key_intent_id = i.id
       WHERE i.status = 'cleanup_pending'
         AND (i.processing_started_at IS NULL
           OR i.processing_started_at < NOW() - INTERVAL '10 minutes')
       ORDER BY i.updated_at
       LIMIT $1
       FOR UPDATE OF i SKIP LOCKED
     )
     UPDATE toss_billing_key_intents i SET
       status = 'live', auth_key_ciphertext = NULL,
       processing_started_at = NULL, processing_token = NULL,
       last_error_code = NULL, updated_at = NOW()
     FROM referenced_candidates
     WHERE i.id = referenced_candidates.id
     RETURNING i.id`,
    [limit]
  );

  return duplicate.rows.length + referenced.rows.length;
}

async function quarantineExpiredIssuingTossBillingKeyIntents(limit: number) {
  // Toss guarantees an Idempotency-Key result for 15 days. Stop one day early
  // so an uncertain issuance is never repeated after that provider guarantee
  // can expire. The one-time auth material is scrubbed and the retained
  // idempotency key is sufficient for a provider-support/manual audit.
  const quarantined = await db.query<{ id: string }>(
    `WITH expired AS (
       SELECT id FROM toss_billing_key_intents
       WHERE status = 'issuing'
         AND created_at < NOW() - INTERVAL '14 days'
         AND (processing_started_at IS NULL
           OR processing_started_at < NOW() - INTERVAL '10 minutes')
       ORDER BY created_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE toss_billing_key_intents i SET
       status = 'manual_review', auth_key_ciphertext = NULL,
       processing_started_at = NULL, processing_token = NULL,
       last_error_code = 'TOSS_BILLING_KEY_IDEMPOTENCY_EXPIRED',
       updated_at = NOW()
     FROM expired
     WHERE i.id = expired.id AND i.status = 'issuing'
     RETURNING i.id`,
    [limit]
  );
  return quarantined.rows.length;
}

async function recoverIssuingTossBillingKeyIntents(limit: number) {
  const processingToken = crypto.randomUUID();
  const claimed = await db.query<TossBillingKeyIntentRow>(
    `WITH candidates AS (
       SELECT id FROM toss_billing_key_intents
       WHERE status = 'issuing'
         AND created_at >= NOW() - INTERVAL '14 days'
         AND updated_at < NOW() - INTERVAL '1 minute'
         AND (processing_started_at IS NULL
           OR processing_started_at < NOW() - INTERVAL '10 minutes')
       ORDER BY updated_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE toss_billing_key_intents i SET
       processing_started_at = NOW(), processing_token = $2, updated_at = NOW()
     FROM candidates
     WHERE i.id = candidates.id AND i.status = 'issuing'
       AND (i.processing_started_at IS NULL
         OR i.processing_started_at < NOW() - INTERVAL '10 minutes')
     RETURNING i.id, i.agreement_id, i.user_id, i.customer_key, i.plan,
       i.provider_idempotency_key, i.auth_key_ciphertext,
       i.billing_key_ciphertext, i.billing_key_fingerprint, i.status,
       i.processing_token`,
    [limit, processingToken]
  );

  let recovered = 0;
  let failed = 0;
  for (const intent of claimed.rows) {
    try {
      await materializeTossBillingKeyIntent(intent, processingToken);
      recovered += 1;
    } catch (error) {
      failed += 1;
      // Provider errors are already recorded by materialize. This conditional
      // release also covers encryption or DB response failures; if the prior
      // write actually committed, status is no longer issuing and is untouched.
      await db.query(
        `UPDATE toss_billing_key_intents SET
           issue_attempt_count = issue_attempt_count + 1,
           last_error_code = $3,
           processing_started_at = NULL, processing_token = NULL,
           updated_at = NOW()
         WHERE id = $1 AND status = 'issuing' AND processing_token = $2`,
        [intent.id, processingToken, tossLifecycleErrorCode(error, 'TOSS_BILLING_KEY_RECOVERY_ERROR')]
      ).catch(() => undefined);
    }
  }
  return { recovered, failed };
}

async function cleanupOrphanedTossBillingKeyIntents(limit: number) {
  const processingToken = crypto.randomUUID();
  const claimed = await db.query<TossBillingKeyIntentRow>(
    `WITH candidates AS (
       SELECT i.id
       FROM toss_billing_key_intents i
       WHERE i.status = 'cleanup_pending'
         AND i.billing_key_ciphertext IS NOT NULL
         AND i.billing_key_fingerprint IS NOT NULL
         AND i.updated_at < NOW() - INTERVAL '5 minutes'
         AND (i.processing_started_at IS NULL
           OR i.processing_started_at < NOW() - INTERVAL '10 minutes')
         AND NOT EXISTS (
           SELECT 1 FROM toss_billing_agreements a
           WHERE a.billing_key_intent_id = i.id
         )
         AND NOT EXISTS (
           SELECT 1
           FROM toss_billing_agreements a
           JOIN toss_billing_key_intents current
             ON current.id = a.billing_key_intent_id
           WHERE current.billing_key_fingerprint = i.billing_key_fingerprint
         )
         AND NOT EXISTS (
           SELECT 1
           FROM toss_billing_agreements a
           JOIN toss_billing_key_intents current
             ON current.id = a.billing_key_intent_id
           WHERE a.id = i.agreement_id
             AND current.billing_key_fingerprint IS NULL
         )
       ORDER BY i.updated_at
       LIMIT $1
       FOR UPDATE OF i SKIP LOCKED
     )
     UPDATE toss_billing_key_intents i SET
       processing_started_at = NOW(), processing_token = $2, updated_at = NOW()
     FROM candidates
     WHERE i.id = candidates.id AND i.status = 'cleanup_pending'
       AND (i.processing_started_at IS NULL
         OR i.processing_started_at < NOW() - INTERVAL '10 minutes')
     RETURNING i.id, i.agreement_id, i.user_id, i.customer_key, i.plan,
       i.provider_idempotency_key, i.auth_key_ciphertext,
       i.billing_key_ciphertext, i.billing_key_fingerprint, i.status,
       i.processing_token`,
    [limit, processingToken]
  );

  let cleaned = 0;
  let failed = 0;
  for (const intent of claimed.rows) {
    try {
      // Recheck from a fresh DB snapshot after the claim commits and before the
      // irreversible provider call. Activation honors the processing lease, so
      // a passing row cannot become live until this attempt releases it.
      const authorized = await db.query<{ billing_key_ciphertext: string }>(
        `SELECT i.billing_key_ciphertext
         FROM toss_billing_key_intents i
         WHERE i.id = $1 AND i.status = 'cleanup_pending'
           AND i.processing_token = $2
           AND i.billing_key_ciphertext = $3
           AND i.billing_key_fingerprint IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM toss_billing_agreements a
             WHERE a.billing_key_intent_id = i.id
           )
           AND NOT EXISTS (
             SELECT 1
             FROM toss_billing_agreements a
             JOIN toss_billing_key_intents current
               ON current.id = a.billing_key_intent_id
             WHERE current.billing_key_fingerprint = i.billing_key_fingerprint
           )
           AND NOT EXISTS (
             SELECT 1
             FROM toss_billing_agreements a
             JOIN toss_billing_key_intents current
               ON current.id = a.billing_key_intent_id
             WHERE a.id = i.agreement_id
               AND current.billing_key_fingerprint IS NULL
           )`,
        [intent.id, processingToken, intent.billing_key_ciphertext]
      );
      const encryptedBillingKey = authorized.rows[0]?.billing_key_ciphertext;
      if (!encryptedBillingKey) {
        await db.query(
          `UPDATE toss_billing_key_intents SET
             processing_started_at = NULL, processing_token = NULL,
             updated_at = NOW()
           WHERE id = $1 AND status = 'cleanup_pending'
             AND processing_token = $2`,
          [intent.id, processingToken]
        );
        continue;
      }
      if (!intent.billing_key_ciphertext) {
        throw new TossBillingError(
          'Toss billing key cleanup intent has no credential.',
          'TOSS_BILLING_KEY_INTENT_INVALID'
        );
      }
      const billingKey = await decryptTossBillingKey(encryptedBillingKey);
      try {
        await deleteTossBillingKey(billingKey);
      } catch (error) {
        if (!(error instanceof TossBillingError)
          || !['HTTP_404', 'NOT_FOUND_BILLING_KEY'].includes(error.code)) {
          throw error;
        }
      }
      const completed = await db.query<{ id: string }>(
        `UPDATE toss_billing_key_intents i SET
           status = 'cleaned', auth_key_ciphertext = NULL,
           billing_key_ciphertext = NULL,
           cleanup_attempt_count = cleanup_attempt_count + 1,
           processing_started_at = NULL, processing_token = NULL,
           last_error_code = NULL, cleaned_at = NOW(), updated_at = NOW()
         WHERE i.id = $1 AND i.status = 'cleanup_pending'
           AND i.processing_token = $2
           AND i.billing_key_ciphertext = $3
           AND NOT EXISTS (
             SELECT 1 FROM toss_billing_agreements a
             WHERE a.billing_key_intent_id = i.id
           )
           AND NOT EXISTS (
             SELECT 1
             FROM toss_billing_agreements a
             JOIN toss_billing_key_intents current
               ON current.id = a.billing_key_intent_id
             WHERE current.billing_key_fingerprint = i.billing_key_fingerprint
           )
           AND NOT EXISTS (
             SELECT 1
             FROM toss_billing_agreements a
             JOIN toss_billing_key_intents current
               ON current.id = a.billing_key_intent_id
             WHERE a.id = i.agreement_id
               AND current.billing_key_fingerprint IS NULL
           )
         RETURNING i.id`,
        [intent.id, processingToken, encryptedBillingKey]
      );
      cleaned += completed.rows.length;
    } catch (error) {
      failed += 1;
      await db.query(
        `UPDATE toss_billing_key_intents SET
           cleanup_attempt_count = cleanup_attempt_count + 1,
           last_error_code = $3,
           processing_started_at = NULL, processing_token = NULL,
           updated_at = NOW()
         WHERE id = $1 AND status = 'cleanup_pending'
           AND processing_token = $2`,
        [intent.id, processingToken, tossLifecycleErrorCode(error, 'TOSS_BILLING_KEY_CLEANUP_ERROR')]
      ).catch(() => undefined);
    }
  }
  return { cleaned, failed };
}

export async function processTossBillingKeyIntents(limit = 5) {
  getTossBillingConfig();
  const boundedLimit = Math.max(1, Math.min(limit, 10));
  const normalized = await normalizeTossBillingKeyIntents(boundedLimit);
  const quarantined = await quarantineExpiredIssuingTossBillingKeyIntents(boundedLimit);
  const recovery = await recoverIssuingTossBillingKeyIntents(boundedLimit);
  // Freshly recovered keys keep a five-minute adoption window before cleanup.
  const cleanup = await cleanupOrphanedTossBillingKeyIntents(boundedLimit);
  return {
    normalized,
    quarantined,
    recovered: recovery.recovered,
    cleaned: cleanup.cleaned,
    failed: recovery.failed + cleanup.failed,
  };
}

async function claimTossActivation(input: {
  agreementId: string;
  userId: string;
  customerKey: string;
  billingKeyIntentId: string;
  encryptedBillingKey: string;
  billingKeyFingerprint: string;
  plan: TossBillingPlan;
  now: Date;
  processingToken: string;
  checkoutTokenHash: string;
}): Promise<TossBillingActivation | null> {
  const inserted = await db.query<TossActivationClaimRow>(
     `WITH checkout_session AS (
       SELECT token_hash FROM toss_billing_sessions
       WHERE token_hash = $7 AND user_id = $2 AND customer_key = $10
         AND plan = $4 AND status = 'processing'
       FOR UPDATE
     ), candidate_intent AS MATERIALIZED (
       SELECT candidate.id FROM toss_billing_key_intents candidate
       WHERE candidate.id = $8 AND candidate.agreement_id = $1 AND candidate.user_id = $2
         AND candidate.customer_key = $10 AND candidate.plan = $4
         AND candidate.billing_key_ciphertext = $3
         AND candidate.billing_key_fingerprint = $9
         AND candidate.status IN ('cleanup_pending', 'live')
         AND (candidate.processing_started_at IS NULL
           OR candidate.processing_started_at < NOW() - INTERVAL '10 minutes')
         AND NOT EXISTS (
           SELECT 1 FROM toss_billing_key_intents sibling
           WHERE sibling.id <> candidate.id
             AND sibling.agreement_id = candidate.agreement_id
             AND sibling.billing_key_fingerprint = candidate.billing_key_fingerprint
             AND (
               sibling.status = 'cleaned'
               OR (sibling.status = 'cleanup_pending'
                 AND sibling.processing_started_at >= NOW() - INTERVAL '10 minutes')
             )
         )
       FOR UPDATE
     ), cross_provider_blocking AS (
       SELECT 1 FROM billing_subscriptions
       WHERE user_id = $2
         AND provider <> 'toss'
         AND entitlement = 'ad_free'
         AND status IN ('incomplete', 'past_due', 'paused', 'trialing', 'active')
         AND (
           status NOT IN ('trialing', 'active')
           OR COALESCE(current_period_end, trial_end) > NOW()
         )
       LIMIT 1
     ), inserted AS (
       INSERT INTO toss_billing_agreements (
         id, user_id, billing_key_ciphertext, billing_key_intent_id,
         plan, status, current_period_start,
         current_period_end, next_charge_at, retry_count, processing_started_at,
         processing_token, cancel_at_period_end, updated_at
       )
       SELECT $1, $2, $3, $8, $4, 'incomplete', $5, $5, NULL, 0, NOW(), $6, FALSE, NOW()
       FROM checkout_session, candidate_intent
       WHERE NOT EXISTS (SELECT 1 FROM cross_provider_blocking)
       ON CONFLICT DO NOTHING
       RETURNING id, billing_key_intent_id
     ), activated_intent AS (
       UPDATE toss_billing_key_intents i SET
         status = 'live', auth_key_ciphertext = NULL,
         processing_started_at = NULL, processing_token = NULL,
         last_error_code = NULL, updated_at = NOW()
       FROM inserted
       WHERE i.id = inserted.billing_key_intent_id
         AND i.agreement_id = inserted.id
         AND i.status IN ('cleanup_pending', 'live')
       RETURNING i.id
     )
     SELECT
       EXISTS (SELECT 1 FROM inserted)
         AND EXISTS (SELECT 1 FROM activated_intent) AS claimed,
       EXISTS (SELECT 1 FROM checkout_session)
         AND EXISTS (SELECT 1 FROM cross_provider_blocking) AS cross_provider_blocked`,
    [
      input.agreementId,
      input.userId,
      input.encryptedBillingKey,
      input.plan,
      input.now.toISOString(),
      input.processingToken,
      input.checkoutTokenHash,
      input.billingKeyIntentId,
      input.billingKeyFingerprint,
      input.customerKey,
    ]
  );
  const claim = inserted.rows[0];
  if (claim?.cross_provider_blocked) {
    throw new TossBillingError(
      'Another payment provider already has a subscription for this account.',
      'TOSS_SUBSCRIPTION_CONFLICT'
    );
  }
  if (claim?.claimed) return null;

  // A concurrent callback may have completed after our first read. Returning
  // its durable period makes duplicate browser retries safe and charge-free.
  const existingActivation = await readExistingActivation(input.agreementId, input.userId, input.now);
  if (existingActivation) {
    await markTossBillingKeyIntentLive(input.billingKeyIntentId, input.agreementId);
    return existingActivation;
  }

  // Older agreements can lack the intent pointer during a rolling deploy. Bind
  // their encrypted key and fingerprint before a stale replacement is allowed.
  await ensureAgreementBillingKeyIntent(input.agreementId, input.userId);

  const reclaimed = await db.query<{ id: string; previous_intent_id: string | null }>(
    `WITH checkout_session AS (
       SELECT token_hash FROM toss_billing_sessions
       WHERE token_hash = $7 AND user_id = $2 AND customer_key = $10
         AND plan = $4 AND status = 'processing'
       FOR UPDATE
     ), candidate_intent AS MATERIALIZED (
       SELECT candidate.id FROM toss_billing_key_intents candidate
       WHERE candidate.id = $8 AND candidate.agreement_id = $1 AND candidate.user_id = $2
         AND candidate.customer_key = $10 AND candidate.plan = $4
         AND candidate.billing_key_ciphertext = $3
         AND candidate.billing_key_fingerprint = $9
         AND candidate.status IN ('cleanup_pending', 'live')
         AND (candidate.processing_started_at IS NULL
           OR candidate.processing_started_at < NOW() - INTERVAL '10 minutes')
         AND NOT EXISTS (
           SELECT 1 FROM toss_billing_key_intents sibling
           WHERE sibling.id <> candidate.id
             AND sibling.agreement_id = candidate.agreement_id
             AND sibling.billing_key_fingerprint = candidate.billing_key_fingerprint
             AND (
               sibling.status = 'cleaned'
               OR (sibling.status = 'cleanup_pending'
                 AND sibling.processing_started_at >= NOW() - INTERVAL '10 minutes')
             )
         )
       FOR UPDATE
     ), existing AS MATERIALIZED (
       SELECT a.id, a.billing_key_intent_id AS previous_intent_id
       FROM toss_billing_agreements a
       LEFT JOIN toss_billing_key_intents old_intent
         ON old_intent.id = a.billing_key_intent_id
       WHERE a.id = $1 AND a.user_id = $2
         AND a.current_period_end <= $5
         AND (a.processing_started_at IS NULL
           OR a.processing_started_at < NOW() - INTERVAL '10 minutes')
         AND (a.billing_key_intent_id IS NULL
           OR old_intent.billing_key_fingerprint IS NOT NULL)
       FOR UPDATE OF a
     ), reclaimed AS (
       UPDATE toss_billing_agreements a SET
         billing_key_ciphertext = $3,
         billing_key_intent_id = $8,
         plan = $4,
         status = 'incomplete',
         current_period_start = $5,
         current_period_end = $5,
         next_charge_at = NULL,
         retry_count = 0,
         processing_started_at = NOW(),
         processing_token = $6,
         cancel_at_period_end = FALSE,
         billing_key_cleanup_required = FALSE,
         billing_key_cleanup_attempts = 0,
         billing_key_cleanup_last_error = NULL,
         billing_key_deleted_at = NULL,
         canceled_at = NULL,
         updated_at = NOW()
       FROM checkout_session, candidate_intent, existing
       WHERE a.id = existing.id
         AND NOT EXISTS (
           SELECT 1 FROM billing_subscriptions blocking
           WHERE blocking.user_id = $2
             AND blocking.provider <> 'toss'
             AND blocking.entitlement = 'ad_free'
             AND blocking.status IN ('incomplete', 'past_due', 'paused', 'trialing', 'active')
             AND (
               blocking.status NOT IN ('trialing', 'active')
               OR COALESCE(blocking.current_period_end, blocking.trial_end) > NOW()
             )
         )
       RETURNING a.id, existing.previous_intent_id
     ), activated_intent AS (
       UPDATE toss_billing_key_intents i SET
         status = 'live', auth_key_ciphertext = NULL,
         processing_started_at = NULL, processing_token = NULL,
         last_error_code = NULL, updated_at = NOW()
       FROM reclaimed
       WHERE i.id = $8 AND i.agreement_id = reclaimed.id
         AND i.status IN ('cleanup_pending', 'live')
       RETURNING i.id
     ), retired_intent AS (
       UPDATE toss_billing_key_intents old SET
         status = CASE
           WHEN old.billing_key_fingerprint = $9 THEN 'cleaned'
           ELSE 'cleanup_pending'
         END,
         auth_key_ciphertext = NULL,
         billing_key_ciphertext = CASE
           WHEN old.billing_key_fingerprint = $9 THEN NULL
           ELSE old.billing_key_ciphertext
         END,
         cleaned_at = CASE
           WHEN old.billing_key_fingerprint = $9 THEN NOW()
           ELSE old.cleaned_at
         END,
         processing_started_at = NULL, processing_token = NULL,
         last_error_code = NULL, updated_at = NOW()
       FROM reclaimed, activated_intent
       WHERE old.id = reclaimed.previous_intent_id
         AND old.id <> activated_intent.id
         AND old.agreement_id = reclaimed.id
       RETURNING old.id
     )
     SELECT reclaimed.id, reclaimed.previous_intent_id,
       (SELECT COUNT(*) FROM retired_intent) AS retired_count
     FROM reclaimed, activated_intent`,
    [
      input.agreementId,
      input.userId,
      input.encryptedBillingKey,
      input.plan,
      input.now.toISOString(),
      input.processingToken,
      input.checkoutTokenHash,
      input.billingKeyIntentId,
      input.billingKeyFingerprint,
      input.customerKey,
    ]
  );
  const reclaimedAgreement = reclaimed.rows[0];
  if (reclaimedAgreement) return null;

  throw new TossBillingError(
    'Another Toss subscription activation is already in progress.',
    'TOSS_ACTIVATION_IN_PROGRESS'
  );
}

async function getBillingCustomer(userId: string) {
  const generatedCustomerKey = `girapphe_${crypto.randomUUID()}`;
  const result = await db.query<BillingCustomerRow>(
    `INSERT INTO billing_customers (user_id, toss_customer_key)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       toss_customer_key = COALESCE(billing_customers.toss_customer_key, EXCLUDED.toss_customer_key),
       updated_at = NOW()
     RETURNING toss_customer_key, trial_consumed_at::text`,
    [userId, generatedCustomerKey]
  );
  const customer = result.rows[0];
  if (!customer?.toss_customer_key) throw new Error('Unable to create a Toss billing identity.');
  return customer;
}

async function createRateLimitedTossBillingSession(input: {
  userId: string;
  tokenHash: string;
  customerKey: string;
  plan: TossBillingPlan;
}) {
  const [created] = await db.accountTransaction<{ token_hash: string }>(input.userId, [
    {
      text: `WITH rate_slot AS (
       INSERT INTO toss_prepare_rate_limits (
       user_id, window_started_at, request_count, updated_at
       ) VALUES ($1, NOW(), 1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         window_started_at = CASE
           WHEN toss_prepare_rate_limits.window_started_at <= NOW() - INTERVAL '10 minutes'
           THEN NOW() ELSE toss_prepare_rate_limits.window_started_at
         END,
         request_count = CASE
           WHEN toss_prepare_rate_limits.window_started_at <= NOW() - INTERVAL '10 minutes'
           THEN 1 ELSE toss_prepare_rate_limits.request_count + 1
         END,
         updated_at = NOW()
       WHERE toss_prepare_rate_limits.window_started_at <= NOW() - INTERVAL '10 minutes'
          OR toss_prepare_rate_limits.request_count < 10
       RETURNING user_id
     )
     INSERT INTO toss_billing_sessions (
       token_hash, user_id, customer_key, plan, status, expires_at, updated_at
     )
     SELECT $2, rate_slot.user_id, $3, $4, 'pending',
       NOW() + INTERVAL '30 minutes', NOW()
     FROM rate_slot
     ON CONFLICT (user_id) WHERE status = 'pending' DO UPDATE SET
       token_hash = EXCLUDED.token_hash,
       customer_key = EXCLUDED.customer_key,
       plan = EXCLUDED.plan,
       expires_at = EXCLUDED.expires_at,
       processing_started_at = NULL,
       consumed_at = NULL,
       updated_at = NOW()
     RETURNING token_hash`,
      params: [input.userId, input.tokenHash, input.customerKey, input.plan],
    },
  ]);
  if (!created || created.rows.length === 0) {
    throw new TossBillingError(
      'Too many Toss checkout preparations. Try again later.',
      'TOSS_PREPARE_RATE_LIMITED'
    );
  }
}

export async function cleanupTossBillingSessions(userId: string | null, limit = 100) {
  const boundedLimit = Math.max(1, Math.min(limit, 1_000));
  const deleted = await db.query<{ token_hash: string }>(
    `WITH stale AS (
       SELECT token_hash
       FROM toss_billing_sessions
       WHERE ($1::text IS NULL OR user_id = $1)
         AND (
           (status IN ('consumed', 'failed', 'abandoned')
             AND updated_at < NOW() - INTERVAL '24 hours')
           OR (status = 'pending'
             AND expires_at < NOW() - INTERVAL '24 hours')
           OR (status = 'processing'
             AND expires_at < NOW() - INTERVAL '24 hours'
             AND processing_started_at < NOW() - INTERVAL '24 hours')
         )
       ORDER BY updated_at
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     DELETE FROM toss_billing_sessions sessions
     USING stale
     WHERE sessions.token_hash = stale.token_hash
     RETURNING sessions.token_hash`,
    [userId, boundedLimit]
  );
  return deleted.rows.length;
}

export async function cleanupTossPrepareRateLimits(limit = 100) {
  const boundedLimit = Math.max(1, Math.min(limit, 1_000));
  const deleted = await db.query<{ user_id: string }>(
    `WITH stale AS (
       SELECT user_id
       FROM toss_prepare_rate_limits
       WHERE updated_at < NOW() - INTERVAL '24 hours'
       ORDER BY updated_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     DELETE FROM toss_prepare_rate_limits limits
     USING stale
     WHERE limits.user_id = stale.user_id
     RETURNING limits.user_id`,
    [boundedLimit]
  );
  return deleted.rows.length;
}

export async function prepareTossBilling(userId: string, plan: TossBillingPlan) {
  if (!isPlan(plan)) throw new Error('Unsupported billing plan.');
  const config = getTossBillingConfig();
  const lease = await claimTossAccountOperation(userId, 'prepare');
  try {
    const customer = await getBillingCustomer(userId);
    const checkoutState = createTossCheckoutState();
    const tokenHash = await sha256Fingerprint(checkoutState);
    await createRateLimitedTossBillingSession({
      userId,
      tokenHash,
      customerKey: customer.toss_customer_key,
      plan,
    });
    return {
      clientKey: config.clientKey,
      customerKey: customer.toss_customer_key,
      amount: getTossPlanAmount(plan),
      trialEligible: !customer.trial_consumed_at,
      checkoutState,
    };
  } finally {
    await releaseTossAccountOperation(lease);
  }
}

export async function claimTossBillingSession(input: {
  userId: string;
  customerKey: string;
  checkoutState: string;
}): Promise<TossBillingSession> {
  getTossBillingConfig();
  const tokenHash = await sha256Fingerprint(input.checkoutState);
  const [claimed] = await db.accountTransaction<{ plan: TossBillingPlan }>(input.userId, [
    {
      text: `UPDATE toss_billing_sessions SET status = 'processing',
       processing_started_at = NOW(), updated_at = NOW()
     WHERE token_hash = $1 AND user_id = $2 AND customer_key = $3
       AND status = 'pending' AND expires_at > NOW()
     RETURNING plan`,
      params: [tokenHash, input.userId, input.customerKey],
    },
  ]);
  const session = claimed?.rows[0];
  if (!session || !isPlan(session.plan)) {
    throw new TossBillingError('Toss checkout session is invalid or expired.', 'TOSS_CHECKOUT_STATE_INVALID');
  }
  return { plan: session.plan, tokenHash };
}

export async function finishTossBillingSession(
  tokenHash: string,
  status: 'consumed' | 'failed'
) {
  await db.query(
    `UPDATE toss_billing_sessions SET status = $2,
       consumed_at = CASE WHEN $2 = 'consumed' THEN NOW() ELSE consumed_at END,
       processing_started_at = NULL, updated_at = NOW()
     WHERE token_hash = $1 AND status = 'processing'`,
    [tokenHash, status]
  );
}

async function initializeClaimedTossActivation(input: {
  agreementId: string;
  userId: string;
  encryptedBillingKey: string;
  plan: TossBillingPlan;
  customerKey: string;
  now: Date;
  processingToken: string;
}) {
  const trialEnd = addTrialPeriod(input.now);
  const initialized = await db.query<{ status: 'trialing' | 'incomplete'; trial_claimed: boolean }>(
    `WITH fenced AS (
       SELECT id FROM toss_billing_agreements
       WHERE id = $1 AND user_id = $2 AND processing_token = $3
         AND cancel_at_period_end = FALSE
       FOR UPDATE
     ), claimed_trial AS (
       UPDATE billing_customers c SET trial_consumed_at = NOW(), updated_at = NOW()
       FROM fenced
       WHERE c.user_id = $2 AND c.toss_customer_key = $4
         AND c.trial_consumed_at IS NULL
       RETURNING c.user_id
     )
     UPDATE toss_billing_agreements a SET
       billing_key_ciphertext = $5,
       plan = $6,
       status = CASE WHEN EXISTS (SELECT 1 FROM claimed_trial) THEN 'trialing' ELSE 'incomplete' END,
       current_period_start = $7,
       current_period_end = CASE WHEN EXISTS (SELECT 1 FROM claimed_trial) THEN $8 ELSE $7 END,
       next_charge_at = CASE WHEN EXISTS (SELECT 1 FROM claimed_trial) THEN $8 ELSE $7 END,
       retry_count = 0,
       processing_started_at = CASE WHEN EXISTS (SELECT 1 FROM claimed_trial) THEN NULL ELSE NOW() END,
       processing_token = CASE WHEN EXISTS (SELECT 1 FROM claimed_trial) THEN NULL ELSE $3 END,
       billing_key_cleanup_required = FALSE,
       billing_key_cleanup_attempts = 0,
       billing_key_cleanup_last_error = NULL,
       billing_key_deleted_at = NULL,
       canceled_at = NULL,
       updated_at = NOW()
     FROM fenced
     WHERE a.id = fenced.id
     RETURNING a.status, EXISTS (SELECT 1 FROM claimed_trial) AS trial_claimed`,
    [
      input.agreementId,
      input.userId,
      input.processingToken,
      input.customerKey,
      input.encryptedBillingKey,
      input.plan,
      input.now.toISOString(),
      trialEnd.toISOString(),
    ]
  );
  const state = initialized.rows[0];
  if (!state) {
    throw new TossBillingError('Toss activation was canceled or lost its processing lease.', 'TOSS_CHARGE_FENCED');
  }
  return { isTrial: state.trial_claimed, trialEnd };
}

async function upsertTossSubscription(input: {
  agreementId: string;
  userId: string;
  plan: TossBillingPlan;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) {
  await db.query(
    `INSERT INTO billing_subscriptions (
       id, user_id, provider, provider_subscription_id, store, plan, status,
       entitlement, current_period_start, current_period_end, trial_end,
       cancel_at_period_end, updated_at
     ) VALUES ($1, $2, 'toss', $1, 'web', $3, $4, 'ad_free', $5, $6, $7, $8, NOW())
     ON CONFLICT (provider, provider_subscription_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       entitlement = 'ad_free',
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       trial_end = EXCLUDED.trial_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       updated_at = NOW()`,
    [
      input.agreementId,
      input.userId,
      input.plan,
      input.status,
      input.currentPeriodStart.toISOString(),
      input.currentPeriodEnd.toISOString(),
      input.trialEnd?.toISOString() ?? null,
      input.cancelAtPeriodEnd ?? false,
    ]
  );
}

async function readMatchingTossCharge(
  agreementId: string,
  cycleKey: string,
  plan: TossBillingPlan
) {
  const result = await db.query<TossChargeRow>(
    `SELECT order_id, agreement_id, user_id, cycle_key, plan, amount_krw,
       period_start::text, period_end::text, status, payment_key, attempt_count,
       updated_at::text
     FROM toss_billing_charges
     WHERE agreement_id = $1 AND cycle_key = $2 AND plan = $3
       AND status IN ('pending', 'paid')
     ORDER BY created_at
     LIMIT 1`,
    [agreementId, cycleKey, plan]
  );
  return result.rows[0] ?? null;
}

async function readTossCharge(orderId: string) {
  const result = await db.query<TossChargeRow>(
    `SELECT order_id, agreement_id, user_id, cycle_key, plan, amount_krw,
       period_start::text, period_end::text, status, payment_key, attempt_count
     FROM toss_billing_charges
     WHERE order_id = $1`,
    [orderId]
  );
  return result.rows[0] ?? null;
}

async function prepareTossCharge(input: {
  agreementId: string;
  userId: string;
  plan: TossBillingPlan;
  cycleKey: string;
  periodStart: Date;
}) {
  const existing = await readMatchingTossCharge(input.agreementId, input.cycleKey, input.plan);
  if (existing) return existing;

  const unresolved = await db.query<{ order_id: string }>(
    `SELECT order_id FROM toss_billing_charges
     WHERE agreement_id = $1 AND status IN ('pending', 'paid')
     LIMIT 1`,
    [input.agreementId]
  );
  if (unresolved.rows[0]) {
    throw new TossBillingError(
      'A prior Toss billing cycle must be reconciled before starting another.',
      'TOSS_PRIOR_CHARGE_UNRESOLVED'
    );
  }

  const periodEnd = addTossBillingPeriod(input.periodStart, input.plan);
  const orderId = await createTossOrderId(input.agreementId, input.cycleKey);
  const amount = getTossPlanAmount(input.plan);
  const inserted = await db.query<TossChargeRow>(
    `INSERT INTO toss_billing_charges (
       order_id, agreement_id, user_id, cycle_key, plan, amount_krw,
       period_start, period_end, status, attempt_count, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 0, NOW())
     ON CONFLICT DO NOTHING
     RETURNING order_id, agreement_id, user_id, cycle_key, plan, amount_krw,
       period_start::text, period_end::text, status, payment_key, attempt_count`,
    [
      orderId,
      input.agreementId,
      input.userId,
      input.cycleKey,
      input.plan,
      amount,
      input.periodStart.toISOString(),
      periodEnd.toISOString(),
    ]
  );
  if (inserted.rows[0]) return inserted.rows[0];

  const raced = await readMatchingTossCharge(input.agreementId, input.cycleKey, input.plan);
  if (raced) return raced;
  throw new TossBillingError('Unable to persist a Toss billing cycle.', 'TOSS_CHARGE_STATE_ERROR');
}

async function markTossChargePaid(charge: TossChargeRow, paymentKey: string) {
  await db.query(
    `UPDATE toss_billing_charges SET status = 'paid', payment_key = $2,
       last_error_code = NULL, updated_at = NOW()
     WHERE order_id = $1 AND status = 'pending'`,
    [charge.order_id, paymentKey]
  );
}

async function captureTossCharge(input: {
  charge: TossChargeRow;
  billingKey: string;
  customerKey: string;
  processingToken: string;
  email?: string;
}) {
  if (input.charge.status !== 'pending') return input.charge;

  const fenced = await db.query<{ attempt_count: number }>(
    `UPDATE toss_billing_charges c SET attempt_count = c.attempt_count + 1,
       last_error_code = NULL, updated_at = NOW()
     FROM toss_billing_agreements a
     WHERE c.order_id = $1 AND c.status = 'pending'
       AND a.id = c.agreement_id AND a.user_id = c.user_id
       AND a.processing_token = $2 AND a.cancel_at_period_end = FALSE
     RETURNING c.attempt_count`,
    [input.charge.order_id, input.processingToken]
  );
  const attemptCount = fenced.rows[0]?.attempt_count;
  if (!attemptCount) {
    throw new TossBillingError('Toss charge was canceled or lost its processing lease.', 'TOSS_CHARGE_FENCED');
  }

  try {
    const existingPayment = attemptCount > 1
      ? await findTossPaymentByOrderId(input.charge.order_id)
      : null;
    const payment = existingPayment ?? await chargeTossBillingKey({
      billingKey: input.billingKey,
      customerKey: input.customerKey,
      amount: input.charge.amount_krw,
      orderId: input.charge.order_id,
      orderName: input.charge.plan === 'monthly'
        ? 'Girapphe Ad-free Monthly'
        : 'Girapphe Ad-free Annual',
      customerEmail: input.email,
      idempotencyKey: input.charge.order_id,
    });
    await verifyTossPayment({
      paymentKey: payment.paymentKey,
      orderId: input.charge.order_id,
      amount: input.charge.amount_krw,
    });
    await markTossChargePaid(input.charge, payment.paymentKey);
    return {
      ...input.charge,
      status: 'paid' as const,
      payment_key: payment.paymentKey,
      attempt_count: attemptCount,
    };
  } catch (error) {
    const code = error instanceof TossBillingError ? error.code.slice(0, 80) : 'TOSS_CHARGE_ERROR';
    await db.query(
      `UPDATE toss_billing_charges SET last_error_code = $2, updated_at = NOW()
       WHERE order_id = $1 AND status = 'pending'`,
      [input.charge.order_id, code]
    ).catch(() => undefined);
    throw error;
  }
}

async function applyPaidTossCharge(charge: TossChargeRow) {
  if (charge.status === 'applied') return charge;
  if (charge.status !== 'paid' || !charge.payment_key) {
    throw new TossBillingError('Toss charge is not ready to apply.', 'TOSS_CHARGE_STATE_ERROR');
  }
  const periodStart = new Date(charge.period_start);
  const periodEnd = new Date(charge.period_end);

  // These writes are deliberately idempotent and ordered. If any later write
  // fails, the durable `paid` charge is reconciled without contacting Toss or
  // creating a new order.
  await upsertTossSubscription({
    agreementId: charge.agreement_id,
    userId: charge.user_id,
    plan: charge.plan,
    status: 'active',
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  });
  const agreement = await db.query<{ cancel_at_period_end: boolean }>(
    `UPDATE toss_billing_agreements SET
       status = CASE WHEN cancel_at_period_end THEN 'canceled' ELSE 'active' END,
       plan = $7,
       current_period_start = $2,
       current_period_end = $3,
       next_charge_at = CASE WHEN cancel_at_period_end THEN NULL ELSE $3 END,
       last_payment_key = $4,
       last_order_id = $5,
       retry_count = 0,
       processing_started_at = NULL,
       processing_token = NULL,
       billing_key_cleanup_required = CASE
         WHEN cancel_at_period_end THEN TRUE ELSE billing_key_cleanup_required
       END,
       updated_at = NOW()
     WHERE id = $1 AND user_id = $6
     RETURNING cancel_at_period_end`,
    [
      charge.agreement_id,
      periodStart.toISOString(),
      periodEnd.toISOString(),
      charge.payment_key,
      charge.order_id,
      charge.user_id,
      charge.plan,
    ]
  );
  if (!agreement.rows[0]) {
    throw new TossBillingError('Toss agreement is missing.', 'TOSS_CHARGE_STATE_ERROR');
  }
  await db.query(
    `UPDATE billing_subscriptions SET cancel_at_period_end = $2, updated_at = NOW()
     WHERE provider = 'toss' AND provider_subscription_id = $1`,
    [charge.agreement_id, agreement.rows[0].cancel_at_period_end]
  );
  await db.query(
    `UPDATE toss_billing_charges SET status = 'applied', updated_at = NOW()
     WHERE order_id = $1 AND status = 'paid'`,
    [charge.order_id]
  );
  return { ...charge, status: 'applied' as const };
}

async function executeTossCharge(input: {
  charge: TossChargeRow;
  billingKey: string;
  customerKey: string;
  processingToken: string;
  email?: string;
}) {
  const captured = await captureTossCharge(input);
  return applyPaidTossCharge(captured);
}

async function reconcilePaidTossCharges(limit: number) {
  const pending = await db.query<TossChargeRow>(
    `SELECT order_id, agreement_id, user_id, cycle_key, plan, amount_krw,
       period_start::text, period_end::text, status, payment_key, attempt_count
     FROM toss_billing_charges
     WHERE status = 'paid'
     ORDER BY updated_at
     LIMIT $1`,
    [limit]
  );
  let applied = 0;
  for (const charge of pending.rows) {
    try {
      await applyPaidTossCharge(charge);
      applied += 1;
    } catch {
      // Keep the durable paid row for the next reconciliation run.
    }
  }
  return applied;
}

async function reconcilePriorTossChargesForActivation(
  agreementId: string,
  userId: string,
  now: Date
): Promise<TossBillingActivation | null> {
  const unresolved = await db.query<TossChargeRow>(
    `SELECT order_id, agreement_id, user_id, cycle_key, plan, amount_krw,
       period_start::text, period_end::text, status, payment_key, attempt_count,
       updated_at::text
     FROM toss_billing_charges
     WHERE agreement_id = $1 AND status IN ('pending', 'paid')
     ORDER BY created_at`,
    [agreementId]
  );

  for (let charge of unresolved.rows) {
    if (charge.status === 'pending' && charge.attempt_count > 0) {
      const payment = await findTossPaymentByOrderId(charge.order_id);
      if (payment) {
        await verifyTossPayment({
          paymentKey: payment.paymentKey,
          orderId: charge.order_id,
          amount: charge.amount_krw,
        });
        await markTossChargePaid(charge, payment.paymentKey);
        charge = { ...charge, status: 'paid', payment_key: payment.paymentKey };
      } else {
        const lastAttemptAt = new Date(charge.updated_at ?? now);
        if (now.getTime() - lastAttemptAt.getTime() < 10 * 60_000) {
          throw new TossBillingError(
            'A recent Toss payment attempt is still being reconciled.',
            'TOSS_PRIOR_CHARGE_UNRESOLVED'
          );
        }
      }
    }

    if (charge.status === 'paid') {
      await applyPaidTossCharge(charge);
      return readExistingActivation(agreementId, userId, now);
    }

    await db.query(
      `UPDATE toss_billing_charges SET status = 'abandoned',
         last_error_code = 'REPLACED_BY_NEW_ACTIVATION', updated_at = NOW()
       WHERE order_id = $1 AND status = 'pending'`,
      [charge.order_id]
    );
  }
  return null;
}

type TossBillingActivationInput = {
  userId: string;
  email?: string;
  authKey: string;
  customerKey: string;
  plan: TossBillingPlan;
  checkoutTokenHash: string;
};

async function activateTossBillingWithLease(
  input: TossBillingActivationInput,
): Promise<TossBillingActivation> {
  const customer = await getBillingCustomer(input.userId);
  if (customer.toss_customer_key !== input.customerKey) throw new Error('Billing identity mismatch.');

  const agreementFingerprint = await sha256Fingerprint(`${input.userId}:${input.customerKey}`);
  const agreementId = `toss_${agreementFingerprint.slice(0, 48)}`;
  const now = new Date();
  const existingActivation = await readExistingActivation(agreementId, input.userId, now);
  if (existingActivation) return existingActivation;
  // Hydrate legacy fingerprints before a new provider response can possibly be
  // the same raw key. Unknown legacy ownership is quarantined from orphan
  // cleanup, but doing this now also enables a safe atomic stale replacement.
  await ensureAgreementBillingKeyIntent(agreementId, input.userId);
  if (await hasCrossProviderBlockingSubscription(input.userId)) {
    throw new TossBillingError(
      'Another payment provider already has a subscription for this account.',
      'TOSS_SUBSCRIPTION_CONFLICT'
    );
  }

  const processingToken = crypto.randomUUID();
  const issueFingerprint = await sha256Fingerprint(`${input.userId}:${input.customerKey}:${input.authKey}`);
  const intentId = `toss_intent_${issueFingerprint.slice(0, 48)}`;
  const providerIdempotencyKey = `girapphe_issue_${issueFingerprint.slice(0, 40)}`;
  // The authorization material and provider idempotency key are durably stored
  // before the provider can issue a billing key. If the response is lost, the
  // scheduled worker can safely repeat the exact same provider operation.
  const encryptedAuthKey = await encryptTossBillingKey(input.authKey);
  const intent = await createTossBillingKeyIntent({
    id: intentId,
    agreementId,
    userId: input.userId,
    customerKey: input.customerKey,
    plan: input.plan,
    checkoutTokenHash: input.checkoutTokenHash,
    providerIdempotencyKey,
    encryptedAuthKey,
  });
  // This transition stores the issued key as cleanup_pending before an
  // agreement can reference it. DB failures therefore leave recoverable state,
  // never an untracked provider credential.
  const materialized = await materializeTossBillingKeyIntent(intent);
  const { billingKey, encryptedBillingKey, fingerprint } = materialized;
  const concurrentlyActivated = await claimTossActivation({
    agreementId,
    userId: input.userId,
    customerKey: input.customerKey,
    billingKeyIntentId: intentId,
    encryptedBillingKey,
    billingKeyFingerprint: fingerprint,
    plan: input.plan,
    now,
    processingToken,
    checkoutTokenHash: input.checkoutTokenHash,
  });
  if (concurrentlyActivated) {
    return concurrentlyActivated;
  }

  const priorActivation = await reconcilePriorTossChargesForActivation(
    agreementId,
    input.userId,
    now
  );
  if (priorActivation) return priorActivation;

  const initialized = await initializeClaimedTossActivation({
    agreementId,
    userId: input.userId,
    encryptedBillingKey,
    plan: input.plan,
    customerKey: input.customerKey,
    now,
    processingToken,
  });

  if (initialized.isTrial) {
    await upsertTossSubscription({
      agreementId,
      userId: input.userId,
      plan: input.plan,
      status: 'trialing',
      currentPeriodStart: now,
      currentPeriodEnd: initialized.trialEnd,
      trialEnd: initialized.trialEnd,
    });
    await readExistingActivation(agreementId, input.userId, now);
    return { status: 'trialing', currentPeriodEnd: initialized.trialEnd.toISOString() };
  }

  const charge = await prepareTossCharge({
    agreementId,
    userId: input.userId,
    plan: input.plan,
    cycleKey: `activation:${now.toISOString()}`,
    periodStart: now,
  });
  try {
    const applied = await executeTossCharge({
      charge,
      billingKey,
      customerKey: input.customerKey,
      processingToken,
      email: input.email,
    });
    return { status: 'active', currentPeriodEnd: new Date(applied.period_end).toISOString() };
  } catch (error) {
    const durableCharge = await readTossCharge(charge.order_id).catch(() => null);
    if (durableCharge?.status === 'applied') {
      const repaired = await readExistingActivation(agreementId, input.userId, now);
      if (repaired) return repaired;
    }
    if (durableCharge?.status === 'paid') {
      throw new TossBillingError(
        'Payment was received and entitlement reconciliation is pending.',
        'TOSS_PAYMENT_RECONCILIATION_PENDING'
      );
    }
    const failedAgreement = await db.query<{ canceled: boolean }>(
      `UPDATE toss_billing_agreements SET
         status = CASE WHEN cancel_at_period_end THEN 'canceled' ELSE 'past_due' END,
         retry_count = CASE WHEN cancel_at_period_end THEN retry_count ELSE 1 END,
         next_charge_at = CASE WHEN cancel_at_period_end THEN NULL ELSE $2 END,
         processing_started_at = NULL, processing_token = NULL,
         billing_key_cleanup_required = CASE
           WHEN cancel_at_period_end THEN TRUE ELSE billing_key_cleanup_required
         END,
         updated_at = NOW()
       WHERE id = $1 AND user_id = $3 AND processing_token = $4
       RETURNING cancel_at_period_end AS canceled`,
      [agreementId, retryAt(now).toISOString(), input.userId, processingToken]
    );
    const wasCanceled = failedAgreement.rows[0]?.canceled === true;
    if (wasCanceled) {
      await db.query(
        `UPDATE toss_billing_charges SET status = 'canceled', updated_at = NOW()
         WHERE order_id = $1 AND status = 'pending' AND attempt_count = 0`,
        [charge.order_id]
      );
    }
    await upsertTossSubscription({
      agreementId,
      userId: input.userId,
      plan: input.plan,
      status: wasCanceled ? 'canceled' : 'past_due',
      currentPeriodStart: now,
      currentPeriodEnd: now,
      cancelAtPeriodEnd: wasCanceled,
    });
    throw error;
  }
}

export async function activateTossBilling(
  input: TossBillingActivationInput,
): Promise<TossBillingActivation> {
  if (!isPlan(input.plan)) throw new Error('Unsupported billing plan.');
  getTossBillingConfig();
  const lease = await claimTossAccountOperation(input.userId, 'activation');
  let releaseLease = true;
  try {
    return await activateTossBillingWithLease(input);
  } catch (error) {
    if (shouldRetainTossOperationLease(error)) releaseLease = false;
    throw error;
  } finally {
    if (releaseLease) await releaseTossAccountOperation(lease);
  }
}

async function claimDueAgreements(limit: number) {
  const processingToken = crypto.randomUUID();
  const claimed = await db.query<Omit<TossAgreementRow, 'customer_key'>>(
    `WITH due AS (
       SELECT id FROM toss_billing_agreements
       WHERE status IN ('trialing', 'active', 'past_due')
         AND cancel_at_period_end = FALSE
         AND next_charge_at IS NOT NULL
         AND next_charge_at <= NOW()
         AND (processing_started_at IS NULL OR processing_started_at < NOW() - INTERVAL '30 minutes')
       ORDER BY next_charge_at
       LIMIT $1
     )
     UPDATE toss_billing_agreements a SET processing_started_at = NOW(),
       processing_token = $2, updated_at = NOW()
     FROM due WHERE a.id = due.id
       AND a.cancel_at_period_end = FALSE
       AND (a.processing_started_at IS NULL OR a.processing_started_at < NOW() - INTERVAL '30 minutes')
     RETURNING a.id, a.user_id, a.billing_key_ciphertext, a.plan, a.status,
       a.current_period_end::text, a.next_charge_at::text, a.retry_count,
       a.processing_token`,
    [limit, processingToken]
  );
  if (claimed.rows.length === 0) return [];
  const ids = claimed.rows.map((row) => row.id);
  const customers = await db.query<{ id: string; customer_key: string }>(
    `SELECT a.id, c.toss_customer_key AS customer_key
     FROM toss_billing_agreements a
     JOIN billing_customers c ON c.user_id = a.user_id
     WHERE a.id = ANY($1::text[])`,
    [ids]
  );
  const customerByAgreement = new Map(customers.rows.map((row) => [row.id, row.customer_key]));
  return claimed.rows.flatMap((row) => {
    const customerKey = customerByAgreement.get(row.id);
    return customerKey ? [{ ...row, customer_key: customerKey }] : [];
  });
}

async function processTossBillingKeyCleanup(limit: number) {
  const processingToken = crypto.randomUUID();
  const claimed = await db.query<{
    id: string;
    billing_key_ciphertext: string;
  }>(
    `WITH candidates AS (
       SELECT id FROM toss_billing_agreements
       WHERE cancel_at_period_end = TRUE
         AND billing_key_cleanup_required = TRUE
         AND (processing_started_at IS NULL OR processing_started_at < NOW() - INTERVAL '5 minutes')
       ORDER BY updated_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE toss_billing_agreements a SET processing_started_at = NOW(),
       processing_token = $2, updated_at = NOW()
     FROM candidates
     WHERE a.id = candidates.id
       AND (a.processing_started_at IS NULL OR a.processing_started_at < NOW() - INTERVAL '5 minutes')
     RETURNING a.id, a.billing_key_ciphertext`,
    [limit, processingToken]
  );

  let cleaned = 0;
  for (const agreement of claimed.rows) {
    try {
      const unresolved = await db.query<TossChargeRow>(
        `SELECT order_id, agreement_id, user_id, cycle_key, plan, amount_krw,
           period_start::text, period_end::text, status, payment_key, attempt_count,
           updated_at::text
         FROM toss_billing_charges
         WHERE agreement_id = $1 AND status IN ('pending', 'paid')
         ORDER BY created_at`,
        [agreement.id]
      );
      let waitingForProvider = false;
      for (let charge of unresolved.rows) {
        if (charge.status === 'pending' && charge.attempt_count > 0) {
          const payment = await findTossPaymentByOrderId(charge.order_id);
          if (payment) {
            await verifyTossPayment({
              paymentKey: payment.paymentKey,
              orderId: charge.order_id,
              amount: charge.amount_krw,
            });
            await markTossChargePaid(charge, payment.paymentKey);
            charge = { ...charge, status: 'paid', payment_key: payment.paymentKey };
          } else {
            const lastAttemptAt = new Date(charge.updated_at ?? Date.now());
            if (Date.now() - lastAttemptAt.getTime() < 10 * 60_000) {
              waitingForProvider = true;
              continue;
            }
          }
        }
        if (charge.status === 'paid') {
          await applyPaidTossCharge(charge);
        } else if (!waitingForProvider) {
          await db.query(
            `UPDATE toss_billing_charges SET status = 'canceled',
               last_error_code = 'SUBSCRIPTION_CANCELED', updated_at = NOW()
             WHERE order_id = $1 AND status = 'pending'`,
            [charge.order_id]
          );
        }
      }
      if (waitingForProvider) {
        await db.query(
          `UPDATE toss_billing_agreements SET processing_started_at = NULL,
             processing_token = NULL, updated_at = NOW()
           WHERE id = $1 AND processing_token = $2`,
          [agreement.id, processingToken]
        );
        continue;
      }

      const billingKey = await decryptTossBillingKey(agreement.billing_key_ciphertext);
      try {
        await deleteTossBillingKey(billingKey);
      } catch (error) {
        if (!(error instanceof TossBillingError)
          || !['HTTP_404', 'NOT_FOUND_BILLING_KEY'].includes(error.code)) {
          throw error;
        }
      }
      const cleanedAgreement = await db.query<{ id: string }>(
        `WITH cleaned_intent AS (
           UPDATE toss_billing_key_intents i SET
             status = 'cleaned', auth_key_ciphertext = NULL,
             billing_key_ciphertext = NULL,
             cleanup_attempt_count = cleanup_attempt_count + 1,
             processing_started_at = NULL, processing_token = NULL,
             last_error_code = NULL, cleaned_at = NOW(), updated_at = NOW()
           FROM toss_billing_agreements a
           WHERE a.id = $1 AND a.processing_token = $3
             AND a.billing_key_intent_id = i.id
             AND i.billing_key_ciphertext = $2
           RETURNING i.id
         )
         UPDATE toss_billing_agreements a SET billing_key_cleanup_required = FALSE,
           billing_key_cleanup_last_error = NULL, billing_key_deleted_at = NOW(),
           processing_started_at = NULL, processing_token = NULL, updated_at = NOW()
         WHERE a.id = $1 AND a.billing_key_ciphertext = $2
           AND a.cancel_at_period_end = TRUE AND a.processing_token = $3
           AND (a.billing_key_intent_id IS NULL
             OR EXISTS (SELECT 1 FROM cleaned_intent))
         RETURNING a.id`,
        [agreement.id, agreement.billing_key_ciphertext, processingToken]
      );
      cleaned += cleanedAgreement.rows.length;
    } catch (error) {
      const code = error instanceof TossBillingError ? error.code.slice(0, 80) : 'TOSS_KEY_CLEANUP_ERROR';
      await db.query(
         `UPDATE toss_billing_agreements SET billing_key_cleanup_attempts = billing_key_cleanup_attempts + 1,
           billing_key_cleanup_last_error = $2, processing_started_at = NULL,
           processing_token = NULL, updated_at = NOW()
         WHERE id = $1 AND billing_key_cleanup_required = TRUE
           AND billing_key_ciphertext = $3`,
        [agreement.id, code, agreement.billing_key_ciphertext]
      ).catch(() => undefined);
    }
  }
  return cleaned;
}

export async function processDueTossBilling(limit = 5) {
  getTossBillingConfig();
  const boundedLimit = Math.max(1, Math.min(limit, 10));
  const keyIntents = await processTossBillingKeyIntents(boundedLimit);
  const reconciled = await reconcilePaidTossCharges(boundedLimit);
  const due = await claimDueAgreements(boundedLimit);
  const results = {
    attempted: due.length,
    paid: 0,
    failed: 0,
    paused: 0,
    reconciled,
    cleaned: 0,
    sessionsCleaned: 0,
    rateLimitsCleaned: 0,
    keyIntentsNormalized: keyIntents.normalized,
    keyIntentsQuarantined: keyIntents.quarantined,
    keyIntentsRecovered: keyIntents.recovered,
    keyIntentsCleaned: keyIntents.cleaned,
    keyIntentsFailed: keyIntents.failed,
  };

  for (const agreement of due) {
    let operationLease: AccountBillingOperationLease | null = null;
    try {
      operationLease = await claimAccountBillingOperation(
        agreement.user_id,
        'toss',
        'renewal',
      );
    } catch {
      await db.query(
        `UPDATE toss_billing_agreements SET processing_started_at = NULL,
           processing_token = NULL, updated_at = NOW()
         WHERE id = $1 AND processing_token = $2`,
        [agreement.id, agreement.processing_token],
      ).catch(() => undefined);
      results.failed += 1;
      continue;
    }
    if (!operationLease) {
      await db.query(
        `UPDATE toss_billing_agreements SET processing_started_at = NULL,
           processing_token = NULL, updated_at = NOW()
         WHERE id = $1 AND processing_token = $2`,
        [agreement.id, agreement.processing_token],
      ).catch(() => undefined);
      continue;
    }

    let releaseLease = true;
    let charge: TossChargeRow | null = null;
    try {
      const billingKey = await decryptTossBillingKey(agreement.billing_key_ciphertext);
      const cycleAnchor = new Date(agreement.current_period_end ?? agreement.next_charge_at);
      const now = new Date();
      const periodStart = cycleAnchor > now ? cycleAnchor : now;
      charge = await prepareTossCharge({
        agreementId: agreement.id,
        userId: agreement.user_id,
        plan: agreement.plan,
        cycleKey: `renewal:${cycleAnchor.toISOString()}`,
        periodStart,
      });
      await executeTossCharge({
        charge,
        billingKey,
        customerKey: agreement.customer_key,
        processingToken: agreement.processing_token,
      });
      results.paid += 1;
    } catch (error) {
      if (shouldRetainTossOperationLease(error)) releaseLease = false;
      const durableCharge = charge
        ? await readTossCharge(charge.order_id).catch(() => null)
        : null;
      if (durableCharge?.status === 'paid' || durableCharge?.status === 'applied') {
        await db.query(
          `UPDATE toss_billing_agreements SET processing_started_at = NULL,
             processing_token = NULL, updated_at = NOW()
           WHERE id = $1 AND processing_token = $2`,
          [agreement.id, agreement.processing_token]
        ).catch(() => undefined);
        results.failed += 1;
        continue;
      }
      const retryCount = agreement.retry_count + 1;
      const paused = retryCount >= 3;
      const failedAgreement = await db.query<{ canceled: boolean }>(
        `UPDATE toss_billing_agreements SET
           status = CASE WHEN cancel_at_period_end THEN 'canceled' ELSE $2 END,
           retry_count = CASE WHEN cancel_at_period_end THEN retry_count ELSE $3 END,
           next_charge_at = CASE WHEN cancel_at_period_end THEN NULL ELSE $4 END,
           processing_started_at = NULL, processing_token = NULL,
           billing_key_cleanup_required = CASE
             WHEN cancel_at_period_end THEN TRUE ELSE billing_key_cleanup_required
           END,
           updated_at = NOW()
         WHERE id = $1 AND processing_token = $5
         RETURNING cancel_at_period_end AS canceled`,
        [
          agreement.id,
          paused ? 'paused' : 'past_due',
          retryCount,
          paused ? null : retryAt(new Date()).toISOString(),
          agreement.processing_token,
        ]
      );
      const wasCanceled = failedAgreement.rows[0]?.canceled === true;
      if (wasCanceled && charge) {
        await db.query(
          `UPDATE toss_billing_charges SET status = 'canceled', updated_at = NOW()
           WHERE order_id = $1 AND status = 'pending' AND attempt_count = 0`,
          [charge.order_id]
        );
      }
      await db.query(
        `UPDATE billing_subscriptions SET status = $2,
           cancel_at_period_end = CASE WHEN $2 = 'canceled' THEN TRUE ELSE cancel_at_period_end END,
           updated_at = NOW()
         WHERE provider = 'toss' AND provider_subscription_id = $1`,
        [agreement.id, wasCanceled ? 'canceled' : paused ? 'paused' : 'past_due']
      );
      results.failed += 1;
      if (paused) results.paused += 1;
    } finally {
      if (releaseLease) await releaseTossAccountOperation(operationLease);
    }
  }

  results.cleaned = await processTossBillingKeyCleanup(boundedLimit);
  results.sessionsCleaned = await cleanupTossBillingSessions(null, boundedLimit * 100);
  results.rateLimitsCleaned = await cleanupTossPrepareRateLimits(boundedLimit * 100);
  return results;
}

export async function cancelTossBilling(userId: string) {
  getTossBillingConfig();
  await db.query(
    `UPDATE toss_billing_sessions SET status = 'abandoned',
       processing_started_at = NULL, updated_at = NOW()
     WHERE user_id = $1 AND status IN ('pending', 'processing')`,
    [userId]
  );
  const result = await db.query<{ id: string; cancellation_pending: boolean }>(
    `UPDATE toss_billing_agreements SET
       status = CASE WHEN processing_token IS NULL THEN 'canceled' ELSE status END,
       cancel_at_period_end = TRUE,
       next_charge_at = NULL,
       billing_key_cleanup_required = TRUE,
       canceled_at = COALESCE(canceled_at, NOW()),
       updated_at = NOW()
     WHERE user_id = $1
       AND status IN ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled')
     RETURNING id, processing_token IS NOT NULL AS cancellation_pending`,
    [userId]
  );
  for (const row of result.rows) {
    await db.query(
      `UPDATE billing_subscriptions SET
         status = CASE
           WHEN status IN ('incomplete', 'past_due', 'paused')
             OR COALESCE(current_period_end, trial_end) <= NOW()
           THEN 'canceled' ELSE status
         END,
         cancel_at_period_end = TRUE, updated_at = NOW()
       WHERE provider = 'toss' AND provider_subscription_id = $1`,
      [row.id]
    );
    if (!row.cancellation_pending) {
      await db.query(
        `UPDATE toss_billing_charges SET status = 'canceled',
           last_error_code = 'SUBSCRIPTION_CANCELED', updated_at = NOW()
         WHERE agreement_id = $1 AND status = 'pending' AND attempt_count = 0`,
        [row.id]
      );
    }
  }
  await processTossBillingKeyCleanup(Math.max(1, Math.min(result.rows.length, 10)));
  return {
    canceled: result.rows.filter((row) => !row.cancellation_pending).length,
    pending: result.rows.filter((row) => row.cancellation_pending).length,
  };
}
