import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import accountLifecycle from '../src/lib/account-lifecycle.ts';

const {
  buildAccountDeletionFenceQueries,
  buildActiveAccountGuardQueries,
  deriveAccountBillingOperationEventId,
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
    text: `INSERT INTO billing_webhook_events (
             provider, event_id, event_type, processed_at, created_at
           ) VALUES ($1, $2, $3, NULL, NOW())
           ON CONFLICT (provider, event_id) DO UPDATE SET
             event_type = EXCLUDED.event_type,
             created_at = NOW()
           WHERE billing_webhook_events.processed_at IS NULL
             AND billing_webhook_events.created_at < NOW() - INTERVAL '10 minutes'
           RETURNING event_id`,
    params: [
      provider,
      deriveAccountBillingOperationEventId(userId, provider),
      `account.billing.test:${owner}`,
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
    await admin.query(`CREATE TABLE billing_webhook_events (
      provider TEXT NOT NULL,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (provider, event_id)
    )`);
    await admin.query(`CREATE TABLE toss_prepare_rate_limits (
      user_id TEXT PRIMARY KEY,
      request_count INTEGER NOT NULL DEFAULT 1
    )`);

    const first = await pool.connect();
    try {
      await first.query(`SET search_path TO "${schema}"`);
      const userId = 'user_initiation_first';
      const lease = billingLeaseQuery(userId, 'stripe', 'owner-first');
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
        `DELETE FROM billing_webhook_events
         WHERE provider = $1 AND event_id = $2 AND event_type = $3`,
        lease.params,
      );
      const retriedDeletion = await runTransaction(
        first,
        buildAccountDeletionFenceQueries(userId),
      );
      assert.equal(retriedDeletion[1]?.rowCount, 1);
    } finally {
      first.release();
    }

    await admin.query('TRUNCATE billing_webhook_events, mcp_deleted_account_markers, toss_prepare_rate_limits');
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
          const lease = billingLeaseQuery(userId, 'toss', 'owner-second');
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
        'SELECT COUNT(*)::int AS count FROM billing_webhook_events',
      )).rows[0]?.count, 0);
      assert.equal((await admin.query(
        'SELECT COUNT(*)::int AS count FROM mcp_deleted_account_markers',
      )).rows[0]?.count, 1);

      const tossPrepareError = await runTransaction(initiationClient, [
        ...buildActiveAccountGuardQueries(userId),
        {
          text: `INSERT INTO toss_prepare_rate_limits (user_id, request_count)
                 VALUES ($1, 1)`,
          params: [userId],
        },
      ]).then(() => null, (error) => error);
      assert.equal(tossPrepareError?.code, '23505');
      assert.equal((await admin.query(
        'SELECT COUNT(*)::int AS count FROM toss_prepare_rate_limits',
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
