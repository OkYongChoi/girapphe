import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseCreemAttemptResolutionArguments } from './resolve-creem-checkout-attempt.mjs';

test('Creem no-id recovery requires exact account, attempt, and absence confirmation', () => {
  assert.deepEqual(parseCreemAttemptResolutionArguments([
    '--user', 'user_example',
    '--attempt', 'checkout_attempt_123',
    '--confirm', 'absent:user_example:checkout_attempt_123',
  ]), { userId: 'user_example', attemptId: 'checkout_attempt_123' });
  assert.throws(() => parseCreemAttemptResolutionArguments([
    '--user', 'user_example',
    '--attempt', 'checkout_attempt_123',
    '--confirm', 'yes',
  ]), /exact absent/);
});

test('Creem no-id recovery is deletion-fenced and preserves the attempt ledger', async () => {
  const source = await readFile(new URL('./resolve-creem-checkout-attempt.mjs', import.meta.url), 'utf8');
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /mcp_deleted_account_markers/);
  assert.match(source, /provider_checkout_id IS NULL/);
  assert.match(source, /operator_confirmed_absent/);
  assert.match(source, /SET status = 'abandoned'/);
  assert.doesNotMatch(source, /DELETE FROM billing_checkout_attempts/);
  assert.doesNotMatch(source, /status = 'abandoned'[\s\S]+provider_checkout_id IS NOT NULL/);
});
