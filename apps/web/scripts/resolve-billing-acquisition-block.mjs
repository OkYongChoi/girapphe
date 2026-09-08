import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const ACCOUNT_LIFECYCLE_DOMAIN = 'girapphe:mcp-account-lifecycle:v1';
const ACCOUNT_BILLING_OPERATION_DOMAIN = 'girapphe:account-billing-operation:v2';
const REASONS = new Set([
  'duplicate_subscription',
  'manual_review',
  'mobile_purchase_pending',
]);

function fingerprint(domain, userId) {
  return createHash('sha256').update(`${domain}\0${userId}`, 'utf8').digest('hex');
}

export function parseResolutionArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error('Expected --user, --reason, and --confirm value pairs.');
    }
    values.set(key.slice(2), value);
  }
  const userId = values.get('user') ?? '';
  const reason = values.get('reason') ?? '';
  const confirmation = values.get('confirm') ?? '';
  if (!/^user_[A-Za-z0-9_-]{3,}$/.test(userId)) throw new Error('A Clerk user id is required.');
  if (!REASONS.has(reason)) throw new Error('A supported acquisition block reason is required.');
  if (confirmation !== `resolve:${userId}:${reason}`) {
    throw new Error('The exact resolve:<user>:<reason> confirmation is required.');
  }
  return { userId, reason };
}

export async function resolveAcquisitionBlock({ databaseUrl, userId, reason }) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const client = new pg.Client({ connectionString: databaseUrl });
  const deletionScope = fingerprint(ACCOUNT_LIFECYCLE_DOMAIN, userId);
  const operationScope = fingerprint(ACCOUNT_BILLING_OPERATION_DOMAIN, userId);
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
    if (deleted.rowCount) throw new Error('The Girapphe account is already deleted.');
    const resolved = await client.query(
      `UPDATE billing_acquisition_blocks
       SET resolved_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND reason = $2 AND resolved_at IS NULL
       RETURNING operation_owner_token`,
      [userId, reason],
    );
    if (resolved.rowCount !== 1) throw new Error('No matching open acquisition block exists.');
    const ownerToken = resolved.rows[0]?.operation_owner_token;
    if (reason === 'mobile_purchase_pending' && ownerToken) {
      await client.query(
        `DELETE FROM billing_account_operations
         WHERE scope_key = $1 AND provider = 'superwall'
           AND operation = 'mobile_purchase' AND owner_token = $2`,
        [operationScope, ownerToken],
      );
    }
    await client.query('COMMIT');
    return { userId, reason, resolved: true };
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
    const input = parseResolutionArguments(process.argv.slice(2));
    const result = await resolveAcquisitionBlock({
      databaseUrl: process.env.DATABASE_URL,
      ...input,
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Acquisition block resolution failed.');
    process.exitCode = 1;
  }
}
