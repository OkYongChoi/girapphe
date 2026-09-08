import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const ACCOUNT_LIFECYCLE_DOMAIN = 'girapphe:mcp-account-lifecycle:v1';

function fingerprint(domain, userId) {
  return createHash('sha256').update(`${domain}\0${userId}`, 'utf8').digest('hex');
}

export function parseCreemAttemptResolutionArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error('Expected --user, --attempt, and --confirm value pairs.');
    }
    values.set(key.slice(2), value);
  }
  const userId = values.get('user') ?? '';
  const attemptId = values.get('attempt') ?? '';
  const confirmation = values.get('confirm') ?? '';
  if (!/^user_[A-Za-z0-9_-]{3,}$/.test(userId)) throw new Error('A Clerk user id is required.');
  if (!/^[A-Za-z0-9:_-]{8,200}$/.test(attemptId)) {
    throw new Error('A bounded checkout attempt id is required.');
  }
  if (confirmation !== `absent:${userId}:${attemptId}`) {
    throw new Error('The exact absent:<user>:<attempt> confirmation is required.');
  }
  return { userId, attemptId };
}

export async function resolveCreemAttemptAsAbsent({ databaseUrl, userId, attemptId }) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const client = new pg.Client({ connectionString: databaseUrl });
  const deletionScope = fingerprint(ACCOUNT_LIFECYCLE_DOMAIN, userId);
  await client.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`mcp-account-lifecycle:${deletionScope}`],
    );
    const deleted = await client.query(
      'SELECT 1 FROM mcp_deleted_account_markers WHERE scope_key = $1',
      [deletionScope],
    );
    if (deleted.rowCount !== 1) {
      throw new Error('This recovery is allowed only after permanent account deletion has begun.');
    }
    const attempt = await client.query(
      `SELECT provider, status, provider_checkout_id
       FROM billing_checkout_attempts
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [attemptId, userId],
    );
    const row = attempt.rows[0];
    if (!row || row.provider !== 'creem') {
      throw new Error('No matching Creem checkout attempt exists.');
    }
    if (!['creating', 'open', 'indeterminate'].includes(row.status)) {
      throw new Error('The checkout attempt is not unresolved.');
    }
    if (row.provider_checkout_id) {
      throw new Error('A provider checkout id exists; use authoritative Creem reconciliation.');
    }
    const resolved = await client.query(
      `UPDATE billing_checkout_attempts
       SET status = 'abandoned', checkout_url = NULL,
           last_error_code = 'operator_confirmed_absent', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND provider = 'creem'
         AND status IN ('creating', 'open', 'indeterminate')
         AND provider_checkout_id IS NULL
       RETURNING id`,
      [attemptId, userId],
    );
    if (resolved.rowCount !== 1) throw new Error('The checkout attempt changed during recovery.');
    await client.query('COMMIT');
    return { userId, attemptId, status: 'abandoned' };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  try {
    const input = parseCreemAttemptResolutionArguments(process.argv.slice(2));
    const result = await resolveCreemAttemptAsAbsent({
      databaseUrl: process.env.DATABASE_URL,
      ...input,
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Creem attempt recovery failed.');
    process.exitCode = 1;
  }
}
