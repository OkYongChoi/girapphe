import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseResolutionArguments } from './resolve-billing-acquisition-block.mjs';

test('operator acquisition-block recovery requires an exact user, reason, and confirmation', () => {
  assert.deepEqual(parseResolutionArguments([
    '--user', 'user_example',
    '--reason', 'mobile_purchase_pending',
    '--confirm', 'resolve:user_example:mobile_purchase_pending',
  ]), { userId: 'user_example', reason: 'mobile_purchase_pending' });
  assert.throws(() => parseResolutionArguments([
    '--user', 'user_example',
    '--reason', 'mobile_purchase_pending',
    '--confirm', 'yes',
  ]), /exact resolve/);
  assert.throws(() => parseResolutionArguments([
    '--user', 'email@example.com',
    '--reason', 'manual_review',
    '--confirm', 'resolve:email@example.com:manual_review',
  ]), /Clerk user id/);
});

test('operator recovery preserves records and resolves under the account lifecycle lock', async () => {
  const source = await readFile(new URL('./resolve-billing-acquisition-block.mjs', import.meta.url), 'utf8');
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /mcp_deleted_account_markers/);
  assert.match(source, /UPDATE billing_acquisition_blocks/);
  assert.match(source, /SET resolved_at = NOW\(\), updated_at = NOW\(\)/);
  assert.doesNotMatch(source, /DELETE FROM billing_(?:subscriptions|acquisition_blocks)/);
  assert.match(source, /DELETE FROM billing_account_operations/);
});
