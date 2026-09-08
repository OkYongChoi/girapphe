import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import accountLifecycle from '../src/lib/account-lifecycle.ts';

const {
  buildAccountDeletionFenceQueries,
  buildActiveAccountGuardQueries,
  deriveAccountBillingOperationScopeKey,
} = accountLifecycle;

const databaseUrl = process.env.ACCOUNT_BILLING_FENCE_TEST_DATABASE_URL?.trim();

async function runTransaction(client, queries) {
  await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  try {
    const results = [];
    for (const query of queries) {
      results.push(await client.query(query.text, query.params));
    }
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

function billingLeaseQuery(userId, provider, owner) {
  return {
    text: `INSERT INTO billing_account_operations (
             scope_key, provider, operation, owner_token, expires_at, created_at, updated_at
           ) VALUES ($1, $2, 'checkout', $3, NOW() + INTERVAL '10 minutes', NOW(), NOW())
           ON CONFLICT (scope_key) DO UPDATE SET
             provider = EXCLUDED.provider,
             operation = EXCLUDED.operation,
             owner_token = EXCLUDED.owner_token,
             expires_at = EXCLUDED.expires_at,
             updated_at = NOW()
           WHERE billing_account_operations.expires_at <= NOW()
           RETURNING scope_key`,
    params: [
      deriveAccountBillingOperationScopeKey(userId),
      provider,
      owner,
    ],
  };
}

test('PostgreSQL serializes account deletion against billing initiation in both lock orders', {
  skip: databaseUrl ? false : 'set ACCOUNT_BILLING_FENCE_TEST_DATABASE_URL for the real PostgreSQL race test',
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  const schema = `account_billing_fence_${crypto.randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^[a-z0-9_]+$/);
  const admin = await pool.connect();
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TABLE mcp_deleted_account_markers (
      scope_key TEXT PRIMARY KEY,
      deleted_at TIMESTAMPTZ NOT NULL
    )`);
    await admin.query(`CREATE TABLE billing_account_operations (
      scope_key TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      operation TEXT NOT NULL,
      owner_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )`);
    await admin.query(`CREATE TABLE billing_checkout_attempts (
      user_id TEXT PRIMARY KEY,
      status TEXT NOT NULL
    )`);
    await admin.query(`CREATE TABLE billing_acquisition_blocks (
      user_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      resolved_at TIMESTAMPTZ
    )`);

    const first = await pool.connect();
    try {
      await first.query(`SET search_path TO "${schema}"`);
      const userId = 'user_initiation_first';
      const lease = billingLeaseQuery(userId, 'creem', 'owner-first');
      const claimed = await runTransaction(first, [
        ...buildActiveAccountGuardQueries(userId),
        lease,
      ]);
      assert.equal(claimed[2]?.rowCount, 1);

      const blockedDeletion = await runTransaction(
        first,
        buildAccountDeletionFenceQueries(userId),
      );
      assert.equal(blockedDeletion[1]?.rowCount, 0);
      assert.equal((await first.query(
        'SELECT COUNT(*)::int AS count FROM mcp_deleted_account_markers',
      )).rows[0]?.count, 0);

      await first.query(
        `DELETE FROM billing_account_operations
         WHERE scope_key = $1 AND provider = $2 AND owner_token = $3`,
        lease.params,
      );
      const retriedDeletion = await runTransaction(
        first,
        buildAccountDeletionFenceQueries(userId),
      );
      assert.equal(retriedDeletion[1]?.rowCount, 1);

      const pendingUserId = 'user_mobile_purchase_pending';
      await first.query(
        `INSERT INTO billing_acquisition_blocks (user_id, reason, resolved_at)
         VALUES ($1, 'mobile_purchase_pending', NULL)`,
        [pendingUserId],
      );
      const pendingDeletion = await runTransaction(
        first,
        buildAccountDeletionFenceQueries(pendingUserId),
      );
      assert.equal(pendingDeletion[1]?.rowCount, 0);
      await first.query(
        `UPDATE billing_acquisition_blocks
         SET resolved_at = NOW()
         WHERE user_id = $1 AND reason = 'mobile_purchase_pending'`,
        [pendingUserId],
      );
      const resolvedDeletion = await runTransaction(
        first,
        buildAccountDeletionFenceQueries(pendingUserId),
      );
      assert.equal(resolvedDeletion[1]?.rowCount, 1);
    } finally {
      first.release();
    }

    await admin.query('TRUNCATE billing_account_operations, billing_acquisition_blocks, mcp_deleted_account_markers, billing_checkout_attempts');
    const deletionClient = await pool.connect();
    const initiationClient = await pool.connect();
    try {
      await deletionClient.query(`SET search_path TO "${schema}"`);
      await initiationClient.query(`SET search_path TO "${schema}"`);
      const userId = 'user_deletion_first';
      const deletionQueries = buildAccountDeletionFenceQueries(userId);
      await deletionClient.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await deletionClient.query(deletionQueries[0].text, deletionQueries[0].params);
      const marker = await deletionClient.query(deletionQueries[1].text, deletionQueries[1].params);
      assert.equal(marker.rowCount, 1);

      const backendPid = (await initiationClient.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      let lockAttempted;
      const attempted = new Promise((resolve) => { lockAttempted = resolve; });
      const claimPromise = (async () => {
        await initiationClient.query('BEGIN ISOLATION LEVEL READ COMMITTED');
        lockAttempted();
        try {
          const guard = buildActiveAccountGuardQueries(userId);
          await initiationClient.query(guard[0].text, guard[0].params);
          await initiationClient.query(guard[1].text, guard[1].params);
          const lease = billingLeaseQuery(userId, 'superwall', 'owner-second');
          await initiationClient.query(lease.text, lease.params);
          await initiationClient.query('COMMIT');
          return null;
        } catch (error) {
          await initiationClient.query('ROLLBACK');
          return error;
        }
      })();
      await attempted;

      let observedAdvisoryWait = false;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const activity = await admin.query(
          `SELECT wait_event FROM pg_catalog.pg_stat_activity WHERE pid = $1`,
          [backendPid],
        );
        if (activity.rows[0]?.wait_event === 'advisory') {
          observedAdvisoryWait = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert.equal(observedAdvisoryWait, true);
      await deletionClient.query('COMMIT');
      const claimError = await claimPromise;
      assert.equal(claimError?.code, '23505');
      assert.equal((await admin.query(
        'SELECT COUNT(*)::int AS count FROM billing_account_operations',
      )).rows[0]?.count, 0);
      assert.equal((await admin.query(
        'SELECT COUNT(*)::int AS count FROM mcp_deleted_account_markers',
      )).rows[0]?.count, 1);

      const checkoutWriteError = await runTransaction(initiationClient, [
        ...buildActiveAccountGuardQueries(userId),
        {
          text: `INSERT INTO billing_checkout_attempts (user_id, status)
                 VALUES ($1, 'creating')`,
          params: [userId],
        },
      ]).then(() => null, (error) => error);
      assert.equal(checkoutWriteError?.code, '23505');
      assert.equal((await admin.query(
        'SELECT COUNT(*)::int AS count FROM billing_checkout_attempts',
      )).rows[0]?.count, 0);
    } finally {
      await deletionClient.query('ROLLBACK').catch(() => undefined);
      await initiationClient.query('ROLLBACK').catch(() => undefined);
      deletionClient.release();
      initiationClient.release();
    }
  } finally {
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
    admin.release();
    await pool.end();
  }
});
